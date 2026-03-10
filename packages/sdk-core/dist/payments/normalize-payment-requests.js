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
export const normalizePaymentRequestsList = (payload) => {
    const list = (payload?.paymentRequests ?? payload?.requests ?? []);
    return {
        requests: list,
        paymentRequests: list,
        total: Number(payload?.total ?? 0),
        count: Number(payload?.count ?? list.length),
        filters: payload?.filters ?? undefined
    };
};
