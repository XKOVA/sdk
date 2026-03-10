/**
 * Normalize a tenant auth domain into an absolute origin.
 *
 * @remarks
 * Purpose:
 * - Convert `tenant.authDomain` (typically a host like `auth.mytenant.com`) into an origin
 *   suitable for browser navigation and cross-origin fetch calls.
 *
 * Parameters:
 * - `authDomain`: Tenant auth domain as returned by `/oauth/tenant` (may be host-only or absolute URL).
 *
 * Return semantics:
 * - Returns an origin string like `https://auth.mytenant.com` or `http://localhost:3000`.
 * - Returns null when the input is empty.
 *
 * Errors/failure modes:
 * - Best-effort parsing; invalid absolute URLs fall back to trimming.
 *
 * Side effects:
 * - Reads `window.location.protocol` when available (helps localhost / http dev).
 *
 * Invariants/assumptions:
 * - `authDomain` does not include a path when it is host-only.
 */
export declare const normalizeTenantAuthBaseUrl: (authDomain: string | null | undefined) => string | null;
