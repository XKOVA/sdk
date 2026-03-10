/**
 * Send payment record returned by `/payments/send`.
 *
 * @remarks
 * - Re-exported from `@xkova/sdk-core` to keep a single DTO source of truth.
 */
export type SendPayment = import("@xkova/sdk-core").SendPayment;
/**
 * Payload for submitting a send payment.
 *
 * @remarks
 * - Re-exported from `@xkova/sdk-core` to keep a single DTO source of truth.
 */
export type SubmitSendPaymentInput = import("@xkova/sdk-core").SubmitSendPaymentInput;
/**
 * Send payment action response payload.
 *
 * @remarks
 * - Mirrors `PaymentActionDto` from apps/api.
 * - Returned by cancel/decline/remind endpoints for send payments.
 */
export interface PaymentActionResult {
    success: boolean;
    message: string;
    payment: SendPayment;
    actionTimestamp?: string;
}
/**
 * Transaction verification response payload.
 *
 * @remarks
 * - Mirrors `TransactionVerificationDto` from apps/api.
 * - Returned by payment verification endpoints.
 */
export interface TransactionVerificationResult {
    isValid: boolean;
    message: string;
    transactionDetails?: Record<string, unknown>;
    verifiedAt?: string;
}
/**
 * Fetches send payments for the authenticated user.
 *
 * @remarks
 * Purpose:
 * - List send payment history (including pending/escrowed) for the authenticated user.
 *
 * - Backed by `/api/v1/payments/send`.
 * - Supports pending payment filtering via `isPendingPayment`.
 * - Automatically refetches when the SDK invalidates the `payments` resource.
 *
 * When to use:
 * - Use when listing send payment history.
 *
 * When not to use:
 * - Do not use for incoming payment requests; use useIncomingPaymentRequestHistory instead.
 *
 * Parameters:
 * - `filter`: Optional query filters and refresh config. Nullable: yes.
 * - `filter.status`: Optional payment status filter. Nullable: yes.
 * - `filter.isPendingPayment`: Optional pending payment filter. Nullable: yes.
 * - `filter.limit`: Optional page size. Nullable: yes.
 * - `filter.offset`: Optional offset. Nullable: yes.
 * - `filter.autoRefreshMs`: Optional refresh interval in ms (polling fallback only when realtime is unavailable). Nullable: yes.
 *
 * Return semantics:
 * - Returns payment list with counts and fetch helpers.
 *
 * Errors/failure modes:
 * - Captures network errors and exposes them via `error`.
 *
 * Side effects:
 * - Issues API calls on mount/refresh.
 *
 * Invariants/assumptions:
 * - `payments` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/payments/send` (apps/api, bearer token).
 *
 * @example
 * const { payments } = useSendPaymentHistory({ isPendingPayment: true });
 *
 * @see /api/v1/payments/send
 */
export declare const useSendPaymentHistory: (filter?: {
    status?: string;
    isPendingPayment?: boolean;
    limit?: number;
    offset?: number;
    autoRefreshMs?: number;
}) => {
    payments: import("@xkova/sdk-core").SendPayment[];
    total: number;
    count: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
};
/**
 * Submits a send payment for the authenticated user.
 *
 * @remarks
 * Purpose:
 * - Create and submit a send payment record after IEE (SafeApprove) approval for `send_payment_submit_v1`.
 *
 * When to use:
 * - Use when you need to submit a send payment; the SDK will obtain the IEE (SafeApprove) receipt when possible.
 *
 * When not to use:
 * - Do not use when unauthenticated. In non-browser contexts, provide a receipt explicitly.
 *
 * Parameters:
 * - None. Hook-only; call `submit(payload, { receipt })` to execute.
 *
 * Return semantics:
 * - Returns the submitted send payment record.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated, required fields are missing, IEE (SafeApprove) approval fails/cancels, or when the API rejects the request.
 *
 * Side effects:
 * - Issues a POST request to `/payments/send` (with IEE (SafeApprove) receipt) and invalidates `payments`.
 * - Omits empty optional string fields to satisfy apps/api validation.
 *
 * Data/auth references:
 * - `/api/v1/payments/send` (apps/api, bearer token + IEE (SafeApprove) receipt).
 */
export declare const useSubmitSendPayment: () => {
    submit: (payload: SubmitSendPaymentInput, options?: {
        receipt?: string | null;
    }) => Promise<SendPayment>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Cancel a pending send payment (sender only).
 *
 * @remarks
 * Purpose:
 * - Cancel a pending send payment and notify the recipient if applicable.
 * - Invalidates the `payments` resource after success.
 *
 * When to use:
 * - Use when the sender wants to cancel an outstanding payment before completion.
 *
 * When not to use:
 * - Do not use for completed or failed payments.
 *
 * Parameters:
 * - None. Hook-only; call `cancel(paymentId, { receipt })` to execute. If no receipt is provided, the SDK runs IEE (SafeApprove) when possible.
 *
 * Return semantics:
 * - Returns `{ cancel, isLoading, error }`.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when the API rejects the request.
 *
 * Side effects:
 * - Issues a POST request to `/payments/send/:paymentId/cancel` (with IEE (SafeApprove) receipt).
 *
 * Invariants/assumptions:
 * - `paymentId` must be a valid payment identifier.
 *
 * Data/auth references:
 * - `/api/v1/payments/send/:paymentId/cancel` (apps/api, bearer token + IEE (SafeApprove) receipt).
 */
export declare const useCancelSendPayment: () => {
    cancel: (paymentId: string, options?: {
        receipt?: string | null;
    }) => Promise<PaymentActionResult>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Send a reminder for a pending send payment.
 *
 * @remarks
 * Purpose:
 * - Trigger a reminder notification for a pending send payment.
 * - Invalidates the `payments` resource after success.
 *
 * When to use:
 * - Use when the sender wants to remind the recipient.
 *
 * When not to use:
 * - Do not use for completed or expired payments.
 *
 * Parameters:
 * - None. Hook-only; call `remind(paymentId, { receipt })` to execute.
 * - When `receipt` is omitted, the hook launches the IEE (SafeApprove) approval flow.
 *
 * Return semantics:
 * - Returns `{ remind, isLoading, error }`.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when the API rejects the request.
 *
 * Side effects:
 * - Launches the IEE (SafeApprove) approval UI when no receipt is provided.
 * - Issues a POST request to `/payments/send/:paymentId/remind` (with IEE (SafeApprove) receipt).
 *
 * Invariants/assumptions:
 * - `paymentId` must be a valid payment identifier.
 *
 * Data/auth references:
 * - `/api/v1/payments/send/:paymentId/remind` (apps/api, bearer token + IEE (SafeApprove) receipt).
 */
export declare const useRemindSendPayment: () => {
    remind: (paymentId: string, options?: {
        receipt?: string | null;
    }) => Promise<PaymentActionResult>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Verify a transaction for a send payment.
 *
 * @remarks
 * Purpose:
 * - Validate an on-chain transaction hash and mark the payment completed when valid.
 * - Invalidates the `payments` resource after success.
 *
 * When to use:
 * - Use when you have a transaction hash to verify a pending payment.
 *
 * When not to use:
 * - Do not use without a transaction hash.
 *
 * Parameters:
 * - None. Hook-only; call `verify(paymentId, { transactionHash, network }, { receipt })`.
 * - When `receipt` is omitted, the hook launches the IEE (SafeApprove) approval flow.
 *
 * Return semantics:
 * - Returns `{ verify, isLoading, error }`.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when the API rejects the request.
 *
 * Side effects:
 * - Issues a POST request to `/payments/send/:paymentId/verify` (with IEE (SafeApprove) receipt).
 *
 * Invariants/assumptions:
 * - `transactionHash` must be a 0x-prefixed hash.
 *
 * Data/auth references:
 * - `/api/v1/payments/send/:paymentId/verify` (apps/api, bearer token + IEE (SafeApprove) receipt).
 */
export declare const useVerifySendPaymentTransaction: () => {
    verify: (paymentId: string, params: {
        transactionHash: string;
        network?: string;
    }, options?: {
        receipt?: string | null;
    }) => Promise<TransactionVerificationResult>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Record an on-chain pending payment cancel transaction (IEE (SafeApprove)-gated).
 *
 * @remarks
 * Purpose:
 * - Persist the on-chain cancel transaction hash for a pending send payment.
 * - Requires an IEE (SafeApprove) receipt header for authorization.
 *
 * When to use:
 * - Use after (or during) the IEE (SafeApprove) flow for pending-payment cancel; the SDK can obtain the receipt automatically.
 *
 * When not to use:
 * - Do not use without a cancel transaction hash; in non-browser contexts provide a receipt explicitly.
 *
 * Parameters:
 * - None. Hook-only; call `cancelOnchain(paymentId, { cancelTxHash, receipt })`.
 * - When `receipt` is omitted, the hook launches the IEE (SafeApprove) approval flow.
 *
 * Return semantics:
 * - Returns `{ cancelOnchain, isLoading, error }`.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when the API rejects the request.
 *
 * Side effects:
 * - Issues a POST request to `/payments/send/:paymentId/pending-payment/cancel`.
 *
 * Invariants/assumptions:
 * - `cancelTxHash` must be a 0x-prefixed hash.
 *
 * Data/auth references:
 * - `/api/v1/payments/send/:paymentId/pending-payment/cancel` (apps/api, bearer token + IEE (SafeApprove) receipt).
 */
export declare const useCancelPendingPaymentOnchain: () => {
    cancelOnchain: (paymentId: string, params: {
        cancelTxHash: string;
        receipt?: string | null;
    }) => Promise<PaymentActionResult>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Resolve the pending payments contract for a tenant network.
 *
 * @remarks
 * Purpose:
 * - Return the pending payments contract address for a tenant network.
 *
 * When to use:
 * - Use before sending or canceling pending payments on-chain.
 *
 * When not to use:
 * - Do not use when tenant networks are not loaded; wait for bootstrap data.
 *
 * - Reads `pendingPaymentsContract` from tenant bootstrap data.
 *
 * Parameters:
 * - `networkId`: Optional network identifier override. Nullable: yes.
 *
 * Return semantics:
 * - Returns `{ data, error }` plus legacy top-level fields (`contract`, `networkId`, `networkName`).
 * - `data` is null until loaded or when an error is present.
 *
 * Errors/failure modes:
 * - Does not throw; returns `error` when the network or pending payments contract is missing (once loaded).
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `contract` is a 0x-prefixed identifier when present.
 *
 * Data/auth references:
 * - Derived from tenant bootstrap network metadata.
 *
 * @example
 * const { data, error } = usePendingPaymentsContract();
 */
export declare const usePendingPaymentsContract: (networkId?: number | string) => {
    data: {
        contract: string;
        networkId: string | null;
        networkName: string | null;
    } | null;
    error: Error | null;
    contract: string | null;
    networkId: string | null;
    networkName: string | null;
};
