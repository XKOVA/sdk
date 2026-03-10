import type { UserInfo } from "@xkova/sdk-core";
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
export declare const useCachedAvatarUrl: (user: UserInfo | null) => string | null;
