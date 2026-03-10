/**
 * Props for {@link RequestPaymentCard}.
 *
 * @remarks
 * Purpose:
 * - Configure the request form defaults.
 *
 * When to use:
 * - Use to pre-fill payer email for "request payment" shortcuts.
 *
 * When not to use:
 * - Do not pass untrusted values without validation.
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
 * - `defaultPayerEmail` should be an email when provided.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react payment request hooks.
 */
export interface RequestPaymentCardProps {
    /**
     * Default payer email to pre-fill the form.
     *
     * @remarks
     * - Useful for “Receive” shortcuts from a contacts list.
     * - When provided, the input is initialized to this value and resets to it after a successful request.
     */
    defaultPayerEmail?: string;
}
/**
 * Request money from a payer by email.
 *
 * @remarks
 * Purpose:
 * - Create a P2P payment request and generate a hosted pay link.
 *
 * When to use:
 * - Use when requesting payments via email from end users.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: RequestPaymentCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Displays inline errors and toasts on request failures.
 *
 * Side effects:
 * - Issues API calls to create payment requests and emits browser events.
 *
 * Invariants/assumptions:
 * - Uses tenant auth domain to build hosted pay links.
 *
 * Data/auth references:
 * - Uses `/api/v1/payments/requests` via sdk-react hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <RequestPaymentCard defaultPayerEmail="payer@example.com" />
 */
export declare function RequestPaymentCard({ defaultPayerEmail }: RequestPaymentCardProps): import("react/jsx-runtime.js").JSX.Element;
/**
 * Displays payment request history (incoming + outgoing) in a single, merged table.
 *
 * @remarks
 * Purpose:
 * - Combine incoming and outgoing payment requests into a unified list.
 * - On small screens, rows render as stacked cards instead of a table.
 *
 * When to use:
 * - Use when providing a unified request history view.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Surfaces inline errors when fetch or action calls fail.
 *
 * Side effects:
 * - Issues API calls and launches IEE (SafeApprove) approval flows for request actions.
 *
 * Invariants/assumptions:
 * - Merges results client-side and sorts by `createdAt`.
 *
 * Data/auth references:
 * - Uses `/api/v1/payments/requests/incoming` and `/api/v1/payments/requests/transactions`.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 */
export declare function RequestHistoryCard(): import("react/jsx-runtime.js").JSX.Element;
