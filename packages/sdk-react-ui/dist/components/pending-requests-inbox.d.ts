export interface PendingPaymentRequestsInboxProps {
    /** Optional className for layout spacing. */
    className?: string;
    /** Optional request type filter ("P2P" | "BUSINESS"). */
    type?: "P2P" | "BUSINESS";
    /** Optional auto-refresh interval in ms. */
    autoRefreshMs?: number;
    /** Pay flow mode ("hosted" opens the hosted pay URL; "in-app" uses the SDK hook). */
    payMode?: "hosted" | "in-app";
    /** Transaction type to use for the in-app send-payment step (required for `payMode="in-app"`). */
    sendTransactionType?: string;
}
/**
 * Render the authenticated user's pending incoming payment requests.
 *
 * @remarks
 * Purpose:
 * - Provide a ready-to-use inbox surface for pending requests.
 * - Supports manual refresh and decline actions via IEE receipts.
 * - Pay can open the hosted pay link or run the in-app send + complete flow.
 *
 * When to use:
 * - Use on authenticated pages where the payer should see incoming requests.
 *
 * When not to use:
 * - Do not use for outgoing requests created by the current user.
 */
export declare function PendingPaymentRequestsInbox({ className, type, autoRefreshMs, payMode, sendTransactionType, }: PendingPaymentRequestsInboxProps): import("react/jsx-runtime.js").JSX.Element | null;
