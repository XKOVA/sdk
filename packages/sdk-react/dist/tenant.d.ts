import { type AccountState, type BootstrapPayload } from "@xkova/sdk-core";
/**
 * Return tenant configuration and bootstrap data from SDK state.
 *
 * @remarks
 * Purpose:
 * - Provide tenant metadata, networks, tokens, and transfer providers for UI.
 *
 * When to use:
 * - Use in components that need tenant branding or network configuration.
 *
 * When not to use:
 * - Do not use as a substitute for server-side tenant configuration checks.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ tenant, networks, tokens, branding, version, transferProviders, isLoading, error }`.
 *
 * Errors/failure modes:
 * - None; errors are surfaced from SDK auth state.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `networks`, `tokens`, and `transferProviders` are arrays with stable empty fallbacks.
 *
 * Data/auth references:
 * - Derived from OAuth bootstrap (`/oauth/tenant`) and auth state.
 */
export declare const useTenantConfig: () => {
    tenant: import("@xkova/sdk-core").TenantConfig | null;
    networks: import("@xkova/sdk-core").TenantNetwork[];
    tokens: import("@xkova/sdk-core").TokenAsset[];
    branding: undefined;
    version: string | undefined;
    transferProviders: any;
    isLoading: boolean;
    error: Error | undefined;
};
/**
 * Reload tenant bootstrap data for the authenticated user.
 *
 * @remarks
 * Purpose:
 * - Provide a manual refresh hook for tenant config and bootstrap state.
 *
 * When to use:
 * - Use after tenant settings change (branding, networks, tokens) or after profile edits
 *   that need a fresh bootstrap snapshot.
 *
 * When not to use:
 * - Do not use when unauthenticated; `reload` throws if no active session exists.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ reload, isLoading, error }`.
 * - `reload` resolves to the latest BootstrapPayload.
 *
 * Errors/failure modes:
 * - `reload` throws when unauthenticated or when bootstrap refresh fails.
 * - `error` captures the most recent reload failure.
 *
 * Side effects:
 * - Fetches OAuth bootstrap data and updates SDK provider state.
 *
 * Invariants/assumptions:
 * - Requires an authenticated session with a valid access token.
 *
 * Data/auth references:
 * - Uses OAuth bootstrap endpoints via `oauth.fetchBootstrap`.
 *
 * @example
 * const { reload } = useTenantReload();
 */
export declare const useTenantReload: () => {
    reload: () => Promise<BootstrapPayload>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Fetch the authenticated account state (primary account).
 *
 * @remarks
 * Purpose:
 * - Provide account state with a refresh helper.
 * - Use bootstrap state when available for fast reads.
 *
 * When to use:
 * - Use when you need account state in React components.
 *
 * When not to use:
 * - Do not use when unauthenticated; `refresh` will throw.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ accountState, account, isLoading, error, refresh }`.
 * - `account` is null when unauthenticated.
 *
 * Errors/failure modes:
 * - `refresh` throws when the account endpoint is unavailable or unauthorized.
 *
 * Side effects:
 * - `refresh` performs OAuth requests and updates local state.
 * - Subscribes to `account` invalidations.
 *
 * Invariants/assumptions:
 * - `refresh` requires `account:read` scope.
 *
 * Data/auth references:
 * - `/account` (oauth-server, bearer token).
 * - Uses bootstrap data from `/oauth/user` when present.
 *
 * @example
 * const { account, refresh } = useAccountState();
 *
 * @see /account
 * @see /oauth/user
 */
export declare const useAccountState: () => {
    accountState: AccountState | null;
    account: string | null;
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<AccountState>;
};
