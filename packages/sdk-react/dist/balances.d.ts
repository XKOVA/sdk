import { type TenantNetwork, type TokenAsset } from "@xkova/sdk-core";
/**
 * Options for {@link useHumanBalance}.
 *
 * @remarks
 * Purpose:
 * - Control whether human balance fetching is enabled.
 *
 * When to use:
 * - Use to disable balance fetching until UI is ready.
 *
 * When not to use:
 * - Do not rely on this for server-side rendering; the hook is client-only.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns null balance.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `enabled` defaults to true when omitted.
 *
 * Data/auth references:
 * - Controls RPC proxy usage for balances.
 */
export interface HumanBalanceOptions {
    enabled?: boolean;
}
/**
 * Display-ready balance payload for human UI.
 *
 * @remarks
 * Purpose:
 * - Describe the primary balance in a human-friendly format.
 *
 * When to use:
 * - Use when rendering balance text or icons in UI.
 *
 * When not to use:
 * - Do not use for on-chain calculations; use raw bigint values instead.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `amountText` is a localized string.
 *
 * Data/auth references:
 * - Derived from token metadata and RPC balance data.
 */
export interface HumanBalanceDisplay {
    amountText: string;
    isStable: boolean;
    symbol?: string;
    logoUrl?: string;
}
/**
 * State returned by {@link useHumanBalance}.
 *
 * @remarks
 * Purpose:
 * - Provide the current human balance plus loading and error state.
 *
 * When to use:
 * - Use to render balance UI with loading indicators.
 *
 * When not to use:
 * - Do not use for background polling outside UI components.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures errors in `error` and returns null balance.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `balance` is null when unauthenticated or unavailable.
 *
 * Data/auth references:
 * - Derived from OAuth bootstrap and RPC proxy calls.
 */
export interface HumanBalanceState {
    balance: HumanBalanceDisplay | null;
    isLoading: boolean;
    error: Error | null;
}
/**
 * Resolve a display-friendly primary balance for Human UI components.
 *
 * @remarks
 * Purpose:
 * - Fetch the primary account balance for the tenant primary token/network.
 *
 * When to use:
 * - Use to show a single headline balance in Human UI components.
 *
 * When not to use:
 * - Do not use when you need full token lists; use useTokenBalances instead.
 *
 * Parameters:
 * - `options.enabled`: Toggle balance fetching. Nullable: yes.
 *
 * Return semantics:
 * - Returns a balance display payload (or null) plus loading and error state.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns null.
 *
 * Side effects:
 * - Issues RPC proxy requests via `createTenantNetworkClient` when enabled.
 *
 * Invariants/assumptions:
 * - Requires authenticated state, a resolved tenant network, and an account.
 *
 * Data/auth references:
 * - Uses `/api/v1/rpc/proxy` via the SDK core network client.
 *
 * @example
 * const { balance } = useHumanBalance({ enabled: showBalance });
 *
 * @see useAccountState
 * @see useTenantConfig
 */
export declare const useHumanBalance: (options?: HumanBalanceOptions) => HumanBalanceState;
/**
 * Token balance entry returned by balance hooks.
 *
 * @remarks
 * Purpose:
 * - Provide token metadata and raw balance for rendering.
 *
 * When to use:
 * - Use when rendering token balance lists in UI.
 *
 * When not to use:
 * - Do not use for precise accounting; use raw bigint values and token metadata.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - DTO only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns an empty balance list.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `value` is base units (wei for native, token base units for ERC20).
 *
 * Data/auth references:
 * - Derived from RPC proxy responses.
 *
 * @example
 * { token: { symbol: "USDC", decimals: 6 }, value: 1000000n, isNative: false }
 */
export interface TokenBalanceEntry {
    token: TokenAsset | {
        symbol: string;
        decimals: number;
        contract?: string;
        isStable?: boolean;
        logoUrl?: string;
    };
    value: bigint;
    isNative: boolean;
}
/**
 * Options for balance list queries.
 *
 * @remarks
 * Purpose:
 * - Configure balance fetching for the primary account.
 *
 * When to use:
 * - Use when you need to toggle native balances or polling.
 *
 * When not to use:
 * - Do not use to change which account is queried; use useAccountState instead.
 *
 * Parameters:
 * - `showNative`: Include native balance when true. Nullable: yes.
 * - `refreshMs`: Polling interval in ms (polling fallback only when realtime is unavailable). Nullable: yes.
 *
 * Return semantics:
 * - DTO only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns null balance.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Omit `refreshMs` for no polling.
 *
 * Data/auth references:
 * - None.
 */
export interface TokenBalancesOptions {
    showNative?: boolean;
    refreshMs?: number;
}
/**
 * State returned by balance list hooks.
 *
 * @remarks
 * Purpose:
 * - Provide balances plus loading, error, and refresh controls.
 *
 * When to use:
 * - Use as the return type for balance list hooks.
 *
 * When not to use:
 * - Do not persist this object; values are derived from React state.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - DTO only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns an empty balance list.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `refresh` triggers a best-effort refetch.
 *
 * Data/auth references:
 * - Derived from RPC proxy responses.
 */
export interface TokenBalancesState {
    balances: TokenBalanceEntry[];
    isLoading: boolean;
    account: string | null;
    accountLoading: boolean;
    configLoading: boolean;
    refresh: () => void;
    error: Error | null;
}
/**
 * Fetch token balances for the primary account.
 *
 * @remarks
 * Purpose:
 * - Retrieve native and ERC20 balances for tenant-approved tokens.
 *
 * When to use:
 * - Use when you need balance lists for the primary account.
 *
 * When not to use:
 * - Do not use when unauthenticated or without tenant network config.
 *
 * Parameters:
 * - `options.showNative`: Include native token balance when true. Nullable: yes.
 * - `options.refreshMs`: Optional polling interval in ms (polling fallback only when realtime is unavailable). Nullable: yes.
 *
 * Return semantics:
 * - Returns token balances plus loading, error, and refresh helpers.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns empty or partial results.
 *
 * Side effects:
 * - Issues RPC proxy requests via `createTenantNetworkClient`.
 * - Registers a `balances` invalidation listener.
 *
 * Invariants/assumptions:
 * - Requires tenant networks and tokens from bootstrap.
 *
 * Data/auth references:
 * - Uses `/api/v1/rpc/proxy` via the SDK core network client.
 *
 * @example
 * const { balances, refresh } = useTokenBalances({ showNative: true });
 *
 * @see useAccountState
 * @see useTenantConfig
 */
export declare const useTokenBalances: (options?: TokenBalancesOptions) => TokenBalancesState;
/**
 * Snapshot of a single token balance.
 *
 * @remarks
 * Purpose:
 * - Provide raw balance data for a selected token.
 *
 * When to use:
 * - Use for token picker or send-form previews.
 *
 * When not to use:
 * - Do not use for full balance lists; use TokenBalanceEntry instead.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - DTO only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns null balance.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `value` is base units for the token.
 *
 * Data/auth references:
 * - Derived from RPC proxy responses.
 */
export interface TokenBalanceSnapshot {
    value: bigint;
    decimals: number;
    symbol?: string;
    isStable?: boolean;
    logoUrl?: string;
}
/**
 * Options for a single-token balance lookup.
 *
 * @remarks
 * Purpose:
 * - Configure balance fetching for a specific token selection.
 *
 * When to use:
 * - Use when wiring single-token balance lookups in forms.
 *
 * When not to use:
 * - Do not use when you need to fetch all balances; use TokenBalancesOptions instead.
 *
 * Parameters:
 * - `account`: Sender account identifier. Nullable: yes.
 * - `network`: Tenant-selected network. Nullable: yes.
 * - `selectedContract`: Selected token contract or "native". Nullable: no.
 * - `selectedToken`: Selected token metadata for ERC20 reads. Nullable: yes.
 * - `includeNative`: Whether native balance is permitted. Nullable: yes.
 *
 * Return semantics:
 * - DTO only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns null balance.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `selectedContract` is "native" for native reads.
 *
 * Data/auth references:
 * - None.
 */
export interface TokenBalanceOptions {
    account: string | null;
    network: TenantNetwork | null;
    selectedContract: string;
    selectedToken: TokenAsset | null;
    includeNative?: boolean;
}
/**
 * State returned by single-token balance hooks.
 *
 * @remarks
 * Purpose:
 * - Provide balance data plus loading, error, and refresh controls.
 *
 * When to use:
 * - Use as the return type for useTokenBalance.
 *
 * When not to use:
 * - Do not persist; values are derived from React state.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - DTO only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns null balance.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `refresh` triggers a best-effort refetch.
 *
 * Data/auth references:
 * - Derived from RPC proxy responses.
 */
export interface TokenBalanceState {
    balance: TokenBalanceSnapshot | null;
    isLoading: boolean;
    refresh: () => void;
    error: Error | null;
}
/**
 * Fetch the balance for a selected token or native asset.
 *
 * @remarks
 * Purpose:
 * - Resolve a single balance for send forms and token pickers.
 *
 * When to use:
 * - Use when you need a balance for a specific selected token.
 *
 * When not to use:
 * - Do not use when you need all balances; use useTokenBalances instead.
 *
 * Parameters:
 * - `options.account`: Sender account identifier. Nullable: yes.
 * - `options.network`: Tenant-selected network. Nullable: yes.
 * - `options.selectedContract`: Selected token contract or "native". Nullable: no.
 * - `options.selectedToken`: Selected token metadata for ERC20 reads. Nullable: yes.
 * - `options.includeNative`: Whether native balance is permitted. Nullable: yes.
 *
 * Return semantics:
 * - Returns a balance snapshot plus loading and error state.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns null balance.
 *
 * Side effects:
 * - Issues RPC proxy requests via `createTenantNetworkClient`.
 * - Registers a `balances` invalidation listener.
 *
 * Invariants/assumptions:
 * - `selectedContract` must be "native" to read native balance.
 *
 * Data/auth references:
 * - Uses `/api/v1/rpc/proxy` via the SDK core network client.
 *
 * @example
 * const { balance } = useTokenBalance({ account, network, selectedContract, selectedToken });
 *
 * @see useTokenBalances
 */
export declare const useTokenBalance: (options: TokenBalanceOptions) => TokenBalanceState;
