import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSubmitSendPaymentBody,
  normalizeSubmitSendPaymentInput,
} from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { emitResourceUpdate, subscribeResourceUpdate } from "./resources.js";
import { resolvePollingFallbackMs } from "./realtime.js";
import { useTenantConfig } from "./tenant.js";

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
export const useSendPaymentHistory = (filter?: {
  status?: string;
  isPendingPayment?: boolean;
  limit?: number;
  offset?: number;
  autoRefreshMs?: number;
}) => {
  const { apiClient, state, realtime } = useSDK();
  const autoRefreshMs = resolvePollingFallbackMs(filter?.autoRefreshMs, realtime);
  const [payments, setPayments] = useState<SendPayment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    if (state.status !== "authenticated") return;
    setIsLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const params = new URLSearchParams();
      if (filter?.status) params.set("status", filter.status);
      if (filter?.isPendingPayment !== undefined) {
        params.set("isPendingPayment", String(filter.isPendingPayment));
      }
      if (filter?.limit !== undefined) params.set("limit", String(filter.limit));
      if (filter?.offset !== undefined) params.set("offset", String(filter.offset));
      const path = `/payments/send${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await apiClient.get<{ payments: SendPayment[]; total: number; count: number }>(
        path,
        controller.signal
      );
      // APIClient unwraps the envelope, so response is already { payments, total, count }
      const allPayments = response.payments || [];
      setPayments(allPayments);
      setTotal(Number(response.total ?? 0));
      setCount(Number(response.count ?? allPayments.length));
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err as Error);
    } finally {
      if (controller.signal.aborted) return;
      setIsLoading(false);
    }
  }, [apiClient, filter, state.status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!autoRefreshMs || state.status !== "authenticated") return;
    const interval = setInterval(() => {
      fetch();
    }, autoRefreshMs);
    return () => clearInterval(interval);
  }, [autoRefreshMs, fetch, state.status]);

  const refetch = useCallback(() => fetch(), [fetch]);

  useEffect(() => {
    return subscribeResourceUpdate("payments", () => {
      void refetch();
    });
  }, [refetch]);

  return { payments, total, count, isLoading, error, refetch };
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
export const useSubmitSendPayment = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(
    async (
      payload: SubmitSendPaymentInput,
      options?: { receipt?: string | null },
    ): Promise<SendPayment> => {
      if (state.status !== "authenticated") {
        throw new Error("User must be authenticated to submit a send payment");
      }

      const { normalized, receiptPayload } = normalizeSubmitSendPaymentInput(payload);
      const approval = await iee.ensureReceipt({
        actionType: "send_payment_submit",
        payload: receiptPayload as unknown as Record<string, unknown>,
        receipt: options?.receipt,
      });

      const body = buildSubmitSendPaymentBody({
        input: payload,
        normalized,
        approval,
      });

      setIsLoading(true);
      setError(null);
      try {
        const result = await apiClient.post<SubmitSendPaymentInput, SendPayment>(
          "/payments/send",
          body,
          { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
        );
        emitResourceUpdate("payments");
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

  return { submit, isLoading, error };
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
export const useCancelSendPayment = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cancel = useCallback(async (paymentId: string, options?: { receipt?: string | null }) => {
    if (state.status !== "authenticated") {
      throw new Error("User must be authenticated to cancel a send payment");
    }
    const approval = await iee.ensureReceipt({
      actionType: "send_payment_cancel",
      payload: { payment_transfer_id: paymentId },
      receipt: options?.receipt,
    });
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<{}, PaymentActionResult>(
        `/payments/send/${paymentId}/cancel`,
        {},
        { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
      );
      emitResourceUpdate("payments");
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
export const useRemindSendPayment = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remind = useCallback(async (paymentId: string, options?: { receipt?: string | null }) => {
    if (state.status !== "authenticated") {
      throw new Error("User must be authenticated to remind a send payment");
    }
    const approval = await iee.ensureReceipt({
      actionType: "send_payment_remind",
      payload: { payment_transfer_id: paymentId },
      receipt: options?.receipt,
    });
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<{}, PaymentActionResult>(
        `/payments/send/${paymentId}/remind`,
        {},
        { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
      );
      emitResourceUpdate("payments");
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
export const useVerifySendPaymentTransaction = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const verify = useCallback(
    async (
      paymentId: string,
      params: { transactionHash: string; network?: string },
      options?: { receipt?: string | null },
    ) => {
      if (state.status !== "authenticated") {
        throw new Error("User must be authenticated to verify a send payment");
      }
      const approval = await iee.ensureReceipt({
        actionType: "send_payment_verify",
        payload: {
          payment_transfer_id: paymentId,
          transaction_hash: params.transactionHash,
          ...(params.network ? { network: params.network } : {}),
        },
        receipt: options?.receipt,
      });
      setIsLoading(true);
      setError(null);
      try {
        const payload = {
          transactionHash: params.transactionHash,
          ...(params.network ? { network: params.network } : {}),
        };
        const result = await apiClient.post<typeof payload, TransactionVerificationResult>(
          `/payments/send/${paymentId}/verify`,
          payload,
          { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
        );
        emitResourceUpdate("payments");
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

  return { verify, isLoading, error };
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
export const useCancelPendingPaymentOnchain = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cancelOnchain = useCallback(
    async (paymentId: string, params: { cancelTxHash: string; receipt?: string | null }) => {
      if (state.status !== "authenticated") {
        throw new Error("User must be authenticated to cancel a pending payment on-chain");
      }
      const providedCancelTxHash = String(params.cancelTxHash ?? "").trim();
      const approval = await iee.ensureReceipt({
        actionType: "send_payment_cancel_onchain",
        payload: {
          payment_transfer_id: paymentId,
          cancel_tx_hash: providedCancelTxHash,
        },
        receipt: params.receipt,
      });
      const approvalTxHash = String(approval.transactionHash ?? "").trim();
      if (
        approvalTxHash &&
        providedCancelTxHash &&
        approvalTxHash.toLowerCase() !== providedCancelTxHash.toLowerCase()
      ) {
        throw new Error("cancelTxHash does not match SafeApprove approval");
      }
      const resolvedCancelTxHash = approvalTxHash || providedCancelTxHash;
      if (!resolvedCancelTxHash) {
        throw new Error("cancelTxHash is required to cancel a pending payment on-chain");
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiClient.post<{ cancelTxHash: string }, PaymentActionResult>(
          `/payments/send/${paymentId}/pending-payment/cancel`,
          { cancelTxHash: resolvedCancelTxHash },
          { headers: { "X-XKOVA-IEE-Receipt": approval.receipt } },
        );
        emitResourceUpdate("payments");
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

  return { cancelOnchain, isLoading, error };
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
export const usePendingPaymentsContract = (networkId?: number | string) => {
  const { networks, isLoading } = useTenantConfig();

  const targetNetworkId = networkId ?? networks?.[0]?.networkId;
  const normalizedNetworkId =
    targetNetworkId !== undefined && targetNetworkId !== null
      ? String(targetNetworkId)
      : null;

  const network = useMemo(
    () =>
      normalizedNetworkId
        ? networks.find((n) => String((n as any)?.networkId) === normalizedNetworkId)
        : undefined,
    [networks, normalizedNetworkId]
  );
  const pendingPaymentsContract =
    (network as any)?.pendingPaymentsContract ??
    (network as any)?.pending_payments_contract ??
    null;

  let error: Error | null = null;
  if (!isLoading && normalizedNetworkId && !network) {
    error = new Error(`No network found for network ${normalizedNetworkId}`);
  } else if (!isLoading && !pendingPaymentsContract) {
    error = new Error(
      `Pending payments contract not configured for network ${normalizedNetworkId ?? "default"}`,
    );
  }

  const data =
    !isLoading && !error && pendingPaymentsContract
      ? {
          contract: String(pendingPaymentsContract),
          networkId: network?.networkId ?? normalizedNetworkId ?? null,
          networkName: network?.name ?? null
        }
      : null;

  return {
    data,
    error,
    contract: data?.contract ?? null,
    networkId: data?.networkId ?? network?.networkId ?? normalizedNetworkId ?? null,
    networkName: data?.networkName ?? network?.name ?? null
  };
};
