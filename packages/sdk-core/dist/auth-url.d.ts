export interface NormalizeTenantAuthBaseUrlOptions {
    /**
     * Optional protocol override for localhost/host-only values.
     * Defaults to http: for localhost and https: for non-localhost hosts.
     */
    defaultProtocol?: string;
}
/**
 * Normalize a tenant auth domain into an absolute origin.
 *
 * @remarks
 * Purpose:
 * - Convert tenant auth-domain values (host-only or absolute URL) into a usable origin.
 *
 * Parameters:
 * - `authDomain`: Tenant auth domain (host-only or absolute URL).
 * - `options.defaultProtocol`: Optional protocol override for host-only inputs.
 *
 * Return semantics:
 * - Returns an origin string like `https://auth.example.com` or `http://localhost:3000`.
 * - Returns null when the input is empty.
 *
 * Errors/failure modes:
 * - Best-effort parsing; invalid absolute URLs fall back to trimmed input.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Returned origin does not include a trailing slash.
 */
export declare const normalizeTenantAuthBaseUrl: (authDomain: string | null | undefined, options?: NormalizeTenantAuthBaseUrlOptions) => string | null;
export interface HostedEmailChangeUrlParams {
    /**
     * Tenant auth domain (host-only or absolute URL).
     */
    authDomain: string;
    /**
     * Optional return target after completion.
     */
    returnTo?: string | null;
    /**
     * Optional path override (default: /email-change).
     */
    path?: string;
    /**
     * Optional protocol override for host-only inputs (localhost use cases).
     */
    defaultProtocol?: string;
}
export interface HostedHandleChangeUrlParams {
    /**
     * Tenant auth domain (host-only or absolute URL).
     */
    authDomain: string;
    /**
     * Optional return target after completion.
     */
    returnTo?: string | null;
    /**
     * Optional path override (default: /change-handle).
     */
    path?: string;
    /**
     * Optional protocol override for host-only inputs (localhost use cases).
     */
    defaultProtocol?: string;
}
/**
 * Build a hosted email-change URL on the tenant auth domain.
 *
 * @remarks
 * Purpose:
 * - Construct a stable hosted email-change URL for browser navigation.
 *
 * Parameters:
 * - `authDomain`: Tenant auth domain (host-only or absolute URL). Required.
 * - `returnTo`: Optional return URL passed as `return_to` query param.
 * - `path`: Optional path override (defaults to `/email-change`).
 * - `defaultProtocol`: Optional protocol override for host-only inputs.
 *
 * Return semantics:
 * - Returns an absolute URL string.
 *
 * Errors/failure modes:
 * - Throws ValidationError when `authDomain` is missing or invalid.
 *
 * Side effects:
 * - None.
 */
export declare const resolveHostedEmailChangeUrl: (params: HostedEmailChangeUrlParams) => string;
/**
 * Build a hosted handle-change URL on the tenant auth domain.
 *
 * @remarks
 * Purpose:
 * - Construct a stable hosted handle-change URL for browser navigation.
 *
 * Parameters:
 * - `authDomain`: Tenant auth domain (host-only or absolute URL). Required.
 * - `returnTo`: Optional return URL passed as `return_to` query param.
 * - `path`: Optional path override (defaults to `/change-handle`).
 * - `defaultProtocol`: Optional protocol override for host-only inputs.
 *
 * Return semantics:
 * - Returns an absolute URL string.
 *
 * Errors/failure modes:
 * - Throws ValidationError when `authDomain` is missing or invalid.
 *
 * Side effects:
 * - None.
 */
export declare const resolveHostedHandleChangeUrl: (params: HostedHandleChangeUrlParams) => string;
