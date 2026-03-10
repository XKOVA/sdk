/**
 * Validate that a postMessage event is trusted for the active IEE request.
 *
 * @remarks
 * - Enforces exact origin match.
 * - Enforces matching `receipt_request_id` to prevent cross-request contamination.
 *
 * @param params - Validation inputs.
 * @returns Parsed message payload when trusted; otherwise `null`.
 */
export const getTrustedIeeMessageData = (params: {
  expectedOrigin: string;
  receiptRequestId: string;
  event: MessageEvent;
}): Record<string, unknown> | null => {
  if (params.event.origin !== params.expectedOrigin) {
    return null;
  }

  const data = params.event.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") {
    return null;
  }

  if (data["receipt_request_id"] !== params.receiptRequestId) {
    return null;
  }

  return data;
};

