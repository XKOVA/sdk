import { useEffect, useMemo, useRef, useState } from "react";
import { useSDK } from "./provider.js";
const CACHE_NAME = "xkova-avatar-proxy-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AVATAR_TRACE = true;
const canUseCache = () => typeof window !== "undefined" && typeof caches !== "undefined";
const buildCacheRequest = (cacheKey) => new Request(`https://xkova.local/avatar-proxy/${encodeURIComponent(cacheKey)}`);
const getCachedAt = (response) => {
    const raw = response.headers.get("x-xkova-cached-at");
    if (!raw)
        return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
};
const getCachedSource = (response) => {
    const raw = response.headers.get("x-xkova-source");
    return raw ? raw : null;
};
const normalizeImageBlob = (blob) => {
    const rawType = blob.type || "";
    if (!rawType)
        return blob;
    const normalized = rawType.split(";")[0]?.trim() || "";
    if (!normalized || normalized === rawType)
        return blob;
    return new Blob([blob], { type: normalized });
};
const toHex = (bytes) => Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
const readMagicBytes = async (blob) => {
    try {
        const buf = await blob.slice(0, 4).arrayBuffer();
        return toHex(new Uint8Array(buf));
    }
    catch {
        return null;
    }
};
const isLikelyImageMagic = (magic) => {
    if (!magic)
        return false;
    const normalized = magic.toLowerCase();
    return (normalized.startsWith("ff d8 ff") || // jpeg
        normalized.startsWith("89 50 4e 47") || // png
        normalized.startsWith("47 49 46 38") || // gif
        normalized.startsWith("52 49 46 46") // riff (webp)
    );
};
const isValidImageBlob = (magic, decodeOk) => {
    if (decodeOk === true)
        return true;
    if (decodeOk === false)
        return false;
    return isLikelyImageMagic(magic);
};
const traceBlob = async (sourceUrl, source, blob) => {
    if (!AVATAR_TRACE || typeof window === "undefined") {
        return { magic: null, decodeOk: null };
    }
    const magic = await readMagicBytes(blob);
    let decodeOk = null;
    if (typeof globalThis.createImageBitmap === "function") {
        try {
            await globalThis.createImageBitmap(blob);
            decodeOk = true;
        }
        catch {
            decodeOk = false;
        }
    }
    return { magic, decodeOk };
};
const storeAvatarResponse = async (request, sourceUrl, blob) => {
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
const deleteAvatarCache = async (cacheKey) => {
    if (!canUseCache())
        return;
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(buildCacheRequest(cacheKey));
};
/**
 * Cache and resolve proxy avatar URLs (API-authenticated) as blob URLs.
 *
 * @remarks
 * Purpose:
 * - Fetch avatars from XKOVA API endpoints that require auth headers.
 * - Return a blob URL suitable for <img> tags (no auth headers required).
 *
 * Behavior:
 * - Only fetches when the URL matches the API base URL.
 * - Caches avatar bytes for up to 24 hours (TTL).
 * - Revokes previous blob URLs when replaced or on unmount.
 *
 * Return semantics:
 * - Returns a blob URL when cached, otherwise the original URL.
 */
export const useCachedProxyAvatarUrl = (sourceUrl) => {
    const { apiBaseUrl, getAccessToken, state } = useSDK();
    const [cachedUrl, setCachedUrl] = useState(null);
    const objectUrlRef = useRef(null);
    const getAccessTokenRef = useRef(getAccessToken);
    const lastSourceRef = useRef(null);
    const lastCacheKeyRef = useRef(null);
    const normalizedBase = (apiBaseUrl ?? "").replace(/\/+$/, "");
    const shouldProxy = typeof sourceUrl === "string" &&
        sourceUrl.length > 0 &&
        (sourceUrl.includes("/api/v1/users/") ||
            (normalizedBase.length > 0 && sourceUrl.startsWith(normalizedBase)));
    const cacheKey = shouldProxy && sourceUrl ? sourceUrl : null;
    useEffect(() => {
        getAccessTokenRef.current = getAccessToken;
    }, [getAccessToken]);
    const updateObjectUrl = (next) => {
        const prev = objectUrlRef.current;
        if (prev === next)
            return;
        if (prev && prev !== next) {
            URL.revokeObjectURL(prev);
        }
        objectUrlRef.current = next;
        setCachedUrl((current) => (current === next ? current : next));
    };
    useEffect(() => {
        const cacheAvailable = canUseCache();
        if (!shouldProxy || !sourceUrl || state.status !== "authenticated") {
            updateObjectUrl(null);
            return;
        }
        let cancelled = false;
        const request = cacheAvailable && cacheKey ? buildCacheRequest(cacheKey) : null;
        const hydrate = async () => {
            if (cacheAvailable && request) {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(request);
                if (cachedResponse) {
                    const cachedAt = getCachedAt(cachedResponse);
                    const cachedSource = getCachedSource(cachedResponse);
                    const isFresh = cachedAt !== null ? Date.now() - cachedAt < CACHE_TTL_MS : false;
                    const sourceMatches = cachedSource === sourceUrl;
                    if (isFresh && sourceMatches) {
                        const blob = normalizeImageBlob(await cachedResponse.blob());
                        const trace = await traceBlob(sourceUrl, "cache", blob);
                        const valid = isValidImageBlob(trace?.magic ?? null, trace?.decodeOk ?? null);
                        if (!valid) {
                            await cache.delete(request);
                        }
                        else if (!cancelled) {
                            const objectUrl = URL.createObjectURL(blob);
                            updateObjectUrl(objectUrl);
                            lastSourceRef.current = sourceUrl;
                            if (cacheKey)
                                lastCacheKeyRef.current = cacheKey;
                            return;
                        }
                    }
                }
            }
            const accessToken = await getAccessTokenRef.current();
            if (!accessToken) {
                if (!cancelled)
                    updateObjectUrl(null);
                return;
            }
            try {
                const res = await fetch(sourceUrl, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${accessToken}` },
                    credentials: "omit",
                });
                if (!res.ok) {
                    if (!cancelled)
                        updateObjectUrl(null);
                    return;
                }
                const blob = normalizeImageBlob(await res.blob());
                const trace = await traceBlob(sourceUrl, "fetch", blob);
                const valid = isValidImageBlob(trace?.magic ?? null, trace?.decodeOk ?? null);
                if (!valid) {
                    if (!cancelled)
                        updateObjectUrl(null);
                    return;
                }
                if (cacheAvailable && request) {
                    await storeAvatarResponse(request, sourceUrl, blob);
                }
                if (!cancelled) {
                    const objectUrl = URL.createObjectURL(blob);
                    updateObjectUrl(objectUrl);
                    lastSourceRef.current = sourceUrl;
                    if (cacheKey)
                        lastCacheKeyRef.current = cacheKey;
                }
            }
            catch {
                if (!cancelled)
                    updateObjectUrl(null);
            }
        };
        hydrate();
        return () => {
            cancelled = true;
        };
    }, [cacheKey, shouldProxy, sourceUrl, state.status]);
    useEffect(() => {
        const prevKey = lastCacheKeyRef.current;
        if (prevKey && cacheKey && prevKey !== cacheKey) {
            deleteAvatarCache(prevKey);
        }
    }, [cacheKey]);
    useEffect(() => {
        const prevSource = lastSourceRef.current;
        if (!cacheKey || !sourceUrl)
            return;
        if (prevSource && prevSource !== sourceUrl) {
            deleteAvatarCache(cacheKey);
        }
    }, [cacheKey, sourceUrl]);
    useEffect(() => {
        return () => {
            const current = objectUrlRef.current;
            if (current)
                URL.revokeObjectURL(current);
        };
    }, []);
    return useMemo(() => {
        if (!shouldProxy)
            return sourceUrl;
        return cachedUrl ?? null;
    }, [cachedUrl, shouldProxy, sourceUrl]);
};
