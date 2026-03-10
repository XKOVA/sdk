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
export declare const useCachedProxyAvatarUrl: (sourceUrl: string | null) => string | null;
