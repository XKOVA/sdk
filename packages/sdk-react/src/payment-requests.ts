import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildSubmitSendPaymentBody,
  normalizePaymentRequestsList,
  normalizeSubmitSendPaymentInput,
} from "@xkova/sdk-core";
import { parseUnits } from "viem";
import { useSDK } from "./provider.js";
import { emitResourceUpdate, subscribeResourceUpdate } from "./resources.js";
import { resolvePollingFallbackMs } from "./realtime.js";
import { useAccountState, useTenantConfig } from "./tenant.js";
import { type SendPayment, type SubmitSendPaymentInput } from "./payments.js";

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
export const useIncomingPaymentRequestHistory = (filter?: {
  type?: "P2P" | "BUSINESS";
  status?: string;
  limit?: number;
  offset?: number;
  autoRefreshMs?: number;
}) => {
  const { apiClient, state, realtime } = useSDK();
  const filterType = filter?.type;
  const filterStatus = filter?.status;
  const filterLimit = filter?.limit;
  const filterOffset = filter?.offset;
  const refreshMs = resolvePollingFallbackMs(filter?.autoRefreshMs, realtime);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRefreshRef = useRef(false);

  const fetch = useCallback(async (options?: { skipLoading?: boolean }) => {
    if (state.status !== "authenticated") return;
    const isBackground = options?.skipLoading === true;
    const inFlight = abortRef.current && abortRef.current.signal.aborted === false;
    if (isBackground && inFlight) {
      pendingRefreshRef.current = true;
      return;
    }
    if (!isBackground) {
      setIsLoading(true);
      if (inFlight) abortRef.current?.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterLimit !== undefined) params.set("limit", String(filterLimit));
      if (filterOffset !== undefined) params.set("offset", String(filterOffset));
      const path = `/payments/requests/incoming${params.toString() ? `?${params.toString()}` : ""}`;
      const raw = await apiClient.get<PaymentRequestsListResponse>(path, controller.signal);
      const normalized = normalizePaymentRequestsList(raw);
      setRequests(normalized.requests);
      setTotal(normalized.total);
      setCount(normalized.count);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err as Error);
    } finally {
      if (controller.signal.aborted) return;
      if (!isBackground) {
        setIsLoading(false);
      }
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        void fetch({ skipLoading: true });
      }
    }
  }, [apiClient, filterLimit, filterOffset, filterStatus, filterType, state.status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!refreshMs || refreshMs <= 0 || state.status !== "authenticated") return;
    const interval = setInterval(() => {
      fetch({ skipLoading: true });
    }, refreshMs);
    return () => clearInterval(interval);
  }, [fetch, refreshMs, state.status]);

  const refetch = useCallback(() => fetch(), [fetch]);
  useEffect(() => {
    return subscribeResourceUpdate("payment-requests", () => {
      void fetch({ skipLoading: true });
    });
  }, [fetch]);
  return { requests, total, count, isLoading, error, refetch };
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
export const usePendingPaymentRequestsInbox = (
  options?: PendingPaymentRequestsInboxOptions,
) => {
  const incoming = useIncomingPaymentRequestHistory({
    type: options?.type,
    status: "pending",
    limit: options?.limit,
    offset: options?.offset,
    autoRefreshMs: options?.autoRefreshMs,
  });
  const decline = useDeclinePaymentRequest();

  return {
    ...incoming,
    decline: decline.decline,
    isDeclining: decline.isLoading,
    declineError: decline.error,
  };
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
export const useOutgoingPaymentRequestHistory = (filter?: {
  type?: "P2P" | "BUSINESS";
  status?: string;
  limit?: number;
  offset?: number;
  autoRefreshMs?: number;
}) => {
  const { apiClient, state, realtime } = useSDK();
  const filterType = filter?.type;
  const filterStatus = filter?.status;
  const filterLimit = filter?.limit;
  const filterOffset = filter?.offset;
  const refreshMs = resolvePollingFallbackMs(filter?.autoRefreshMs, realtime);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRefreshRef = useRef(false);

  const fetch = useCallback(async (options?: { skipLoading?: boolean }) => {
    if (state.status !== "authenticated") return;
    const isBackground = options?.skipLoading === true;
    const inFlight = abortRef.current && abortRef.current.signal.aborted === false;
    if (isBackground && inFlight) {
      pendingRefreshRef.current = true;
      return;
    }
    if (!isBackground) {
      setIsLoading(true);
      if (inFlight) abortRef.current?.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterLimit !== undefined) params.set("limit", String(filterLimit));
      if (filterOffset !== undefined) params.set("offset", String(filterOffset));
      const path = `/payments/requests/transactions${params.toString() ? `?${params.toString()}` : ""}`;
      const raw = await apiClient.get<PaymentRequestsListResponse>(path, controller.signal);
      const normalized = normalizePaymentRequestsList(raw);
      setRequests(normalized.requests);
      setTotal(normalized.total);
      setCount(normalized.count);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err as Error);
    } finally {
      if (controller.signal.aborted) return;
      if (!isBackground) {
        setIsLoading(false);
      }
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        void fetch({ skipLoading: true });
      }
    }
  }, [apiClient, filterLimit, filterOffset, filterStatus, filterType, state.status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!refreshMs || refreshMs <= 0 || state.status !== "authenticated") return;
    const interval = setInterval(() => {
      fetch({ skipLoading: true });
    }, refreshMs);
    return () => clearInterval(interval);
  }, [fetch, refreshMs, state.status]);

  const refetch = useCallback(() => fetch(), [fetch]);
  useEffect(() => {
    return subscribeResourceUpdate("payment-requests", () => {
      void fetch({ skipLoading: true });
    });
  }, [fetch]);
  return { requests, total, count, isLoading, error, refetch };
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
export const useCreatePaymentRequest = () => {
  const { apiClient, state, iee } = useSDK();
  const { account } = useAccountState();
  const { tokens, networks } = useTenantConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (
    params: {
    payerEmail: string;
    /** Human amount in the tenant primary token units (usually stablecoin). Example: "12.34". */
    amount: string;
    description?: string;
    expiresAt?: string;
    /** Optional override: provide a specific account identifier for the request. */
    requestorAccount?: string;
    /** Optional override: provide a specific network id. */
    networkId?: string;
    },
    options?: { receipt?: string | null },
  ): Promise<PaymentRequest> => {
    if (state.status !== "authenticated") {
      throw new Error("User is not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const payerEmail = String(params.payerEmail || "").trim();
      if (!payerEmail) throw new Error("payerEmail is required");

      const requestorAccount = params.requestorAccount ?? account ?? null;
      if (!requestorAccount) throw new Error("No account available for requestor");

      // Match API behavior: prefers tenant primary token for request settlement token.
      const primaryToken =
        (tokens || []).find((t: any) => (t as any).isPrimary) ??
        (tokens || []).find((t: any) => (t as any).isDefault) ??
        (tokens || [])[0] ??
        null;
      const decimals = Number((primaryToken as any)?.decimals ?? 18);

      const amount = String(params.amount || "").trim();
      if (!amount || Number(amount) <= 0) throw new Error("amount must be > 0");
      const amountWei = parseUnits(amount, decimals).toString();

      const networkId =
        params.networkId ??
        (networks || []).find((n: any) => n?.networkId)?.networkId ??
        (networks || [])[0]?.networkId ??
        "43113";
      const expiresAtRaw = typeof params.expiresAt === "string" ? params.expiresAt.trim() : "";
      const expiresAt =
        expiresAtRaw.length > 0
          ? expiresAtRaw
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      type CreatePaymentRequestBody = {
        type: "P2P";
        transactionType: string;
        amountWei: string;
        feeAmountWei: string;
        account: string;
        payerEmail: string;
        description?: string;
        expiresAt: string;
        networkId?: string;
      };

      const body: CreatePaymentRequestBody = {
        type: "P2P",
        transactionType: "p2p_request",
        amountWei,
        feeAmountWei: "0",
        account: requestorAccount,
        payerEmail,
        ...(params.description ? { description: params.description } : {}),
        expiresAt,
        ...(networkId ? { networkId: String(networkId) } : {}),
      };
      const approval = await iee.ensureReceipt({
        actionType: "payment_request_create",
        payload: {
          payment_request_type: body.type,
          transaction_type: body.transactionType,
          amount_wei: body.amountWei,
          fee_amount_wei: body.feeAmountWei,
          network_id: body.networkId ?? "",
          account: body.account,
          payer_email: body.payerEmail,
          note: body.description ?? "",
          currency: "",
          expires_at: body.expiresAt,
        },
        receipt: options?.receipt,
      });

      const result = await apiClient.post<CreatePaymentRequestBody, PaymentRequest>(
        `/payments/requests`,
        body,
        { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
      );
      emitResourceUpdate("payment-requests");
      return result;
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, account, iee, networks, state.status, tokens]);

  return { create, isLoading, error };
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
export const useCancelPaymentRequest = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cancel = useCallback(async (requestId: string, options?: { receipt?: string | null }) => {
    if (state.status !== "authenticated") {
      throw new Error("User must be authenticated to cancel a payment request");
    }
    const approval = await iee.ensureReceipt({
      actionType: "payment_request_cancel",
      payload: { payment_request_id: requestId },
      receipt: options?.receipt,
    });
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<{}, { success: boolean; message: string }>(
        `/payments/requests/${requestId}/cancel`,
        {},
        { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
      );
      emitResourceUpdate("payment-requests");
      return result;
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, iee, state.status]);

  return { cancel, isLoading, error };
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
export const useDeclinePaymentRequest = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const decline = useCallback(async (requestId: string, options?: { receipt?: string | null }) => {
    if (state.status !== "authenticated") {
      throw new Error("User must be authenticated to decline a payment request");
    }
    const approval = await iee.ensureReceipt({
      actionType: "payment_request_decline",
      payload: { payment_request_id: requestId },
      receipt: options?.receipt,
    });
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<{}, { success: boolean; message: string }>(
        `/payments/requests/${requestId}/decline`,
        {},
        { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
      );
      emitResourceUpdate("payment-requests");
      return result;
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, iee, state.status]);

  return { decline, isLoading, error };
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
export const useCompletePaymentRequest = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const complete = useCallback(
    async (
      requestId: string,
      input: CompletePaymentRequestInput,
      options?: { receipt?: string | null },
    ): Promise<PaymentRequestActionResult> => {
      if (state.status !== "authenticated") {
        throw new Error("User must be authenticated to complete a payment request");
      }

      const transactionHash = String(input?.transactionHash ?? "").trim();
      if (!transactionHash) {
        throw new Error("transactionHash is required to complete a payment request");
      }

      if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
        throw new Error("transactionHash must be a 0x-prefixed 32-byte hash");
      }

      const payload: Record<string, unknown> = {
        payment_request_id: requestId,
        transaction_hash: transactionHash,
      };
      if (input?.network) {
        payload.network = input.network;
      }

      const approval = await iee.ensureReceipt({
        actionType: "payment_request_complete",
        payload,
        receipt: options?.receipt,
      });

      setIsLoading(true);
      setError(null);
      try {
        const body = {
          transactionHash,
          ...(input?.network ? { network: input.network } : {}),
        };
        const result = await apiClient.post<typeof body, PaymentRequestActionResult>(
          `/payments/requests/${requestId}/complete`,
          body,
          { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
        );
        emitResourceUpdate("payment-requests");
        return result;
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, iee, state.status],
  );

  return { complete, isLoading, error };
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
export const usePayPendingPaymentRequest = () => {
  const { apiClient, state, iee } = useSDK();
  const { account } = useAccountState();
  const { complete } = useCompletePaymentRequest();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pay = useCallback(
    async (
      request: PaymentRequest,
      options?: PayPendingPaymentRequestOptions,
    ): Promise<PayPendingPaymentRequestResult> => {
      if (state.status !== "authenticated") {
        throw new Error("User must be authenticated to pay a payment request");
      }
      setIsLoading(true);
      setError(null);
      try {
        const requestId = String(request?.requestId ?? "").trim();
        if (!requestId) {
          throw new Error("requestId is required to pay a payment request");
        }
        const requestRowId = String(request?.id ?? "").trim();
        const idempotencyKey = requestRowId
          ? `payment_request:${requestRowId}`
          : `payment_request:${requestId}`;

        const recipientAccount = String(request?.account ?? "").trim();
        if (!recipientAccount) {
          throw new Error("request.account is required to pay a payment request");
        }

        const amountWei = String(request?.amountWei ?? "").trim();
        if (!amountWei) {
          throw new Error("amountWei is required to pay a payment request");
        }

        const networkId = String(request?.networkId ?? "").trim();
        if (!networkId) {
          throw new Error("networkId is required to pay a payment request");
        }

        const contract = String(request?.contract ?? "").trim();
        if (!contract) {
          throw new Error("contract is required to pay a payment request");
        }

        const transactionType = String(
          options?.sendTransactionType ?? request?.transactionType ?? "",
        ).trim();
        if (!transactionType) {
          throw new Error("sendTransactionType is required to submit a send payment");
        }
        if (transactionType === "p2p_request" || transactionType === "store_request") {
          throw new Error(
            "sendTransactionType must be a send/payment transaction type (not a request type)",
          );
        }

        const description =
          typeof options?.description === "string"
            ? options.description
            : typeof request?.description === "string"
              ? request.description
              : undefined;

        const expiresAtRaw = typeof options?.expiresAt === "string" ? options.expiresAt.trim() : "";
        const expiresAt =
          expiresAtRaw.length > 0
            ? expiresAtRaw
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const providedTxHash =
          typeof options?.sendTransactionHash === "string"
            ? options.sendTransactionHash.trim()
            : "";

        const sendPayload: SubmitSendPaymentInput = {
          transactionType,
          amountWei,
          networkId,
          recipientContact: recipientAccount,
          recipientAccount,
          senderAccount: options?.senderAccount ?? account ?? undefined,
          contract,
          idempotencyKey,
          ...(request?.tokenSymbol ? { tokenSymbol: request.tokenSymbol } : {}),
          ...(Number.isFinite(request?.tokenDecimals)
            ? { tokenDecimals: request.tokenDecimals }
            : {}),
          ...(description ? { description } : {}),
          isPendingPayment: false,
          expiresAt,
          transactionHash: providedTxHash,
        };

        const { normalized, receiptPayload } = normalizeSubmitSendPaymentInput(sendPayload);
        const approval = await iee.ensureReceipt({
          actionType: "send_payment_submit",
          payload: receiptPayload as unknown as Record<string, unknown>,
          receipt: options?.sendReceipt,
        });

        const body = buildSubmitSendPaymentBody({
          input: sendPayload,
          normalized,
          approval,
        });

        const sendPayment = await apiClient.post<SubmitSendPaymentInput, SendPayment>(
          "/payments/send",
          body,
          { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
        );
        emitResourceUpdate("payments");

        const transactionHash = String(body.transactionHash ?? sendPayment?.transactionHash ?? "").trim();
        if (!transactionHash) {
          throw new Error("Send payment did not resolve a transaction hash");
        }

        const completion = await complete(
          requestId,
          { transactionHash, network: networkId },
          { receipt: options?.completeReceipt },
        );

        return { sendPayment, completion, transactionHash };
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [account, apiClient, complete, iee, state.status],
  );

  return {
    pay,
    isLoading,
    error,
  };
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
export const useRemindPaymentRequest = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remind = useCallback(async (requestId: string, options?: { receipt?: string | null }) => {
    if (state.status !== "authenticated") {
      throw new Error("User must be authenticated to remind a payment request");
    }
    const approval = await iee.ensureReceipt({
      actionType: "payment_request_remind",
      payload: { payment_request_id: requestId },
      receipt: options?.receipt,
    });
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<{}, PaymentRequestActionResult>(
        `/payments/requests/${requestId}/remind`,
        {},
        { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
      );
      emitResourceUpdate("payment-requests");
      return result;
    } catch (err) {
      const e = err as Error;
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, iee, state.status]);

  return { remind, isLoading, error };
};
