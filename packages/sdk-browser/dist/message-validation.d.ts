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
export declare const getTrustedIeeMessageData: (params: {
    expectedOrigin: string;
    receiptRequestId: string;
    event: MessageEvent;
}) => Record<string, unknown> | null;
