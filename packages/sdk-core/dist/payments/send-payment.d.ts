import { type IeeReceiptApproval } from "../iee-orchestration.js";
/**
 * Payload for submitting a send payment.
 *
 * @remarks
 * - Mirrors `SubmitSendPaymentDto` from apps/api (camelCase).
 * - Use `amountWei` for base-unit precision.
 * - `recipientContact` is required; additional recipient fields are optional.
 * - `idempotencyKey` can be used to prevent duplicate send-payment inserts.
 */
export interface SubmitSendPaymentInput {
    transactionType: string;
    amountWei: string;
    networkId: string;
    recipientContact: string;
    contactType?: string;
    recipientEmail?: string;
    recipientProfileId?: string;
    recipientName?: string;
    recipientAccount?: string;
    senderAccount?: string;
    contract: string;
    tokenSymbol?: string;
    tokenDecimals?: number;
    description?: string;
    fingerprint?: string;
    isPendingPayment?: boolean;
    jwtToken?: string;
    expiresAt?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
    transactionHash: string;
}
export interface NormalizedSendPaymentSubmission {
    transactionType: string;
    amountWei: string;
    networkId: string;
    tokenAddress: string;
    recipientContact: string;
    contactType: string;
    recipientWallet?: string;
    recipientProfileId?: string;
    recipientName?: string;
    isPending: boolean;
    fingerprint?: string;
    expiresAt: string;
    note: string;
}
export interface SendPaymentReceiptPayload {
    transaction_type: string;
    amount_wei: string;
    network_id: string;
    token_address: string;
    recipient_contact: string;
    contact_type: string;
    recipient_wallet_address?: string;
    recipient_profile_id?: string;
    recipient_name?: string;
    note: string;
    is_pending_payment: boolean;
    expires_at: string;
    fingerprint?: string;
    idempotency_key?: string;
}
/**
 * Normalize and validate send-payment submission input.
 *
 * @remarks
 * Purpose:
 * - Apply the same validation, trimming, and defaults as the sdk-react hook.
 * - Produce a receipt payload for IEE (SafeApprove) approval.
 *
 * Return semantics:
 * - Returns normalized values and the receipt payload.
 *
 * Errors/failure modes:
 * - Throws with the same error messages as useSubmitSendPayment for invalid inputs.
 */
export declare const normalizeSubmitSendPaymentInput: (payload: SubmitSendPaymentInput) => {
    normalized: NormalizedSendPaymentSubmission;
    receiptPayload: SendPaymentReceiptPayload;
};
/**
 * Resolve a send-payment submission body using IEE (SafeApprove) approval data.
 *
 * @remarks
 * Purpose:
 * - Apply IEE (SafeApprove)-resolved payload overrides.
 * - Enforce transaction hash matching and required fields.
 *
 * Return semantics:
 * - Returns the final request body for `/payments/send`.
 *
 * Errors/failure modes:
 * - Throws with the same error messages as useSubmitSendPayment on mismatch/absence.
 */
export declare const buildSubmitSendPaymentBody: (params: {
    input: SubmitSendPaymentInput;
    normalized: NormalizedSendPaymentSubmission;
    approval: Pick<IeeReceiptApproval, "resolvedPayload" | "transactionHash" | "userOpHash">;
}) => SubmitSendPaymentInput;
