/**
 * Props for {@link BalanceCard}.
 *
 * @remarks
 * Purpose:
 * - Configure which balances are displayed and how they are rendered.
 *
 * When to use:
 * - Use when customizing balance display options.
 *
 * When not to use:
 * - Do not enable polling if you only want manual refresh.
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
 * - `refreshMs` must be > 0 to enable polling.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react balance hooks.
 */
export interface BalanceCardProps {
    /** Include native token balance (default: false) */
    showNative?: boolean;
    /** Auto-refresh interval in ms */
    refreshMs?: number;
    /** Show token symbol next to balance (e.g. USDC). Default: false (token is already labeled on the left). */
    showTokenSymbol?: boolean;
    /** Show token logo in the left token icon (replaces initials). Default: true */
    showTokenLogo?: boolean;
}
/**
 * Balance card (token balances).
 *
 * @remarks
 * Purpose:
 * - Display token balances for the authenticated account.
 *
 * When to use:
 * - Use when rendering a balance overview for the current user.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: BalanceCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Falls back to empty state when balances cannot be fetched.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Polls balances when `refreshMs` is set.
 *
 * Invariants/assumptions:
 * - Uses tenant-scoped networks/tokens.
 *
 * Data/auth references:
 * - Uses sdk-react hooks that call balance endpoints.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <BalanceCard refreshMs={30000} />
 */
export declare function BalanceCard({ showNative, refreshMs, showTokenSymbol, showTokenLogo, }: BalanceCardProps): import("react/jsx-runtime.js").JSX.Element;
