/**
 * Props for {@link TransfersCard}.
 *
 * @remarks
 * Purpose:
 * - Configure callbacks for transfer flow lifecycle events.
 *
 * When to use:
 * - Use when embedding transfers UI and you need lifecycle hooks.
 *
 * When not to use:
 * - Do not pass sensitive data into callbacks.
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
 * - Callbacks are optional and should be safe to call multiple times.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react transfer hooks.
 */
export interface TransfersCardProps {
    /** Callback when transfer flow starts */
    onStart?: (providerId: string | undefined) => void;
    /** Callback when faucet claim succeeds */
    onSuccess?: (tx: {
        transactionHash?: string;
    }) => void;
    /** Callback when action fails */
    onError?: (error: Error) => void;
}
/**
 * Transfers (deposit/withdraw) card.
 *
 * @remarks
 * Purpose:
 * - Provide a UI for deposit/withdraw flows using tenant transfer providers.
 *
 * When to use:
 * - Use when enabling end users to initiate transfers.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: TransfersCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Surfaces validation errors via inline messaging.
 * - Loading: shows skeleton only on the first load; refresh keeps content and shows a header spinner.
 *
 * Side effects:
 * - Opens provider URLs, opens iframe widgets, and may execute on-chain transactions.
 *
 * Invariants/assumptions:
 * - Requires an authenticated SDK session.
 *
 * Data/auth references:
 * - Receipt-gated: client-side signing is disabled in the public SDK. Use the IEE (SafeApprove) iframe modal to obtain a receipt before calling receipt-gated endpoints.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <TransfersCard onSuccess={(tx) => void tx} />
 */
export declare function TransfersCard({ onStart, onSuccess, onError }: TransfersCardProps): import("react/jsx-runtime.js").JSX.Element;
