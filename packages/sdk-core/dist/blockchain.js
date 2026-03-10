import { ValidationError } from './errors.js';
import { resolveApiBaseUrl } from './api-url.js';
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
export class EVMClient {
    constructor(config) {
        // Normalize rpcUrl from possible server shapes
        const derivedRpc = config.network.rpcUrl ||
            config.network?.rpc_url ||
            config.network?.rpcs?.find?.((r) => r.is_primary)?.url ||
            config.network?.rpcs?.[0]?.url;
        if (!derivedRpc) {
            throw new ValidationError('RPC URL missing for the selected network');
        }
        this.rpcUrl = derivedRpc;
        const networkIdRaw = config.network?.networkId ??
            config.network?.network_id ??
            null;
        const networkId = networkIdRaw !== null ? Number(networkIdRaw) : NaN;
        this.networkId = Number.isFinite(networkId) ? networkId : 0;
        this.fetchImpl =
            config.fetchImpl ??
                ((...args) => {
                    const f = globalThis.fetch;
                    return f.apply(globalThis, args);
                });
        // Proxy usage is caller-driven; sdk-core does not inspect runtime globals.
        this.useProxy = config.forceProxy === true;
        this.proxyUrl = this.useProxy ? this.buildProxyUrl(config.apiBaseUrl) : null;
        this.getAccessToken = config.getAccessToken;
    }
    /**
     * Builds the RPC proxy URL from the API base URL
     */
    buildProxyUrl(apiBaseUrl) {
        if (!apiBaseUrl) {
            throw new ValidationError('API host is required for RPC proxy. Pass apiBaseUrl in NetworkClientConfig.');
        }
        const base = resolveApiBaseUrl({ apiHost: apiBaseUrl });
        return `${base}/rpc/proxy`;
    }
    async request(method, params = []) {
        if (this.useProxy && this.proxyUrl) {
            // Route through RPC proxy
            return this.requestViaProxy(method, params);
        }
        else {
            // Direct RPC call (server-side or forceProxy=false)
            return this.requestDirect(method, params);
        }
    }
    /**
     * Makes a direct RPC call to the blockchain provider
     */
    async requestDirect(method, params) {
        const body = { jsonrpc: '2.0', id: Date.now(), method, params };
        const response = await this.fetchImpl(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (payload.error) {
            throw new ValidationError(`RPC error: ${payload.error.message ?? 'unknown error'}`, payload.error);
        }
        return payload.result;
    }
    /**
     * Makes an RPC call through the API server's RPC proxy
     */
    async requestViaProxy(method, params) {
        if (!this.proxyUrl) {
            throw new ValidationError('Proxy URL not configured');
        }
        const proxyBody = {
            rpcUrl: this.rpcUrl,
            method,
            params,
            networkId: this.networkId,
        };
        // Get access token for authentication
        const token = this.getAccessToken ? await this.getAccessToken() : null;
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        const response = await this.fetchImpl(this.proxyUrl, {
            method: 'POST',
            headers,
            credentials: 'omit', // Don't send cookies to API server for RPC proxy
            body: JSON.stringify(proxyBody),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new ValidationError(`RPC proxy error: ${response.status} ${errorText}`);
        }
        const json = await response.json();
        // API server wraps responses in { data: ..., request_id: ..., timestamp: ... }
        // Unwrap the envelope to get the actual RPC result
        const result = json.data !== undefined ? json.data : json;
        return result;
    }
    async getNativeBalance(account) {
        const hex = await this.request('eth_getBalance', [
            account,
            'latest',
        ]);
        return BigInt(hex);
    }
    async getErc20Balance(account, tokenContract) {
        const data = buildErc20BalanceOfCall(account);
        const hex = await this.request('eth_call', [
            { to: tokenContract, data },
            'latest',
        ]);
        return BigInt(hex);
    }
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
export const createOAuthEOAAccount = (network, account) => ({
    account,
    network,
});
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
export const disconnectSmartAccount = async (accountHandle) => accountHandle.disconnect();
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
export const reportSmartAccountToBackend = async (register, accountHandle) => {
    await register({
        account: accountHandle.account,
        networkId: accountHandle.networkId ?? accountHandle.network.id,
    });
};
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
export const installAgentPass = async (accountHandle, agentPass, reporter) => {
    await accountHandle.installAgentPass(agentPass);
    if (reporter)
        await reporter(agentPass);
    return agentPass;
};
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
export const reportAgentPassToBackend = async (register, agentPass) => {
    await register({ agentPass });
};
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
export const getNativeTokenBalance = async (client, account) => client.getNativeBalance(account);
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
export const getErc20TokenBalance = async (client, token, account) => {
    if (!token.contract) {
        throw new ValidationError('Token contract is required for ERC20 balance lookup');
    }
    return client.getErc20Balance(account, token.contract);
};
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
export const formatTokenAmount = (amount, decimals, symbol, locale = 'en-US') => {
    const divisor = BigInt(10) ** BigInt(decimals);
    const value = Number(amount) / Number(divisor);
    const formatted = new Intl.NumberFormat(locale, {
        maximumFractionDigits: decimals,
    }).format(value);
    return symbol ? `${formatted} ${symbol}` : formatted;
};
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
export const parseTokenAmount = (amount, decimals) => {
    const [whole, frac = ''] = amount.split('.');
    const normalizedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
    const raw = `${whole}${normalizedFrac}`;
    return BigInt(raw);
};
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
export const createTenantNetworkClient = (network, fetchImpl, apiBaseUrl, getAccessToken, forceProxy) => new EVMClient({
    network,
    fetchImpl,
    apiBaseUrl,
    getAccessToken,
    forceProxy,
});
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
export const selectTenantNetwork = (networks) => {
    if (!networks || networks.length === 0) {
        throw new ValidationError('No networks available for this tenant. Ask the tenant owner to enable at least one network.');
    }
    return networks[0];
};
const buildErc20BalanceOfCall = (address) => {
    const methodSelector = '70a08231'; // balanceOf(address)
    const padded = address.replace(/^0x/, '').padStart(64, '0');
    return `0x${methodSelector}${padded}`;
};
