/**
 * Props for {@link AccountCard}.
 *
 * @remarks
 * Purpose:
 * - Configure refresh behavior for the account summary card.
 *
 * When to use:
 * - Use to enable or disable auto-refresh polling.
 *
 * When not to use:
 * - Do not set `refreshMs` if you want manual refresh only.
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
 * - Used by a component that calls sdk-react account hooks.
 */
export interface AccountCardProps {
    /** Auto-refresh account state interval in ms */
    refreshMs?: number;
}
/**
 * Account summary card.
 *
 * @remarks
 * Purpose:
 * - Display the authenticated primary account (no balances).
 *
 * When to use:
 * - Use to show primary account identifiers.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: AccountCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders fallback UI when account state cannot be fetched.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Loads account state and optionally polls when `refreshMs` is set.
 *
 * Invariants/assumptions:
 * - Uses `useAccountState` as the source of truth.
 *
 * Data/auth references:
 * - Uses sdk-react account hooks that call oauth-server `/account`.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <AccountCard refreshMs={15000} />
 */
export declare function AccountCard({ refreshMs, }: AccountCardProps): import("react/jsx-runtime.js").JSX.Element;
