import { useCallback, useEffect, useRef, useState } from "react";
import { buildTransactionHistorySearchParams, normalizeTransactionHistoryResponse, } from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { markSDKResourceFetched, subscribeResourceUpdate, useSDKResourceFreshness, } from "./resources.js";
import { resolvePollingFallbackMs } from "./realtime.js";
/**
 * Transaction history hook backed by `/api/v1/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Fetch tenant-scoped transaction history with filters and pagination.
 * - Normalize token metadata for display amounts.
 * - Automatically refetches when the SDK invalidates the `transactions` resource.
 *
 * When to use:
 * - Use for general transaction history lists in apps/api-backed UI.
 *
 * When not to use:
 * - Do not use for transfer-provider deposits/withdrawals; use useTransferTransactions.
 *
 * Parameters:
 * - params: Optional history filters and pagination (object, optional).
 * - params.account: Account identifier filter (string, optional).
 * - params.agentInstallationId: Agent installation UUID filter (string, optional).
 * - params.agentServiceId: Agent service UUID filter (string, optional).
 * - params.networkId: Network identifier filter (number|string, optional).
 * - params.eventType: Event type filter (string, optional).
 * - params.eventSubtype: Event subtype filter (string, optional).
 * - params.executionMethod: Execution method filter (string, optional).
 * - params.excludeUserOperationWrappers: Exclude user-operation wrapper rows (boolean, optional; default: true).
 * - params.status: Status filter (string, optional).
 * - params.direction: Direction filter (string, optional).
 * - params.contract: Contract identifier filter (string, optional).
 * - params.category: Category filter (string, optional).
 * - params.assetType: Asset type filter (string, optional).
 * - params.source: Data source filter ("all" | "api" | "indexer", optional).
 * - params.view: History view mode ("grouped" | "events", optional).
 *   - grouped: server-side grouped view (1 row per agent transaction, including fee-split batches).
 *   - events: raw rows (shows each fee-split transfer).
 * - params.limit: Page size (number, optional).
 * - params.cursor: Cursor for pagination (string, optional).
 * - params.offset: Offset for pagination (number, optional).
 * - params.autoRefreshMs: Auto-refresh interval in ms (number, optional).
 *   - Polling fallback runs only while realtime is unavailable.
 *
 * Return semantics:
 * - Returns transactions, pagination metadata, loading state, error state, and refetch helpers.
 * - `transactions` include normalized display fields (displayAmount, displayType, counterpartyLabel, tokenLogoUrl, contact metadata) and preserve canonical API semantics (`statusCanonical`, `provenance`, `counterparty`, `image`).
 * - Faucet transactions are labeled using tenant transfer provider metadata when available.
 *
 * Errors/failure modes:
 * - Sets `error` when the API request fails or is unauthorized.
 *
 * Side effects:
 * - Issues API calls to `/transactions/history` when authenticated.
 * - Excludes user-operation wrapper rows by default unless explicitly disabled.
 *
 * Invariants/assumptions:
 * - `transactions` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api, bearer token).
 *
 * @example
 * const { transactions, refetch } = useTransactionHistory({ limit: 20 });
 */
export const useTransactionHistory = (params) => {
    const { state, apiClient, bootstrap, realtime } = useSDK();
    const [response, setResponse] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const latestFetchRef = useRef(null);
    const abortRef = useRef(null);
    const freshness = useSDKResourceFreshness("transactions");
    const autoRefreshMs = resolvePollingFallbackMs(params?.autoRefreshMs, realtime);
    const tenantConfig = bootstrap;
    const excludeUserOperationWrappers = typeof params?.excludeUserOperationWrappers === "boolean"
        ? params.excludeUserOperationWrappers
        : true;
    const buildSearchParams = useCallback(() => {
        return buildTransactionHistorySearchParams({
            ...params,
            excludeUserOperationWrappers
        });
    }, [
        params?.account,
        params?.agentInstallationId,
        params?.agentServiceId,
        params?.networkId,
        params?.eventType,
        params?.eventSubtype,
        params?.executionMethod,
        excludeUserOperationWrappers,
        params?.status,
        params?.direction,
        params?.contract,
        params?.category,
        params?.assetType,
        params?.source,
        params?.view,
        params?.limit,
        params?.cursor,
        params?.offset
    ]);
    const fetchTransactions = useCallback(async (options) => {
        if (state.status !== "authenticated")
            return;
        const isBackground = options?.skipLoading === true;
        const inFlight = abortRef.current && abortRef.current.signal.aborted === false;
        // Background refresh should never interrupt a foreground/manual fetch.
        if (isBackground && inFlight)
            return;
        const requestToken = Symbol("tx-history");
        latestFetchRef.current = requestToken;
        // Foreground refetch should cancel any in-flight request.
        if (!isBackground && inFlight) {
            abortRef.current?.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;
        if (!isBackground)
            setIsLoading(true);
        try {
            const search = buildSearchParams();
            const path = `/transactions/history${search.toString() ? `?${search.toString()}` : ""}`;
            const raw = await apiClient.get(path, controller.signal);
            if (latestFetchRef.current !== requestToken)
                return;
            const payload = raw?.data ?? raw;
            const tokens = params?.tokenMetadata ?? tenantConfig?.tokens ?? [];
            const mapped = normalizeTransactionHistoryResponse(payload, {
                tokens,
                view: params?.view,
                transferProviders: tenantConfig?.tenant?.transferProviders ?? []
            });
            setResponse(mapped);
            setError(null);
            const fetchedAt = Date.now();
            setLastUpdatedAt(fetchedAt);
            markSDKResourceFetched("transactions", fetchedAt);
        }
        catch (err) {
            if (controller.signal.aborted)
                return;
            if (latestFetchRef.current !== requestToken)
                return;
            const e = err instanceof Error
                ? err
                : new Error(typeof err === "string"
                    ? err
                    : typeof err?.message === "string"
                        ? String(err.message)
                        : "Failed to load transactions");
            setError(e);
        }
        finally {
            // Clear the in-flight pointer if this request is the current one.
            if (abortRef.current === controller) {
                abortRef.current = null;
            }
            if (controller.signal.aborted)
                return;
            if (latestFetchRef.current !== requestToken)
                return;
            if (!isBackground)
                setIsLoading(false);
        }
    }, [apiClient, buildSearchParams, state.status]);
    useEffect(() => {
        if (state.status !== "authenticated")
            return;
        fetchTransactions({ skipLoading: false });
    }, [fetchTransactions, state.status]);
    useEffect(() => {
        if (!autoRefreshMs || state.status !== "authenticated")
            return;
        const interval = setInterval(() => {
            fetchTransactions({ skipLoading: true });
        }, autoRefreshMs);
        return () => clearInterval(interval);
    }, [autoRefreshMs, fetchTransactions, state.status]);
    useEffect(() => {
        return subscribeResourceUpdate("transactions", () => {
            fetchTransactions({ skipLoading: true });
        });
    }, [fetchTransactions]);
    const refetch = useCallback(() => fetchTransactions({ skipLoading: false }), [fetchTransactions]);
    return {
        transactions: response?.transactions ?? [],
        total: response?.total ?? 0,
        limit: response?.limit ?? params?.limit ?? 50,
        offset: response?.offset ?? params?.offset ?? 0,
        hasMore: response?.hasMore ?? false,
        nextCursor: response?.nextCursor ?? null,
        prevCursor: response?.prevCursor ?? null,
        isLoading,
        error,
        refetch,
        lastUpdatedAt,
        freshness,
    };
};
/**
 * Convenience alias for account-focused transaction queries.
 *
 * @remarks
 * Purpose:
 * - Wrap useTransactionHistory with an account filter.
 *
 * When to use:
 * - Use when you need transaction history scoped to a single account.
 *
 * When not to use:
 * - Do not use for transfer-provider activity; use useTransferTransactions instead.
 *
 * Parameters:
 * - `account`: Account identifier filter. Nullable: yes.
 *
 * Return semantics:
 * - Returns the same shape as useTransactionHistory.
 *
 * Errors/failure modes:
 * - Same as useTransactionHistory.
 *
 * Side effects:
 * - Same as useTransactionHistory (API calls when authenticated).
 *
 * Invariants/assumptions:
 * - Delegates to useTransactionHistory with an account filter.
 *
 * Data/auth references:
 * - /api/v1/transactions/history endpoint.
 */
export const useAccountTransactions = (account) => useTransactionHistory({ account });
