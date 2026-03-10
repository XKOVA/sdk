import { useCallback, useEffect, useMemo, useState } from "react";
import { createTenantNetworkClient, formatTokenAmount, getErc20TokenBalance, getNativeTokenBalance, selectTenantNetwork, } from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { useAuth } from "./auth.js";
import { useAccountState, useTenantConfig } from "./tenant.js";
import { useResourceInvalidation } from "./resources.js";
import { resolvePollingFallbackMs } from "./realtime.js";
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
export const useHumanBalance = (options) => {
    const { apiBaseUrl, getAccessToken } = useSDK();
    const { status } = useAuth();
    const { account } = useAccountState();
    const { networks, tokens: tenantTokens } = useTenantConfig();
    const [balance, setBalance] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const enabled = options?.enabled ?? true;
    const resolvedNetwork = useMemo(() => {
        try {
            return selectTenantNetwork(networks);
        }
        catch {
            return null;
        }
    }, [networks]);
    const resolvedToken = useMemo(() => {
        return tenantTokens?.find((t) => t.isPrimary || t.isDefault) ?? tenantTokens?.[0];
    }, [tenantTokens]);
    const resolvedAccount = useMemo(() => account ?? null, [account]);
    useEffect(() => {
        let cancelled = false;
        if (!enabled) {
            setBalance(null);
            setIsLoading(false);
            setError(null);
            return;
        }
        if (status !== "authenticated") {
            setBalance(null);
            setIsLoading(false);
            setError(null);
            return;
        }
        if (!resolvedNetwork || !resolvedAccount) {
            setBalance(null);
            setIsLoading(false);
            setError(null);
            return;
        }
        const forceProxy = typeof window !== "undefined";
        const client = createTenantNetworkClient(resolvedNetwork, undefined, apiBaseUrl, getAccessToken, forceProxy);
        const formatFixed = (value, decimals, fractionDigits = 2) => {
            if (fractionDigits <= 0)
                return value.toString();
            const base = 10n ** BigInt(decimals);
            const scale = 10n ** BigInt(fractionDigits);
            const scaled = value * scale;
            let q = scaled / base;
            const r = scaled % base;
            // round half up
            if (r * 2n >= base)
                q = q + 1n;
            const s = q.toString();
            const whole = s.length > fractionDigits ? s.slice(0, -fractionDigits) : "0";
            const frac = s.length > fractionDigits ? s.slice(-fractionDigits) : s.padStart(fractionDigits, "0");
            const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            return `${withCommas}.${frac}`;
        };
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                let value;
                let decimals;
                let symbol;
                if (resolvedToken?.contract) {
                    value = await getErc20TokenBalance(client, resolvedToken, resolvedAccount);
                    decimals = resolvedToken.decimals;
                    symbol = resolvedToken.symbol;
                }
                else {
                    value = await getNativeTokenBalance(client, resolvedAccount);
                    decimals = 18;
                    symbol = resolvedNetwork.symbol;
                }
                if (cancelled)
                    return;
                const isStable = Boolean(resolvedToken?.isStable);
                const amountText = isStable ? formatFixed(value, decimals, 2) : formatTokenAmount(value, decimals, undefined);
                setBalance({
                    amountText,
                    isStable,
                    symbol,
                    logoUrl: resolvedToken?.logoUrl ?? undefined
                });
            }
            catch (err) {
                if (cancelled)
                    return;
                const e = err instanceof Error ? err : new Error("Failed to load balance");
                setBalance(null);
                setError(e);
            }
            finally {
                if (cancelled)
                    return;
                setIsLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [
        enabled,
        status,
        resolvedNetwork,
        resolvedAccount,
        resolvedToken?.contract,
        resolvedToken?.decimals,
        resolvedToken?.symbol,
        resolvedToken?.isStable,
        resolvedToken?.logoUrl,
        apiBaseUrl,
        getAccessToken
    ]);
    return { balance, isLoading, error };
};
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
export const useTokenBalances = (options) => {
    const { account, isLoading: accountLoading } = useAccountState();
    const { networks, tokens, isLoading: configLoading } = useTenantConfig();
    const { apiBaseUrl, getAccessToken, realtime } = useSDK();
    const [balances, setBalances] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const showNative = options?.showNative ?? false;
    const refreshMs = resolvePollingFallbackMs(options?.refreshMs, realtime);
    const network = useMemo(() => {
        try {
            return selectTenantNetwork(networks);
        }
        catch {
            return null;
        }
    }, [networks]);
    const handleRefresh = useCallback(() => {
        setRefreshKey((key) => key + 1);
    }, []);
    useResourceInvalidation("balances", handleRefresh);
    useEffect(() => {
        if (!account || !network) {
            // Preserve reference when already empty to avoid render loops from unstable dependencies upstream.
            setBalances((current) => (current.length > 0 ? [] : current));
            setIsLoading(false);
            setError(null);
            return;
        }
        let cancelled = false;
        const fetchBalances = async () => {
            setIsLoading(true);
            setError(null);
            const results = [];
            try {
                const forceProxy = typeof window !== "undefined";
                const client = createTenantNetworkClient(network, undefined, apiBaseUrl, getAccessToken, forceProxy);
                if (showNative) {
                    try {
                        const nativeBalance = await getNativeTokenBalance(client, account);
                        results.push({
                            token: { symbol: network.symbol ?? "ETH", decimals: 18 },
                            value: nativeBalance,
                            isNative: true
                        });
                    }
                    catch {
                        /* skip native on failure */
                    }
                }
                const tokenList = tokens ?? [];
                for (const token of tokenList) {
                    if (!token.contract)
                        continue;
                    try {
                        const value = await getErc20TokenBalance(client, token, account);
                        results.push({
                            token,
                            value,
                            isNative: false
                        });
                    }
                    catch {
                        /* skip token on failure */
                    }
                }
                if (!cancelled) {
                    setBalances(results);
                }
            }
            catch (err) {
                if (!cancelled) {
                    const e = err instanceof Error ? err : new Error("Failed to load balances");
                    setBalances([]);
                    setError(e);
                }
            }
            finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };
        fetchBalances();
        let timer;
        if (refreshMs && refreshMs > 0) {
            timer = setInterval(fetchBalances, refreshMs);
        }
        return () => {
            cancelled = true;
            if (timer)
                clearInterval(timer);
        };
    }, [account, network, tokens, showNative, apiBaseUrl, getAccessToken, refreshKey, refreshMs]);
    return { balances, isLoading, account, accountLoading, configLoading, refresh: handleRefresh, error };
};
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
export const useTokenBalance = (options) => {
    const { apiBaseUrl, getAccessToken } = useSDK();
    const [balance, setBalance] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const includeNative = options.includeNative ?? false;
    const account = options.account;
    const network = options.network;
    const selectedContract = options.selectedContract;
    const selectedToken = options.selectedToken;
    const handleRefresh = useCallback(() => {
        setRefreshKey((key) => key + 1);
    }, []);
    useResourceInvalidation("balances", handleRefresh);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!account || !network) {
                setBalance(null);
                setIsLoading(false);
                setError(null);
                return;
            }
            if (!includeNative && !selectedToken?.contract) {
                setBalance(null);
                setIsLoading(false);
                setError(null);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const forceProxy = typeof window !== "undefined";
                const client = createTenantNetworkClient(network, undefined, apiBaseUrl, getAccessToken, forceProxy);
                if (selectedContract === "native") {
                    const value = await getNativeTokenBalance(client, account);
                    if (!cancelled) {
                        setBalance({
                            value,
                            decimals: 18,
                            symbol: network.symbol,
                            isStable: false,
                            logoUrl: undefined
                        });
                    }
                    return;
                }
                if (!selectedToken?.contract) {
                    if (!cancelled)
                        setBalance(null);
                    return;
                }
                const value = await getErc20TokenBalance(client, selectedToken, account);
                if (!cancelled) {
                    setBalance({
                        value,
                        decimals: selectedToken.decimals,
                        symbol: selectedToken.symbol,
                        isStable: selectedToken.isStable,
                        logoUrl: selectedToken.logoUrl
                    });
                }
            }
            catch (err) {
                if (!cancelled) {
                    const e = err instanceof Error ? err : new Error("Failed to load balance");
                    setBalance(null);
                    setError(e);
                }
            }
            finally {
                if (!cancelled)
                    setIsLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [
        account,
        network,
        selectedContract,
        selectedToken,
        includeNative,
        apiBaseUrl,
        getAccessToken,
        refreshKey
    ]);
    return { balance, isLoading, refresh: handleRefresh, error };
};
