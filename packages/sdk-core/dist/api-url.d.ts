/**
 * Normalize and validate the apps/api host origin.
 *
 * @remarks
 * Purpose:
 * - Enforce that apps/api base hosts are provided explicitly and are origin-only.
 *
 * When to use:
 * - Use in headless SDK helpers that need a stable apps/api base URL.
 *
 * When not to use:
 * - Do not use to validate OAuth protocol hosts; use normalizeOAuthBaseUrl instead.
 *
 * Parameters:
 * - `input`: Absolute host URL (origin). Nullable: no.
 *
 * Return semantics:
 * - Returns the normalized origin string (scheme + host).
 *
 * Errors/failure modes:
 * - Throws ValidationError when input is empty, invalid, or includes a non-/api path.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Returns origin without a trailing slash.
 * - Allows `/api` or `/api/v{n}` suffixes and strips them.
 *
 * Data/auth references:
 * - Used to construct apps/api base URLs for SDK clients.
 */
export declare const normalizeApiHost: (input: string) => string;
/**
 * Resolve a canonical apps/api base URL from a host origin.
 *
 * @remarks
 * Purpose:
 * - Build a stable `/api/{version}` base for apps/api clients.
 *
 * When to use:
 * - Use in headless SDK factories to avoid manual string concatenation.
 *
 * When not to use:
 * - Do not call with ambiguous inputs (for example, OAuth protocol hosts).
 *
 * Parameters:
 * - `apiHost`: Absolute host origin (no path). Nullable: no.
 * - `apiVersion`: Optional API version segment (default: API_VERSION). Nullable: yes.
 *
 * Return semantics:
 * - Returns `${origin}/api/${version}`.
 *
 * Errors/failure modes:
 * - Throws ValidationError when apiHost or apiVersion is invalid.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - apiVersion is a non-empty string.
 */
export declare const resolveApiBaseUrl: (options: {
    apiHost: string;
    apiVersion?: string;
}) => string;
