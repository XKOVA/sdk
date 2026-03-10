import { type SendPayment } from "./payments.js";
/**
 * Payment request record returned by `/payments/requests`.
 *
 * @remarks
 * - Re-exported from `@xkova/sdk-core` to keep a single DTO source of truth.
 */
export type PaymentRequest = import("@xkova/sdk-core").PaymentRequest;
/**
 * Payment request action response payload.
 *
 * @remarks
 * - Mirrors `PaymentRequestActionDto` from apps/api.
 * - Returned by complete/cancel/decline/remind endpoints.
 */
export interface PaymentRequestActionResult {
    success: boolean;
    message: string;
    paymentRequest: PaymentRequest;
    actionTimestamp?: string;
}
/**
 * Raw list response shape for payment request endpoints.
 *
 * @remarks
 * - Re-exported from `@xkova/sdk-core` to keep a single DTO source of truth.
 */
export type PaymentRequestsListResponse = import("@xkova/sdk-core").PaymentRequestsListResponse;
export interface PendingPaymentRequestsInboxOptions {
    /** Optional request type filter ("P2P" | "BUSINESS"). */
    type?: "P2P" | "BUSINESS";
    /** Optional page size (defaults to API limit behavior). */
    limit?: number;
    /** Optional pagination offset. */
    offset?: number;
    /** Optional auto-refresh interval in ms. */
    autoRefreshMs?: number;
}
export interface CompletePaymentRequestInput {
    /** On-chain transaction hash proving payment completion. */
    transactionHash: string;
    /** Optional network identifier (string) where the transaction occurred. */
    network?: string;
}
export interface PayPendingPaymentRequestOptions {
    /**
     * Transaction type for the send-payment step.
     *
     * @remarks
     * Required when the request's `transactionType` is a request type (for example, `p2p_request`).
     */
    sendTransactionType?: string;
    /** Optional override for the send-payment expiration (ISO string). */
    expiresAt?: string;
    /** Optional override for the send-payment description/memo. */
    description?: string;
    /** Optional override for the sender account identifier. */
    senderAccount?: string;
    /**
     * Optional transaction hash for the send-payment step.
     *
     * @remarks
     * Required when providing `sendReceipt` without an IEE provider that returns a hash.
     */
    sendTransactionHash?: string;
    /** Optional SafeApprove receipt for the send-payment step. */
    sendReceipt?: string | null;
    /** Optional SafeApprove receipt for the completion step. */
    completeReceipt?: string | null;
}
export interface PayPendingPaymentRequestResult {
    /** Send-payment record created for the transfer. */
    sendPayment: SendPayment;
    /** Completion response for the payment request. */
    completion: PaymentRequestActionResult;
    /** Transaction hash recorded for the payment. */
    transactionHash: string;
}
/**
 * Fetch incoming payment_requests (where current user is the payer/recipient).
 *
 * @remarks
 * Purpose:
 * - List incoming payment requests for the authenticated user.
 * - Automatically refetches when the SDK invalidates the `payment-requests` resource.
 *
 * When to use:
 * - Use when showing requests where the user is the payer/recipient.
 *
 * When not to use:
 * - Do not use for outgoing requests; use useOutgoingPaymentRequestHistory instead.
 *
 * Parameters:
 * - filter: Optional query filters and pagination (object, optional).
 * - filter.type: Request type filter ("P2P" | "BUSINESS", optional).
 * - filter.status: Status filter (string, optional).
 * - filter.limit: Page size (number, optional).
 * - filter.offset: Offset (number, optional).
 * - filter.autoRefreshMs: Auto-refresh interval in ms (polling fallback only when realtime is unavailable) (number, optional).
 *
 * Return semantics:
 * - Returns requests, counts, loading/error state, and a refetch helper.
 *
 * Errors/failure modes:
 * - Sets `error` when the API request fails or is unauthorized.
 *
 * Side effects:
 * - Issues API calls to `/payments/requests/incoming` when authenticated.
 *
 * Invariants/assumptions:
 * - `requests` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests/incoming` (apps/api, bearer token).
 *
 * @example
 * const { requests } = useIncomingPaymentRequestHistory({ status: "pending" });
 */
export declare const useIncomingPaymentRequestHistory: (filter?: {
    type?: "P2P" | "BUSINESS";
    status?: string;
    limit?: number;
    offset?: number;
    autoRefreshMs?: number;
}) => {
    requests: import("@xkova/sdk-core").PaymentRequest[];
    total: number;
    count: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
};
/**
 * Fetch pending incoming payment requests for the authenticated user.
 *
 * @remarks
 * Purpose:
 * - Provide a ready-to-use pending requests data source for inbox surfaces.
 * - Wraps `useIncomingPaymentRequestHistory` with a fixed `status: "pending"` filter.
 *
 * When to use:
 * - Use when showing a pending-request inbox for the payer/recipient.
 *
 * When not to use:
 * - Do not use for outgoing requests created by the current user.
 *
 * Parameters:
 * - options: Optional filters and pagination (object, optional).
 * - options.type: Request type filter ("P2P" | "BUSINESS", optional).
 * - options.limit: Page size (number, optional).
 * - options.offset: Offset (number, optional).
 * - options.autoRefreshMs: Auto-refresh interval in ms (number, optional).
 *
 * Return semantics:
 * - Returns pending requests, counts, loading/error state, a refetch helper,
 *   and decline helpers (`decline`, `isDeclining`, `declineError`).
 *
 * Errors/failure modes:
 * - Sets `error` when the API request fails or is unauthorized.
 *
 * Side effects:
 * - Issues API calls to `/payments/requests/incoming` when authenticated.
 *
 * Invariants/assumptions:
 * - `requests` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests/incoming` (apps/api, bearer token).
 *
 * @example
 * const { requests } = usePendingPaymentRequestsInbox({ type: "P2P" });
 */
export declare const usePendingPaymentRequestsInbox: (options?: PendingPaymentRequestsInboxOptions) => {
    decline: (requestId: string, options?: {
        receipt?: string | null;
    }) => Promise<{
        success: boolean;
        message: string;
    }>;
    isDeclining: boolean;
    declineError: Error | null;
    requests: import("@xkova/sdk-core").PaymentRequest[];
    total: number;
    count: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
};
/**
 * Fetch outgoing payment_requests (created by the current user).
 *
 * @remarks
 * Purpose:
 * - List payment requests created by the authenticated user.
 * - Automatically refetches when the SDK invalidates the `payment-requests` resource.
 *
 * When to use:
 * - Use when showing requests created by the current user.
 *
 * When not to use:
 * - Do not use for incoming requests; use useIncomingPaymentRequestHistory instead.
 *
 * Parameters:
 * - filter: Optional query filters and pagination (object, optional).
 * - filter.type: Request type filter ("P2P" | "BUSINESS", optional).
 * - filter.status: Status filter (string, optional).
 * - filter.limit: Page size (number, optional).
 * - filter.offset: Offset (number, optional).
 * - filter.autoRefreshMs: Auto-refresh interval in ms (polling fallback only when realtime is unavailable) (number, optional).
 *
 * Return semantics:
 * - Returns requests, counts, loading/error state, and a refetch helper.
 *
 * Errors/failure modes:
 * - Sets `error` when the API request fails or is unauthorized.
 *
 * Side effects:
 * - Issues API calls to `/payments/requests/transactions` when authenticated.
 *
 * Invariants/assumptions:
 * - `requests` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests/transactions` (apps/api, bearer token).
 *
 * @example
 * const { requests } = useOutgoingPaymentRequestHistory({ status: "pending" });
 */
export declare const useOutgoingPaymentRequestHistory: (filter?: {
    type?: "P2P" | "BUSINESS";
    status?: string;
    limit?: number;
    offset?: number;
    autoRefreshMs?: number;
}) => {
    requests: import("@xkova/sdk-core").PaymentRequest[];
    total: number;
    count: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
};
/**
 * Creates a P2P payment request for the authenticated user.
 *
 * @remarks
 * Purpose:
 * - Create a P2P payment request using tenant token metadata and the current account.
 *
 * When to use:
 * - Use when an authenticated user wants to request payment from a payer.
 *
 * When not to use:
 * - Do not use for business payment requests or when unauthenticated.
 *
 * - Uses the tenant primary token metadata to convert `amount` to base units.
 * - Defaults to the primary account from `useAccountState` unless overridden.
 *
 * Parameters:
 * - None. Hook-only; call `create(...)` to perform the request.
 *
 * Return semantics:
 * - Returns `{ create, isLoading, error }`.
 *
 * Errors/failure modes:
 * - `create` throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when validation fails.
 *
 * Side effects:
 * - Launches the IEE (SafeApprove) approval UI when no receipt is provided.
 * - Issues a POST request to `/payments/requests` (with IEE (SafeApprove) receipt) and invalidates the `payment-requests` resource.
 *
 * Invariants/assumptions:
 * - `amount` must be a positive decimal string.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { create } = useCreatePaymentRequest();
 * await create({ payerEmail: "payer@example.com", amount: "12.34" }, { receipt });
 *
 * @see /api/v1/payments/requests
 */
export declare const useCreatePaymentRequest: () => {
    create: (params: {
        payerEmail: string;
        /** Human amount in the tenant primary token units (usually stablecoin). Example: "12.34". */
        amount: string;
        description?: string;
        expiresAt?: string;
        /** Optional override: provide a specific account identifier for the request. */
        requestorAccount?: string;
        /** Optional override: provide a specific network id. */
        networkId?: string;
    }, options?: {
        receipt?: string | null;
    }) => Promise<PaymentRequest>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Cancel a payment request (requester only).
 *
 * @remarks
 * Purpose:
 * - Cancel a payment request created by the current user.
 * - Invalidates the `payment-requests` resource after a successful cancel.
 *
 * When to use:
 * - Use when the requester needs to cancel an outstanding request.
 *
 * When not to use:
 * - Do not use for incoming requests you did not create; use useDeclinePaymentRequest instead.
 *
 * Parameters:
 * - None. Hook-only; call `cancel(requestId, { receipt })` to execute.
 * - When `receipt` is omitted, the hook launches the IEE (SafeApprove) approval flow.
 *
 * Return semantics:
 * - Returns `{ cancel, isLoading, error }`.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when the API rejects the request.
 *
 * Side effects:
 * - Launches the IEE (SafeApprove) approval UI when no receipt is provided.
 * - Issues a POST request to `/payments/requests/:requestId/cancel` (with IEE (SafeApprove) receipt).
 *
 * Invariants/assumptions:
 * - `requestId` must be a valid request identifier.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests/:requestId/cancel` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { cancel } = useCancelPaymentRequest();
 * await cancel("req_123", { receipt });
 */
export declare const useCancelPaymentRequest: () => {
    cancel: (requestId: string, options?: {
        receipt?: string | null;
    }) => Promise<{
        success: boolean;
        message: string;
    }>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Decline a payment request (recipient/payer only).
 *
 * @remarks
 * Purpose:
 * - Decline a payment request assigned to the current user.
 * - Invalidates the `payment-requests` resource after a successful decline.
 *
 * When to use:
 * - Use when the payer/recipient wants to reject a request.
 *
 * When not to use:
 * - Do not use for requests you created; use useCancelPaymentRequest instead.
 *
 * Parameters:
 * - None. Hook-only; call `decline(requestId, { receipt })` to execute.
 * - When `receipt` is omitted, the hook launches the IEE (SafeApprove) approval flow.
 *
 * Return semantics:
 * - Returns `{ decline, isLoading, error }`.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when the API rejects the request.
 *
 * Side effects:
 * - Issues a POST request to `/payments/requests/:requestId/decline` (with IEE (SafeApprove) receipt).
 *
 * Invariants/assumptions:
 * - `requestId` must be a valid request identifier.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests/:requestId/decline` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { decline } = useDeclinePaymentRequest();
 * await decline("req_123", { receipt });
 */
export declare const useDeclinePaymentRequest: () => {
    decline: (requestId: string, options?: {
        receipt?: string | null;
    }) => Promise<{
        success: boolean;
        message: string;
    }>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Complete (pay) a pending payment request after an on-chain transfer.
 *
 * @remarks
 * Purpose:
 * - Mark a pending request as completed after sending the payment on-chain.
 *
 * When to use:
 * - Use when you already have a transaction hash from an in-app payment flow.
 *
 * When not to use:
 * - Do not use if you want the hosted pay flow; open the hosted pay link instead.
 *
 * Parameters:
 * - None. Hook-only; call `complete(requestId, { transactionHash, network }, { receipt })`.
 * - `transactionHash` is required (0x-prefixed 32-byte hash).
 * - `network` is optional and forwarded to the API.
 * - When `receipt` is omitted, the hook launches the IEE (SafeApprove) approval flow.
 *
 * Return semantics:
 * - Returns `{ complete, isLoading, error }`.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated, missing/invalid transaction hash, IEE (SafeApprove) approval fails/cancels,
 *   or when the API rejects the request.
 *
 * Side effects:
 * - Issues a POST request to `/payments/requests/:requestId/complete` (with IEE (SafeApprove) receipt).
 * - Invalidates the `payment-requests` resource after success.
 *
 * Invariants/assumptions:
 * - The payment request must be pending and the caller must be the payer.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests/:requestId/complete` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { complete } = useCompletePaymentRequest();
 * await complete("req_123", { transactionHash: "0x..." });
 */
export declare const useCompletePaymentRequest: () => {
    complete: (requestId: string, input: CompletePaymentRequestInput, options?: {
        receipt?: string | null;
    }) => Promise<PaymentRequestActionResult>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Pay a pending payment request in-app (send payment + complete request).
 *
 * @remarks
 * Purpose:
 * - Orchestrate an in-app pay flow for a pending request.
 * - Submits a send payment, then completes the request with the resulting transaction hash.
 *
 * When to use:
 * - Use when you want to pay a pending request directly in your app.
 *
 * When not to use:
 * - Do not use if you already have a transaction hash and only need to mark completion
 *   (use useCompletePaymentRequest).
 * - Do not use for hosted pay links; open the hosted pay URL instead.
 *
 * Parameters:
 * - None. Hook-only; call `pay(request, options)`.
 * - `request` must include `requestId`, `account`, `amountWei`, `networkId`, and `contract`.
 * - `options.sendTransactionType` sets the transaction type used for the send-payment step
 *   (required when the request uses a request-type transaction value like `p2p_request`).
 * - `options.sendTransactionHash` supplies the transaction hash when you already have one.
 * - `options.sendReceipt` and `options.completeReceipt` bypass the IEE (SafeApprove) UI.
 *
 * Return semantics:
 * - Returns `{ pay, isLoading, error }`.
 *
 * Errors/failure modes:
 * - Throws when required request fields are missing, IEE approval fails/cancels,
 *   or when either API call is rejected.
 *
 * Side effects:
 * - Issues a POST request to `/payments/send` and `/payments/requests/:requestId/complete`
 *   (both IEE (SafeApprove) receipt-gated).
 * - Invalidates `payments` and `payment-requests` via the underlying hooks.
 * - Adds an idempotency key for the send-payment step to prevent duplicate payments.
 *
 * Invariants/assumptions:
 * - The payment request is still pending and the caller is the payer.
 *
 * Data/auth references:
 * - `/api/v1/payments/send` and `/api/v1/payments/requests/:requestId/complete`
 *   (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { pay } = usePayPendingPaymentRequest();
 * await pay(request);
 */
export declare const usePayPendingPaymentRequest: () => {
    pay: (request: PaymentRequest, options?: PayPendingPaymentRequestOptions) => Promise<PayPendingPaymentRequestResult>;
    isLoading: boolean;
    error: Error | null;
};
/**
 * Send a payment request reminder (requester only).
 *
 * @remarks
 * Purpose:
 * - Send a reminder notification for a pending payment request.
 * - Invalidates the `payment-requests` resource after success.
 *
 * When to use:
 * - Use when the requestor wants to nudge the payer.
 *
 * When not to use:
 * - Do not use for requests you did not create.
 *
 * Parameters:
 * - None. Hook-only; call `remind(requestId, { receipt })` to execute.
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
 * - Issues a POST request to `/payments/requests/:requestId/remind` (with IEE (SafeApprove) receipt).
 *
 * Invariants/assumptions:
 * - `requestId` must be a valid request identifier.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests/:requestId/remind` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { remind } = useRemindPaymentRequest();
 * await remind("req_123", { receipt });
 */
export declare const useRemindPaymentRequest: () => {
    remind: (requestId: string, options?: {
        receipt?: string | null;
    }) => Promise<PaymentRequestActionResult>;
    isLoading: boolean;
    error: Error | null;
};
