/**
 * Props for {@link TransferActivityCard}.
 *
 * @remarks
 * Purpose:
 * - Configure refresh behavior for the transfer activity card.
 *
 * When to use:
 * - Use to enable or disable auto-refresh polling.
 *
 * When not to use:
 * - Do not set `autoRefreshMs` if you want manual refresh only.
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
 * - `autoRefreshMs` must be > 0 to enable polling.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react transfer hooks.
 */
export interface TransferActivityCardProps {
    /** Auto-refresh interval in ms (disabled when undefined or <= 0). Default: 60000 */
    autoRefreshMs?: number;
}
/**
 * Transfer activity card.
 *
 * @remarks
 * Purpose:
 * - List deposit/withdraw activity (provider transactions).
 * - Provide refresh and pagination controls for transfer history.
 * - On small screens, rows render as stacked cards instead of a table.
 *
 * When to use:
 * - Use when showing transfer-provider deposit/withdraw activity.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: TransferActivityCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Displays an error message when fetch fails (including insufficient scope).
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Issues API calls via sdk-react hooks and opens external links.
 *
 * Invariants/assumptions:
 * - Uses authenticated SDK session state for data access.
 *
 * Data/auth references:
 * - Uses `/api/v1/transfers/transactions` via sdk-react transfer hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <TransferActivityCard autoRefreshMs={60000} />
 */
export declare function TransferActivityCard({ autoRefreshMs }: TransferActivityCardProps): import("react/jsx-runtime.js").JSX.Element;
