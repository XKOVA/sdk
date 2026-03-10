import { useEffect, useMemo, useRef, useState } from "react";
import type { UserInfo } from "@xkova/sdk-core";

const CACHE_NAME = "xkova-avatar-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AVATAR_TRACE = true;

const canUseCache = (): boolean =>
  typeof window !== "undefined" && typeof caches !== "undefined";

const buildCacheRequest = (userId: string): Request =>
  new Request(`https://xkova.local/avatar/${encodeURIComponent(userId)}`);

const getCachedAt = (response: Response): number | null => {
  const raw = response.headers.get("x-xkova-cached-at");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getCachedSource = (response: Response): string | null => {
  const raw = response.headers.get("x-xkova-source");
  return raw ? raw : null;
};

const normalizeImageBlob = (blob: Blob): Blob => {
  const rawType = blob.type || "";
  if (!rawType) return blob;
  const normalized = rawType.split(";")[0]?.trim() || "";
  if (!normalized || normalized === rawType) return blob;
  return new Blob([blob], { type: normalized });
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

const readMagicBytes = async (blob: Blob): Promise<string | null> => {
  try {
    const buf = await blob.slice(0, 4).arrayBuffer();
    return toHex(new Uint8Array(buf));
  } catch {
    return null;
  }
};

const isLikelyImageMagic = (magic: string | null): boolean => {
  if (!magic) return false;
  const normalized = magic.toLowerCase();
  return (
    normalized.startsWith("ff d8 ff") || // jpeg
    normalized.startsWith("89 50 4e 47") || // png
    normalized.startsWith("47 49 46 38") || // gif
    normalized.startsWith("52 49 46 46") // riff (webp)
  );
};

const isValidImageBlob = (magic: string | null, decodeOk: boolean | null): boolean => {
  if (decodeOk === true) return true;
  if (decodeOk === false) return false;
  return isLikelyImageMagic(magic);
};

const traceBlob = async (
  sourceUrl: string,
  source: "cache" | "fetch",
  blob: Blob,
): Promise<{ magic: string | null; decodeOk: boolean | null }> => {
  if (!AVATAR_TRACE || typeof window === "undefined") {
    return { magic: null, decodeOk: null };
  }
  const magic = await readMagicBytes(blob);
  let decodeOk: boolean | null = null;
  if (typeof (globalThis as any).createImageBitmap === "function") {
    try {
      await (globalThis as any).createImageBitmap(blob);
      decodeOk = true;
    } catch {
      decodeOk = false;
    }
  }
  return { magic, decodeOk };
};

const storeAvatarResponse = async (
  request: Request,
  sourceUrl: string,
  blob: Blob,
) => {
  const normalizedBlob = normalizeImageBlob(blob);
  const headers = new Headers({
    "content-type": normalizedBlob.type || "image/*",
    "x-xkova-cached-at": String(Date.now()),
    "x-xkova-source": sourceUrl,
  });
  const response = new Response(normalizedBlob, { headers });
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
};

const fetchAvatarBlob = async (url: string): Promise<Blob | null> => {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
};

const deleteAvatarCache = async (userId: string) => {
  if (!canUseCache()) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(buildCacheRequest(userId));
};

/**
 * Cache and resolve avatar URLs as blob URLs backed by Cache Storage.
 *
 * @remarks
 * Purpose:
 * - Cache avatar image bytes for the current session.
 * - Avoid signed URL expiry causing intermittent avatar fallback.
 *
 * Behavior:
 * - Stores avatar bytes for up to 24 hours (TTL).
 * - Invalidates cache when user changes or avatar_url changes.
 * - Revokes previous blob URLs when replaced or on unmount.
 *
 * Return semantics:
 * - Returns a blob URL when cached, otherwise the original avatar_url.
 */
export const useCachedAvatarUrl = (user: UserInfo | null) => {
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const lastSourceRef = useRef<string | null>(null);

  const avatarUrl = user?.avatarUrl ?? null;
  const userId = user?.id ?? null;
  const isProxyUrl =
    typeof avatarUrl === "string" &&
    /\/api\/v1\/users\/[^/]+\/avatar/.test(avatarUrl);

  const updateObjectUrl = (next: string | null) => {
    const prev = objectUrlRef.current;
    if (prev && prev !== next) {
      URL.revokeObjectURL(prev);
    }
    objectUrlRef.current = next;
    setCachedUrl(next);
  };

  useEffect(() => {
    if (!canUseCache()) {
      updateObjectUrl(null);
      return;
    }
    if (!userId || !avatarUrl || isProxyUrl) {
      updateObjectUrl(null);
      return;
    }

    let cancelled = false;
    const request = buildCacheRequest(userId);

    const hydrate = async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        const cachedAt = getCachedAt(cachedResponse);
        const cachedSource = getCachedSource(cachedResponse);
        const isFresh =
          cachedAt !== null ? Date.now() - cachedAt < CACHE_TTL_MS : false;
        const sourceMatches = cachedSource === avatarUrl;
        if (isFresh && sourceMatches) {
          const blob = normalizeImageBlob(await cachedResponse.blob());
          const trace = await traceBlob(avatarUrl, "cache", blob);
          const valid = isValidImageBlob(trace?.magic ?? null, trace?.decodeOk ?? null);
          if (!valid) {
            await cache.delete(request);
          } else if (!cancelled) {
            const objectUrl = URL.createObjectURL(blob);
            updateObjectUrl(objectUrl);
            lastSourceRef.current = avatarUrl;
            return;
          }
        }
      }

      const blob = await fetchAvatarBlob(avatarUrl);
      if (!blob) {
        if (!cancelled) updateObjectUrl(null);
        return;
      }
      const normalizedBlob = normalizeImageBlob(blob);
      const trace = await traceBlob(avatarUrl, "fetch", normalizedBlob);
      const valid = isValidImageBlob(trace?.magic ?? null, trace?.decodeOk ?? null);
      if (!valid) {
        if (!cancelled) updateObjectUrl(null);
        return;
      }
      await storeAvatarResponse(request, avatarUrl, normalizedBlob);
      if (!cancelled) {
        const objectUrl = URL.createObjectURL(normalizedBlob);
        updateObjectUrl(objectUrl);
        lastSourceRef.current = avatarUrl;
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [avatarUrl, userId]);

  useEffect(() => {
    const prevUserId = lastUserIdRef.current;
    if (prevUserId && userId && prevUserId !== userId) {
      deleteAvatarCache(prevUserId);
    }
    lastUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    const prevSource = lastSourceRef.current;
    if (!userId || !avatarUrl) return;
    if (prevSource && prevSource !== avatarUrl) {
      deleteAvatarCache(userId);
    }
  }, [avatarUrl, userId]);

  useEffect(() => {
    return () => {
      const current = objectUrlRef.current;
      if (current) URL.revokeObjectURL(current);
    };
  }, []);

  return useMemo(
    () => cachedUrl ?? avatarUrl ?? null,
    [cachedUrl, avatarUrl],
  );
};
