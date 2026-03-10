import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTenantNetworkClient,
  formatTokenAmount,
  getErc20TokenBalance,
  getNativeTokenBalance,
  selectTenantNetwork,
  type TenantNetwork,
  type TokenAsset,
} from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { useAuth } from "./auth.js";
import { useAccountState, useTenantConfig } from "./tenant.js";
import { useResourceInvalidation } from "./resources.js";
import { resolvePollingFallbackMs } from "./realtime.js";

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
export const useHumanBalance = (options?: HumanBalanceOptions): HumanBalanceState => {
  const { apiBaseUrl, getAccessToken } = useSDK();
  const { status } = useAuth();
  const { account } = useAccountState();
  const { networks, tokens: tenantTokens } = useTenantConfig();
  const [balance, setBalance] = useState<HumanBalanceDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const enabled = options?.enabled ?? true;

  const resolvedNetwork = useMemo(() => {
    try {
      return selectTenantNetwork(networks);
    } catch {
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
    const client = createTenantNetworkClient(
      resolvedNetwork,
      undefined,
      apiBaseUrl,
      getAccessToken,
      forceProxy,
    );

    const formatFixed = (value: bigint, decimals: number, fractionDigits = 2) => {
      if (fractionDigits <= 0) return value.toString();
      const base = 10n ** BigInt(decimals);
      const scale = 10n ** BigInt(fractionDigits);
      const scaled = value * scale;
      let q = scaled / base;
      const r = scaled % base;
      // round half up
      if (r * 2n >= base) q = q + 1n;
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
        let value: bigint;
        let decimals: number;
        let symbol: string | undefined;
        if (resolvedToken?.contract) {
          value = await getErc20TokenBalance(client, resolvedToken, resolvedAccount);
          decimals = resolvedToken.decimals;
          symbol = resolvedToken.symbol;
        } else {
          value = await getNativeTokenBalance(client, resolvedAccount);
          decimals = 18;
          symbol = resolvedNetwork.symbol;
        }
        if (cancelled) return;
        const isStable = Boolean(resolvedToken?.isStable);
        const amountText = isStable ? formatFixed(value, decimals, 2) : formatTokenAmount(value, decimals, undefined);
        setBalance({
          amountText,
          isStable,
          symbol,
          logoUrl: resolvedToken?.logoUrl ?? undefined
        });
      } catch (err) {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error("Failed to load balance");
        setBalance(null);
        setError(e);
      } finally {
        if (cancelled) return;
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
export const useTokenBalances = (options?: TokenBalancesOptions): TokenBalancesState => {
  const { account, isLoading: accountLoading } = useAccountState();
  const { networks, tokens, isLoading: configLoading } = useTenantConfig();
  const { apiBaseUrl, getAccessToken, realtime } = useSDK();
  const [balances, setBalances] = useState<TokenBalanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const showNative = options?.showNative ?? false;
  const refreshMs = resolvePollingFallbackMs(options?.refreshMs, realtime);

  const network = useMemo(() => {
    try {
      return selectTenantNetwork(networks);
    } catch {
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
      const results: TokenBalanceEntry[] = [];
      try {
        const forceProxy = typeof window !== "undefined";
        const client = createTenantNetworkClient(
          network,
          undefined,
          apiBaseUrl,
          getAccessToken,
          forceProxy,
        );

        if (showNative) {
          try {
            const nativeBalance = await getNativeTokenBalance(client, account);
            results.push({
              token: { symbol: network.symbol ?? "ETH", decimals: 18 },
              value: nativeBalance,
              isNative: true
            });
          } catch {
            /* skip native on failure */
          }
        }

        const tokenList = tokens ?? [];
        for (const token of tokenList) {
          if (!token.contract) continue;
          try {
            const value = await getErc20TokenBalance(client, token, account);
            results.push({
              token,
              value,
              isNative: false
            });
          } catch {
            /* skip token on failure */
          }
        }

        if (!cancelled) {
          setBalances(results);
        }
      } catch (err) {
        if (!cancelled) {
          const e =
            err instanceof Error ? err : new Error("Failed to load balances");
          setBalances([]);
          setError(e);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchBalances();

    let timer: ReturnType<typeof setInterval> | undefined;
    if (refreshMs && refreshMs > 0) {
      timer = setInterval(fetchBalances, refreshMs);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [account, network, tokens, showNative, apiBaseUrl, getAccessToken, refreshKey, refreshMs]);

  return { balances, isLoading, account, accountLoading, configLoading, refresh: handleRefresh, error };
};

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
export const useTokenBalance = (options: TokenBalanceOptions): TokenBalanceState => {
  const { apiBaseUrl, getAccessToken } = useSDK();
  const [balance, setBalance] = useState<TokenBalanceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
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
        const client = createTenantNetworkClient(
          network,
          undefined,
          apiBaseUrl,
          getAccessToken,
          forceProxy,
        );

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
          if (!cancelled) setBalance(null);
          return;
        }

        const value = await getErc20TokenBalance(client, selectedToken, account);
        if (!cancelled) {
          setBalance({
            value,
            decimals: selectedToken.decimals,
            symbol: selectedToken.symbol,
            isStable: (selectedToken as any).isStable,
            logoUrl: (selectedToken as any).logoUrl
          });
        }
      } catch (err) {
        if (!cancelled) {
          const e = err instanceof Error ? err : new Error("Failed to load balance");
          setBalance(null);
          setError(e);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
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
