import { TenantNetwork, TokenAsset } from './types.js';
/**
 * Network client configuration for RPC access.
 *
 * @remarks
 * Purpose:
 * - Configure EVMClient with tenant-approved network metadata and proxy settings.
 *
 * When to use:
 * - Use when constructing an EVMClient for direct or proxy RPC access.
 *
 * When not to use:
 * - Do not use untrusted network metadata; always use tenant bootstrap data.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `network` is tenant-scoped; `apiBaseUrl` is required for proxy usage.
 *
 * @property network - Tenant-approved network metadata (includes rpcUrl + networkId).
 * @property fetchImpl - Optional fetch override (browser or Node).
 * @property apiBaseUrl - API host origin for proxy routing (nullable; required for proxy usage).
 * @property forceProxy - Forces RPC proxy usage. Required for browser contexts.
 * @property getAccessToken - Optional bearer token getter for authenticated proxy requests (nullable).
 *
 * @example
 * { "network": { "networkId": "43113", "rpcUrl": "https://..." }, "apiBaseUrl": "https://api.xkova.com" }
 * Data/auth references:
 * - Uses tenant bootstrap `/oauth/tenant` network metadata and apps/api RPC proxy.
 */
export interface NetworkClientConfig {
    network: TenantNetwork;
    fetchImpl?: typeof fetch;
    /** API host origin (e.g., https://api-local.xkova.com). */
    apiBaseUrl?: string;
    /** Force use of RPC proxy (required in browser contexts). */
    forceProxy?: boolean;
    /** Function to get access token for authenticated RPC proxy requests */
    getAccessToken?: () => string | null | Promise<string | null>;
}
/**
 * Minimal JSON-RPC client that keeps provider details private.
 *
 * @remarks
 * Purpose:
 * - Issue tenant-scoped RPC calls with optional API proxy routing.
 *
 * When to use:
 * - Use when you need RPC access for tenant networks without exposing raw providers.
 *
 * When not to use:
 * - Do not use with arbitrary networks outside tenant bootstrap configuration.
 *
 * Parameters:
 * - `config`: Network client configuration. Nullable: no.
 *
 * Return semantics:
 * - Constructs an EVMClient instance; network calls happen on request().
 *
 * Errors/failure modes:
 * - Throws ValidationError when rpcUrl is missing or proxy is misconfigured.
 *
 * Side effects:
 * - Performs network requests on request(), getNativeBalance(), etc.
 *
 * Invariants/assumptions:
 * - `rpcUrl` is non-empty; proxy requests include numeric `networkId` when available.
 *
 * Data/auth references:
 * - Uses apps/api `/api/v1/rpc/proxy` when proxying.
 *
 * @example
 * const client = new EVMClient({ network, apiBaseUrl });
 *
 * @see /api/v1/rpc/proxy
 */
export declare class EVMClient {
    private rpcUrl;
    private fetchImpl;
    private useProxy;
    private proxyUrl;
    private networkId;
    private getAccessToken?;
    constructor(config: NetworkClientConfig);
    /**
     * Builds the RPC proxy URL from the API base URL
     */
    private buildProxyUrl;
    request<T>(method: string, params?: unknown[]): Promise<T>;
    /**
     * Makes a direct RPC call to the blockchain provider
     */
    private requestDirect;
    /**
     * Makes an RPC call through the API server's RPC proxy
     */
    private requestViaProxy;
    getNativeBalance(account: string): Promise<bigint>;
    getErc20Balance(account: string, tokenContract: string): Promise<bigint>;
}
/**
 * Public smart account handle for SDK consumers.
 *
 * @remarks
 * Purpose:
 * - Represent a tenant-approved smart account and its local helper actions.
 *
 * When to use:
 * - Use when working with smart account identifiers returned by the SDK.
 *
 * When not to use:
 * - Do not construct manually; prefer handles created by SDK helpers.
 *
 * Return semantics:
 * - Interface only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `account` is a 0x-prefixed identifier.
 *
 * Data/auth references:
 * - Derived from tenant bootstrap network metadata.
 *
 * Notes:
 * - Exposes agentPass helpers instead of legacy session key naming.
 *
 * @property account - Smart account identifier (0x-prefixed).
 * @property network - Tenant network metadata for this account.
 * @property client - RPC client bound to the tenant network.
 * @property agentPasses - Local in-memory agentPass identifiers (optional).
 * @property installAgentPass - Tracks an agentPass locally for this handle.
 * @property disconnect - Clears local agentPass state.
 */
export interface SmartAccountHandle {
    account: string;
    network: TenantNetwork;
    client: EVMClient;
    agentPasses: string[];
    installAgentPass(agentPass: string): Promise<void>;
    disconnect(): Promise<void>;
}
/**
 * Creates a basic EOA account descriptor linked to OAuth identity.
 *
 * @remarks
 * Purpose:
 * - Provide a minimal account descriptor for externally owned accounts.
 *
 * When to use:
 * - Use in advanced flows where EOAs are managed outside the standard OAuth responses.
 *
 * When not to use:
 * - Prefer smart account handles returned by the SDK for normal user flows.
 *
 * Parameters:
 * - `network`: Tenant-approved network metadata. Nullable: no.
 * - `account`: EOA account identifier (0x-prefixed). Nullable: no.
 *
 * Return semantics:
 * - Returns an EOA descriptor with network metadata.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `account` is 0x-prefixed.
 *
 * Data/auth references:
 * - Uses tenant network metadata from `/oauth/tenant`.
 *
 * Notes:
 * - EOAs are not included in standard OAuth responses, but are supported for advanced flows.
 *
 * @example
 * const eoa = createOAuthEOAAccount(network, "0xabc...");
 */
export declare const createOAuthEOAAccount: (network: TenantNetwork, account: string) => {
    account: string;
    network: TenantNetwork;
};
/**
 * Clears any agentPass state for the handle.
 *
 * @remarks
 * Purpose:
 * - Reset local agentPass state for a smart account handle.
 *
 * When to use:
 * - Use when the user logs out or when you want to discard cached agent passes.
 *
 * When not to use:
 * - Do not use to revoke server-side agent passes; call the appropriate API instead.
 *
 * Parameters:
 * - `accountHandle`: Smart account handle to clear. Nullable: no.
 *
 * Return semantics:
 * - Resolves after local cleanup completes.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Mutates in-memory agentPass list.
 *
 * Invariants/assumptions:
 * - Does not affect server-side state.
 *
 * Data/auth references:
 * - None; local-only operation.
 */
export declare const disconnectSmartAccount: (accountHandle: SmartAccountHandle) => Promise<void>;
/**
 * Reports a smart account to the backend without exposing transport details.
 *
 * @remarks
 * Purpose:
 * - Delegate smart account registration to a backend callback.
 *
 * When to use:
 * - Use when you need to report a smart account to your backend after creation.
 *
 * When not to use:
 * - Do not call if your backend does not support smart account registration.
 *
 * Parameters:
 * - `register`: Backend registration function. Nullable: no.
 * - `accountHandle`: Account descriptor with network metadata. Nullable: no.
 *
 * Return semantics:
 * - Resolves after the backend registration completes.
 *
 * Errors/failure modes:
 * - Propagates registration errors from the provided handler.
 *
 * Side effects:
 * - Calls the provided registration callback.
 *
 * Invariants/assumptions:
 * - Uses tenant network identifiers for reporting.
 *
 * Data/auth references:
 * - Backend registration is implementation-specific.
 */
export declare const reportSmartAccountToBackend: (register: (input: {
    account: string;
    networkId: string;
}) => Promise<unknown>, accountHandle: {
    account: string;
    networkId?: string;
    network: TenantNetwork;
}) => Promise<void>;
/**
 * Installs an agentPass on the account handle and optionally reports it.
 *
 * @remarks
 * Purpose:
 * - Track agentPass identifiers locally and optionally report them upstream.
 *
 * When to use:
 * - Use after receiving a new agentPass to keep local state in sync.
 *
 * When not to use:
 * - Do not use to grant permissions; agentPass issuance is handled server-side.
 *
 * Parameters:
 * - `accountHandle`: Smart account handle to update. Nullable: no.
 * - `agentPass`: AgentPass identifier to register locally. Nullable: no.
 * - `reporter`: Optional callback to report the agentPass upstream. Nullable: yes.
 *
 * Return semantics:
 * - Resolves with the agentPass identifier that was installed.
 *
 * Errors/failure modes:
 * - Propagates reporter errors when provided.
 *
 * Side effects:
 * - Mutates in-memory agentPass list and optionally calls reporter.
 *
 * Invariants/assumptions:
 * - Returns the same agentPass passed in.
 *
 * Data/auth references:
 * - Reporting is implementation-specific and may involve apps/api endpoints.
 */
export declare const installAgentPass: (accountHandle: SmartAccountHandle, agentPass: string, reporter?: (key: string) => Promise<unknown>) => Promise<string>;
/**
 * Reports an agentPass to the backend.
 *
 * @remarks
 * Purpose:
 * - Delegate agentPass registration to a backend callback.
 *
 * When to use:
 * - Use when your backend needs to be notified of newly issued agent passes.
 *
 * When not to use:
 * - Do not call if you do not maintain server-side agentPass records.
 *
 * Parameters:
 * - `register`: Backend registration function. Nullable: no.
 * - `agentPass`: AgentPass identifier to register. Nullable: no.
 *
 * Return semantics:
 * - Resolves after the backend registration completes.
 *
 * Errors/failure modes:
 * - Propagates registration errors from the provided handler.
 *
 * Side effects:
 * - Calls the provided registration callback.
 *
 * Invariants/assumptions:
 * - Does not mutate local state.
 *
 * Data/auth references:
 * - Backend registration is implementation-specific.
 */
export declare const reportAgentPassToBackend: (register: (input: {
    agentPass: string;
}) => Promise<unknown>, agentPass: string) => Promise<void>;
/**
 * Reads native asset balance for an account identifier.
 *
 * @remarks
 * Purpose:
 * - Provide a convenience wrapper around EVMClient.getNativeBalance.
 *
 * When to use:
 * - Use to read native token balances for tenant-approved networks.
 *
 * When not to use:
 * - Do not use for transfer-provider balances; use TransfersService for those.
 *
 * - Uses the tenant-scoped RPC client (proxy-aware).
 *
 * Parameters:
 * - `client`: Initialized RPC client. Nullable: no.
 * - `account`: Account identifier (0x-prefixed). Nullable: no.
 *
 * Return semantics:
 * - Returns native asset balance as bigint.
 *
 * Errors/failure modes:
 * - Throws when the RPC request fails.
 *
 * Side effects:
 * - Issues an RPC request.
 *
 * Invariants/assumptions:
 * - `account` is a 0x-prefixed identifier.
 *
 * Data/auth references:
 * - Uses RPC provider or apps/api proxy depending on EVMClient configuration.
 *
 * @example
 * const balance = await getNativeTokenBalance(client, account);
 */
export declare const getNativeTokenBalance: (client: EVMClient, account: string) => Promise<bigint>;
/**
 * Reads ERC20 token balance for an account identifier.
 *
 * @remarks
 * Purpose:
 * - Provide a convenience wrapper around EVMClient.getErc20Balance.
 *
 * When to use:
 * - Use to read ERC20 balances for tenant-approved networks.
 *
 * When not to use:
 * - Do not use for native token balances; use getNativeTokenBalance instead.
 *
 * - Uses canonical `contract` naming for token contracts.
 *
 * Parameters:
 * - `client`: Initialized RPC client. Nullable: no.
 * - `token`: Token metadata (must include contract). Nullable: no.
 * - `account`: Account identifier (0x-prefixed). Nullable: no.
 *
 * Return semantics:
 * - Returns ERC20 balance as bigint.
 *
 * Errors/failure modes:
 * - Throws ValidationError when the token contract is missing, or when RPC fails.
 *
 * Side effects:
 * - Issues an RPC request.
 *
 * Invariants/assumptions:
 * - `token.contract` and `account` are 0x-prefixed identifiers.
 *
 * Data/auth references:
 * - Uses RPC provider or apps/api proxy depending on EVMClient configuration.
 *
 * @example
 * const balance = await getErc20TokenBalance(client, token, account);
 */
export declare const getErc20TokenBalance: (client: EVMClient, token: TokenAsset, account: string) => Promise<bigint>;
/**
 * Format a bigint token amount for UI display.
 *
 * @remarks
 * Purpose:
 * - Convert base-unit token amounts into localized display strings.
 *
 * When to use:
 * - Use when rendering token balances in UI.
 *
 * When not to use:
 * - Do not use for precise calculations; use bigint values instead.
 *
 * Parameters:
 * - `amount`: Base-unit token amount. Nullable: no.
 * - `decimals`: Token decimals. Nullable: no.
 * - `symbol`: Optional token symbol. Nullable: yes.
 * - `locale`: Locale(s) for Intl.NumberFormat. Nullable: yes.
 *
 * Return semantics:
 * - Returns a localized string with optional symbol suffix.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `decimals` is a non-negative integer.
 *
 * Data/auth references:
 * - None.
 */
export declare const formatTokenAmount: (amount: bigint, decimals: number, symbol?: string, locale?: string | string[]) => string;
/**
 * Parse a human-readable token amount into base units.
 *
 * @remarks
 * Purpose:
 * - Convert user-entered decimal strings into bigint base units.
 *
 * When to use:
 * - Use before submitting amounts to on-chain or API transactions.
 *
 * When not to use:
 * - Do not use for display formatting; use formatTokenAmount instead.
 *
 * Parameters:
 * - `amount`: Human-readable amount string. Nullable: no.
 * - `decimals`: Token decimals. Nullable: no.
 *
 * Return semantics:
 * - Returns bigint base-unit value.
 *
 * Errors/failure modes:
 * - Throws when amount cannot be parsed into a bigint.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Input uses "." as the decimal separator.
 *
 * Data/auth references:
 * - None.
 */
export declare const parseTokenAmount: (amount: string, decimals: number) => bigint;
/**
 * Provider-neutral tenant network client helper.
 *
 * @remarks
 * Purpose:
 * - Construct an EVMClient from tenant network metadata.
 *
 * When to use:
 * - Use when you want a ready-to-use RPC client for a tenant network.
 *
 * When not to use:
 * - Do not use with arbitrary networks outside tenant bootstrap data.
 *
 * - Wraps EVMClient to enforce tenant-scoped network usage.
 *
 * Parameters:
 * - `network`: Tenant-approved network metadata. Nullable: no.
 * - `fetchImpl`: Optional fetch override. Nullable: yes.
 * - `apiBaseUrl`: API host origin for proxy routing. Nullable: yes.
 * - `getAccessToken`: Optional bearer token getter for proxy requests. Nullable: yes.
 * - `forceProxy`: Force RPC proxy usage (required in browser contexts). Nullable: yes.
 *
 * Return semantics:
 * - Returns an EVMClient instance for RPC calls.
 *
 * Errors/failure modes:
 * - Throws ValidationError when rpcUrl or apiBaseUrl is missing for proxy usage.
 *
 * Side effects:
 * - None (client is lazy; RPC calls happen on request).
 *
 * Invariants/assumptions:
 * - `network` must include rpcUrl and networkId.
 *
 * Data/auth references:
 * - Uses tenant bootstrap `/oauth/tenant` network metadata.
 *
 * @example
 * const client = createTenantNetworkClient(network, undefined, apiBaseUrl, undefined, true);
 */
export declare const createTenantNetworkClient: (network: TenantNetwork, fetchImpl?: typeof fetch, apiBaseUrl?: string, getAccessToken?: () => string | null | Promise<string | null>, forceProxy?: boolean) => EVMClient;
/**
 * Select the tenant-provided network (defaults to the first).
 *
 * @remarks
 * Purpose:
 * - Enforce tenant-approved network usage without custom overrides.
 *
 * When to use:
 * - Use when you need a default network from tenant configuration.
 *
 * When not to use:
 * - Do not use when you require explicit user network selection.
 *
 * Parameters:
 * - `networks`: Tenant network list from bootstrap. Nullable: no.
 *
 * Return semantics:
 * - Returns the first TenantNetwork in the list.
 *
 * Errors/failure modes:
 * - Throws ValidationError when no networks are available.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Does not reorder networks; assumes the list is already prioritized.
 *
 * Data/auth references:
 * - Uses tenant bootstrap `/oauth/tenant` network metadata.
 */
export declare const selectTenantNetwork: (networks: TenantNetwork[]) => TenantNetwork;
