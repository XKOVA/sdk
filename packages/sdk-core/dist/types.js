/**
 * Default scopes used when no override is provided.
 *
 * @remarks
 * Purpose:
 * - Provide the standard scope set requested by SDK helpers.
 *
 * When to use:
 * - Use when constructing authorize URLs or OAuthService options without custom scope needs.
 *
 * When not to use:
 * - Do not use if your app requires a narrower scope set; pass explicit scopes instead.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Constant array of scope strings.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Contains all scopes required by default SDK flows.
 *
 * Data/auth references:
 * - OAuth `/oauth/authorize` and `/oauth/token` scope parameters.
 */
export const DEFAULT_SCOPES = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'account:read',
    'account:manage',
    'contacts:read',
    'contacts:manage',
    'payments:read',
    'payments:execute',
    'transfers',
    'agents:read',
    'agents:manage',
];
