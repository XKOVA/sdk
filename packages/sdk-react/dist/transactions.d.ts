import { type TransactionHistoryDisplayItem, type TokenAsset, type TransactionHistoryParams } from "@xkova/sdk-core";
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
export declare const useTransactionHistory: (params?: TransactionHistoryParams & {
    /**
     * History view mode.
     * - grouped: 1 row per transaction hash (plus no-hash rows)
     * - events: raw rows (multiple rows per transaction hash)
     * - Fee-split batches are grouped by default; use events to see all transfer legs.
     */
    view?: "grouped" | "events";
    autoRefreshMs?: number;
    tokenMetadata?: TokenAsset[];
}) => {
    transactions: import("@xkova/sdk-core").TransactionHistoryItem[] & TransactionHistoryDisplayItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    lastUpdatedAt: number | null;
    freshness: import("./resources.js").SDKResourceFreshness;
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
export declare const useAccountTransactions: (account?: string) => {
    transactions: import("@xkova/sdk-core").TransactionHistoryItem[] & TransactionHistoryDisplayItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    lastUpdatedAt: number | null;
    freshness: import("./resources.js").SDKResourceFreshness;
};
