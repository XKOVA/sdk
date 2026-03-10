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
export const normalizePaymentRequestsList = (
  payload: PaymentRequestsListResponse | null | undefined,
): NormalizedPaymentRequestsList => {
  const list = (payload?.paymentRequests ?? payload?.requests ?? []) as PaymentRequest[];
  return {
    requests: list,
    paymentRequests: list,
    total: Number((payload as any)?.total ?? 0),
    count: Number((payload as any)?.count ?? list.length),
    filters: (payload as any)?.filters ?? undefined
  };
};
