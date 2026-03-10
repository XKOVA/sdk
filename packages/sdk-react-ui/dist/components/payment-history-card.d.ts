/**
 * Props for {@link PaymentHistoryCard}.
 *
 * @remarks
 * Purpose:
 * - Configure toast handling for payment history UI.
 *
 * When to use:
 * - Use to supply a custom toast handler.
 *
 * When not to use:
 * - Do not pass sensitive data into toast handlers.
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
 * - Toast handler should be fast and non-throwing.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react send payment history hooks.
 */
export interface PaymentHistoryCardProps {
    onToast?: (type: "success" | "error" | "info", message: string) => void;
}
/**
 * Payment history card.
 *
 * @remarks
 * Purpose:
 * - List sent payment history and allow IEE (SafeApprove)-gated actions on pending payments.
 * - On small screens, rows render as stacked cards instead of a table.
 *
 * When to use:
 * - Use when showing pending payment activity for the user.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: PaymentHistoryCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Surfaces API errors via toast messaging.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Triggers API fetches and cancel flows.
 *
 * Invariants/assumptions:
 * - Shows all send payment statuses; pending actions are conditionally available.
 *
 * Data/auth references:
 * - Uses `/api/v1/payments/send` via sdk-react hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <PaymentHistoryCard />
 */
export declare function PaymentHistoryCard({ onToast }: PaymentHistoryCardProps): import("react/jsx-runtime.js").JSX.Element;
