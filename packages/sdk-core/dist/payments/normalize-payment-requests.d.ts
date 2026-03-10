import { type PaymentRequest, type PaymentRequestsListResponse } from "../types.js";
export interface NormalizedPaymentRequestsList {
    requests: PaymentRequest[];
    paymentRequests: PaymentRequest[];
    total: number;
    count: number;
    filters?: Record<string, any>;
}
/**
 * Normalize payment request list responses from apps/api.
 *
 * @remarks
 * Purpose:
 * - Provide a stable list shape for SDK consumers.
 *
 * Return semantics:
 * - Returns normalized list fields and numeric totals.
 */
export declare const normalizePaymentRequestsList: (payload: PaymentRequestsListResponse | null | undefined) => NormalizedPaymentRequestsList;
