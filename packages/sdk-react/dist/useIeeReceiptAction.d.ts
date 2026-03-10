export type IeeReceiptActionStatus = "idle" | "pending" | "approved" | "cancelled" | "error";
export interface IeeReceiptActionState {
    status: IeeReceiptActionStatus;
    error?: {
        code: string;
        message: string;
    };
    receipt?: string;
    actionType?: string;
    actionHash?: string;
    jti?: string;
    contextHash?: string | null;
    txIntent?: any;
    userOpHash?: string | null;
    /** Optional installation id returned by agent install flows. */
    installationId?: string | null;
    /** Optional preparation token returned by IEE (SafeApprove) signing flows. */
    preparationToken?: string | null;
    /** Transaction hash returned by the IEE (SafeApprove) submission flow (when available). */
    transactionHash?: string | null;
    /**
     * Optional canonical payload returned by the IEE (SafeApprove) flow.
     *
     * @remarks
     * - Used by send-payment flows to apply server-side email resolution results.
     */
    resolvedPayload?: Record<string, unknown> | null;
}
/**
 * Helper hook to issue an IEE (SafeApprove) prep ticket, launch the oauth-server IEE (SafeApprove) UI, and return the receipt.
 *
 * @remarks
 * Purpose:
 * - Encapsulates prep ticket issuance and IEE (SafeApprove) launcher wiring for receipt-gated actions.
 * - Uses the tenant auth domain for the IEE (SafeApprove) UI when available (falls back to OAuth baseUrl).
 *
 * When to use:
 * - Use before calling receipt-gated commit endpoints (e.g., payments/agents) to obtain the IEE (SafeApprove) receipt.
 *
 * When not to use:
 * - Do not use on the server; browser-only (uses window + postMessage).
 *
 * Errors/failure modes:
 * - Returns `{ status: "error", error }` on ticket issuance or IEE (SafeApprove) launch failures.
 * - Returns `{ status: "error", error: { code: "THIRD_PARTY_ACTION_UNSUPPORTED" } }` for unsupported actions.
 *
 * Side effects:
 * - Opens the iframe modal to the oauth-server `/iee` route.
 */
export declare function useIeeReceiptAction(params?: {
    ieePath?: string;
}): {
    state: IeeReceiptActionState;
    run: (options: {
        actionType: string;
        payload: Record<string, unknown>;
        receiptRequestId?: string;
    }) => Promise<IeeReceiptActionState>;
    reset: () => void;
};
