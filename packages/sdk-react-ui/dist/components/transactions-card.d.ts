/**
 * Props for {@link TransactionsCard}.
 *
 * @remarks
 * Purpose:
 * - Configure filters, pagination, and display options for transaction history.
 *
 * When to use:
 * - Use when customizing the transaction history card.
 *
 * When not to use:
 * - Do not pass unsupported filter values; they are ignored by the API.
 *
 * Return semantics:
 * - Props type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `pageSize` must be > 0 to enable pagination.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react history hooks.
 */
export interface TransactionsCardProps {
    /** Number of transactions per page */
    pageSize?: number;
    /** Filter by token contract */
    contract?: string;
    /** Filter by account identifier */
    account?: string;
    /** Auto-refresh interval in ms (disabled when undefined or <= 0) */
    autoRefreshMs?: number;
    /** Show stable token logo next to amount (for stable tokens). Default: true */
    showStableTokenLogo?: boolean;
    /** Show stable token symbol next to amount (for stable tokens). Default: false */
    showStableTokenSymbol?: boolean;
    /**
     * Transaction history view mode.
     * - grouped: 1 row per tx hash (movement summary)
     * - events: raw rows (multiple rows per tx hash)
     * - Fee-split batches are grouped by default; use events to show all transfer legs.
     *
     * Default: grouped
     */
    view?: "grouped" | "events";
    /**
     * History source filter.
     * - all: show API prewrites and indexer rows
     * - api: show API prewrites only
     * - indexer: show indexer rows only
     */
    source?: "all" | "api" | "indexer";
    /**
     * Show user-operation wrapper rows (contract_interaction user_operation).
     *
     * Default: false (hidden).
     */
    showUserOperationWrappers?: boolean;
}
/**
 * Transaction history card.
 *
 * @remarks
 * Purpose:
 * - Renders tenant-scoped transaction history with filters, paging, result counts, and type tooltips.
 * - Type tooltips are rendered via a portal to avoid overflow clipping in table rows.
 * - Counterparty address tooltips are portaled to keep full values visible.
 * - Pagination controls are always visible; range counts use server-provided totals.
 * - Pagination controls wrap onto multiple lines on small screens.
 * - On small screens, rows render as stacked cards instead of a table.
 * - Column headers are sortable (applies to the current page).
 *
 * When to use:
 * - Use when displaying transaction history in UI.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - props.pageSize: Page size for server-side pagination (number, optional).
 * - props.contract: Token contract filter (string, optional).
 * - props.account: Account identifier filter (string, optional).
 * - props.autoRefreshMs: Auto-refresh interval in ms (number, optional).
 * - props.showStableTokenLogo: Show stable token logos next to amounts (boolean, optional).
 * - props.showStableTokenSymbol: Show stable token symbols next to amounts (boolean, optional).
 * - props.view: History view mode ("grouped" | "events", optional).
 * - props.source: History source filter ("all" | "api" | "indexer", optional).
 * - props.showUserOperationWrappers: Show user-operation wrapper rows (boolean, optional).
 *
 * Return semantics:
 * - Returns a card layout with filters, table, totals, and pagination UI.
 *
 * Errors/failure modes:
 * - Displays an inline error message when history fetch fails.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Fetches transaction history and refreshes on the configured interval.
 *
 * Invariants/assumptions:
 * - Uses tenant-provided networks/tokens only.
 * - Pagination state is cursor-based and resets on filter changes.
 *
 * Data/auth references:
 * - `useTransactionHistory` for server data.
 * - `useTenantConfig` for networks/tokens.
 *
 * @example
 * <TransactionsCard account="0x..." pageSize={20} />
 *
 * @see useTransactionHistory
 * @see useTenantConfig
 */
export declare function TransactionsCard({ pageSize, contract, account, autoRefreshMs, showStableTokenLogo, showStableTokenSymbol, view, source, showUserOperationWrappers, }: TransactionsCardProps): import("react/jsx-runtime.js").JSX.Element;
