import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type TransferProvider,
  type TransferTransaction,
  type CreateTransferTransactionInput,
  type ExecuteFaucetTransferInput,
  type UpdateTransferTransactionInput,
  type TransferTransactionsListResult,
  type TransferTransactionsQuery,
  TransfersService,
} from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { emitResourceUpdate, subscribeResourceUpdate } from "./resources.js";
import { resolvePollingFallbackMs } from "./realtime.js";
import { useTenantConfig } from "./tenant.js";
import { normalizeTenantAuthBaseUrl } from "./shared.js";

/**
 * Fetches deposit/withdraw transfer activity for the authenticated user.
 *
 * @remarks
 * Purpose:
 * - List transfer-provider deposit/withdraw activity for the authenticated user.
 *
 * - Backed by `/api/v1/transfers/transactions`.
 * - This is a deposit/withdraw provider activity stream (not on-chain tx history).
 * - Uses offset pagination (`limit`/`offset`).
 * - Automatically refetches when the SDK invalidates the `transfers` resource.
 *
 * When to use:
 * - Use when showing transfer-provider deposits/withdrawals.
 *
 * When not to use:
 * - Do not use for on-chain transaction history; use useTransactionHistory instead.
 *
 * Parameters:
 * - `filter`: Optional query filters and refresh config. Nullable: yes.
 * - `filter.type`: Optional transfer type filter (`deposit` or `withdraw`). Nullable: yes.
 * - `filter.status`: Optional status filter. Nullable: yes.
 * - `filter.providerId`: Optional provider filter. Nullable: yes.
 * - `filter.networkId`: Optional network filter. Nullable: yes.
 * - `filter.cryptoSymbol`: Optional crypto symbol filter. Nullable: yes.
 * - `filter.startDate`: Optional start date filter (ISO string). Nullable: yes.
 * - `filter.endDate`: Optional end date filter (ISO string). Nullable: yes.
 * - `filter.limit`: Optional page size. Nullable: yes.
 * - `filter.offset`: Optional offset. Nullable: yes.
 * - `filter.autoRefreshMs`: Optional refresh interval in ms (polling fallback only when realtime is unavailable). Nullable: yes.
 *
 * Return semantics:
 * - Returns transfer transaction list with counts and fetch helpers.
 *
 * Errors/failure modes:
 * - Captures network/scope errors and exposes them via `error`.
 *
 * Side effects:
 * - Issues API calls on mount/refresh.
 *
 * Invariants/assumptions:
 * - `transactions` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api, bearer token).
 *
 * @example
 * const { transactions } = useTransferTransactions({ limit: 20, offset: 0 });
 *
 * @see TransfersService
 * @see /api/v1/transfers/transactions
 */
export const useTransferTransactions = (filter?: TransferTransactionsQuery & {
  autoRefreshMs?: number;
}) => {
  const { apiClient, state, iee, realtime } = useSDK();
  const autoRefreshMs = resolvePollingFallbackMs(filter?.autoRefreshMs, realtime);
  const [transactions, setTransactions] = useState<TransferTransaction[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const service = useMemo(
    () => new TransfersService({ client: apiClient, iee }),
    [apiClient, iee],
  );

  const fetch = useCallback(async () => {
    if (state.status !== "authenticated") return;
    setIsLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response: TransferTransactionsListResult = await service.listTransferTransactions({
        type: filter?.type,
        status: filter?.status,
        providerId: filter?.providerId,
        networkId: filter?.networkId,
        cryptoSymbol: filter?.cryptoSymbol,
        startDate: filter?.startDate,
        endDate: filter?.endDate,
        limit: filter?.limit,
        offset: filter?.offset,
      });

      const list = response.transactions || [];
      setTransactions(list);
      setTotal(Number(response.total ?? 0));
      setCount(Number(response.count ?? list.length));
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err as Error);
    } finally {
      if (controller.signal.aborted) return;
      setIsLoading(false);
    }
  }, [
    filter?.cryptoSymbol,
    filter?.endDate,
    filter?.limit,
    filter?.networkId,
    filter?.offset,
    filter?.providerId,
    filter?.startDate,
    filter?.status,
    filter?.type,
    service,
    state.status,
  ]);

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
    return subscribeResourceUpdate("transfers", () => {
      void refetch();
    });
  }, [refetch]);

  return { transactions, total, count, isLoading, error, refetch };
};

/**
 * Creates a transfer transaction record (deposit/withdraw provider activity).
 *
 * @remarks
 * Purpose:
 * - Create a transfer-provider transaction record in apps/api.
 *
 * - Backed by `POST /api/v1/transfers/transactions`.
 * - Requires `transfers` scope.
 *
 * When to use:
 * - Use when initiating a transfer-provider deposit/withdraw record.
 *
 * When not to use:
 * - Do not use for on-chain transfers; use signing flows instead.
 *
 * Parameters:
 * - None. Hook-only; call `create(...)` to execute.
 *
 * Return semantics:
 * - Returns `{ create, isLoading, error }`.
 *
 * Errors/failure modes:
 * - `create` throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when validation fails.
 *
 * Side effects:
 * - Issues a POST request to `/transfers/transactions` (with IEE (SafeApprove) receipt) and invalidates the `transfers` resource.
 *
 * Invariants/assumptions:
 * - `type` must be `deposit` or `withdraw`.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { create } = useCreateTransferTransaction();
 * const tx = await create({ ... }, { receipt });
 *
 * @see TransfersService
 * @see /api/v1/transfers/transactions
 */
export const useCreateTransferTransaction = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(
    () => new TransfersService({ client: apiClient, iee }),
    [apiClient, iee],
  );

  const create = useCallback(
    async (
      input: CreateTransferTransactionInput,
      options?: { receipt?: string | null },
    ): Promise<TransferTransaction> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.createTransferTransaction(input, options);
        emitResourceUpdate("transfers");
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [service, state.status],
  );

  return { create, isLoading, error };
};

/**
 * Executes a faucet transfer transaction (single-approval).
 *
 * @remarks
 * Purpose:
 * - Create and complete a faucet-backed transfer transaction in apps/api.
 *
 * - Backed by `POST /api/v1/transfers/transactions/faucet`.
 * - Requires `transfers` scope.
 *
 * When to use:
 * - Use when executing a faucet-backed transfer; the SDK will obtain the IEE (SafeApprove) receipt when possible.
 *
 * When not to use:
 * - Do not use for non-faucet providers; use `useCreateTransferTransaction` instead.
 *
 * Parameters:
 * - None. Hook-only; call `execute(...)` to run.
 *
 * Return semantics:
 * - Returns `{ execute, isLoading, error }`.
 *
 * Errors/failure modes:
 * - `execute` throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when validation fails.
 *
 * Side effects:
 * - Issues a POST request to `/transfers/transactions/faucet` (with IEE (SafeApprove) receipt) and invalidates the `transfers` resource.
 *
 * Invariants/assumptions:
 * - `transactionHash` must be a valid transaction hash.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions/faucet` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { execute } = useExecuteFaucetTransfer();
 * const tx = await execute({ ... }, { receipt });
 *
 * @see TransfersService
 * @see /api/v1/transfers/transactions/faucet
 */
export const useExecuteFaucetTransfer = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(
    () => new TransfersService({ client: apiClient, iee }),
    [apiClient, iee],
  );

  const execute = useCallback(
    async (
      input: ExecuteFaucetTransferInput,
      options?: { receipt?: string | null },
    ): Promise<TransferTransaction> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.executeFaucetTransfer(input, options);
        emitResourceUpdate("transfers");
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [service, state.status],
  );

  return { execute, isLoading, error };
};

/**
 * Updates an existing transfer transaction record (status/hash).
 *
 * @remarks
 * Purpose:
 * - Update transfer-provider transaction status or hashes in apps/api.
 *
 * - Backed by `PATCH /api/v1/transfers/transactions/:transactionId`.
 * - Requires `transfers` scope.
 *
 * When to use:
 * - Use when updating transfer-provider status or transaction hashes.
 * - Requires an IEE (SafeApprove) receipt header for `transfer_transaction_update_v1` (auto-collected when possible).
 * - Faucet transfers must use `useExecuteFaucetTransfer`.
 *
 * When not to use:
 * - Do not use when you cannot supply a valid transaction UUID.
 *
 * Parameters:
 * - None. Hook-only; call `update(...)` to execute.
 *
 * Return semantics:
 * - Returns `{ update, isLoading, error }`.
 *
 * Errors/failure modes:
 * - `update` throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when the request is rejected by the API.
 *
 * Side effects:
 * - Issues a PATCH request to `/transfers/transactions/:transactionId` and invalidates the `transfers` resource.
 *
 * Invariants/assumptions:
 * - `transactionId` must be a UUID.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions/:transactionId` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { update } = useUpdateTransferTransaction();
 * await update("uuid", { status: "completed", transactionHash: "0x..." }, { receipt });
 *
 * @see TransfersService
 * @see /api/v1/transfers/transactions
 */
export const useUpdateTransferTransaction = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(
    () => new TransfersService({ client: apiClient, iee }),
    [apiClient, iee],
  );

  const update = useCallback(
    async (
      transactionId: string,
      input: UpdateTransferTransactionInput,
      options?: { receipt?: string | null },
    ): Promise<TransferTransaction> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.updateTransferTransaction(transactionId, input, options);
        emitResourceUpdate("transfers");
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [service, state.status],
  );

  return { update, isLoading, error };
};

/**
 * Hosted transfer-provider widget session descriptor.
 *
 * @remarks
 * Purpose:
 * - Describe the iframe-ready widget session returned by the tenant auth domain.
 *
 * When to use:
 * - Use as the return type for useCreateTransferWidgetSession.create.
 *
 * When not to use:
 * - Do not use for non-transfer flows or server-only contexts.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `widgetUrl` is an absolute URL when provided by the server.
 *
 * Data/auth references:
 * - `/pay/transfer-providers/widget-session` (oauth-server hosted UI).
 *
 * @example
 * const { create } = useCreateTransferWidgetSession();
 * const session = await create({ providerId: "usdc-faucet", flow: "deposit" });
 */
export interface TransferProviderWidgetSession {
  sessionId: string;
  expiresIn: number;
  widgetPath: string | null;
  widgetUrl: string;
}

/**
 * Input payload for creating a transfer provider widget session.
 *
 * @remarks
 * Purpose:
 * - Provide provider identifier and flow direction for widget sessions.
 *
 * When to use:
 * - Use when calling useCreateTransferWidgetSession.create.
 *
 * When not to use:
 * - Do not use for non-transfer flows.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `providerId` is non-empty and `flow` is "deposit" or "withdraw".
 *
 * Data/auth references:
 * - `/pay/transfer-providers/widget-session` (oauth-server hosted UI).
 *
 * @property providerId - Transfer provider identifier.
 * @property flow - Deposit or withdraw flow.
 */
export interface CreateTransferProviderWidgetSessionInput {
  providerId: string;
  flow: "deposit" | "withdraw";
}

/**
 * Create hosted transfer-provider widget sessions.
 *
 * @remarks
 * Purpose:
 * - Request an iframe-ready widget URL from the tenant auth domain.
 *
 * When to use:
 * - Use when embedding provider widgets in browser UI.
 *
 * When not to use:
 * - Do not use when unauthenticated or without tenant authDomain configured.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ create, isLoading, error }`.
 *
 * Errors/failure modes:
 * - create throws on auth failures, missing tenant authDomain, or server errors.
 *
 * Side effects:
 * - Issues a cross-origin request to the tenant auth domain.
 *
 * Invariants/assumptions:
 * - Requires a valid access token and tenant authDomain.
 *
 * Data/auth references:
 * - `/pay/transfer-providers/widget-session` endpoint.
 */
export const useCreateTransferWidgetSession = () => {
  const { state, getAccessToken } = useSDK();
  const { tenant } = useTenantConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (input: CreateTransferProviderWidgetSessionInput): Promise<TransferProviderWidgetSession> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }

      const providerId = typeof input?.providerId === "string" ? input.providerId.trim() : "";
      if (!providerId) {
        throw new Error("providerId is required");
      }

      const flow = input?.flow === "withdraw" ? "withdraw" : "deposit";
      const authBaseUrl = normalizeTenantAuthBaseUrl(
        (tenant as any)?.authDomain ?? (tenant as any)?.auth_domain ?? null,
      );
      if (!authBaseUrl) {
        throw new Error("Tenant authDomain is not configured (cannot open hosted widget)");
      }

      setIsLoading(true);
      setError(null);
      try {
        const accessToken = await getAccessToken(false);
        if (!accessToken) {
          throw new Error("Access token unavailable");
        }

        const url = `${authBaseUrl}/pay/transfer-providers/widget-session`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "omit",
          body: JSON.stringify({
            provider_id: providerId,
            flow,
          }),
        });

        const json = await (async () => {
          try {
            return await resp.json();
          } catch {
            return null;
          }
        })();

        if (!resp.ok) {
          const message =
            (json && (json.message || json.error)) ? String(json.message || json.error) : `Request failed (${resp.status})`;
          throw new Error(message);
        }

        const data = (json && (json.data ?? json)) ?? {};
        const sessionId =
          typeof data.session_id === "string"
            ? data.session_id
            : typeof data.sessionId === "string"
              ? data.sessionId
              : "";
        const expiresIn =
          typeof data.expires_in === "number"
            ? data.expires_in
            : typeof data.expiresIn === "number"
              ? data.expiresIn
              : 0;
        const widgetPath =
          typeof data.widget_path === "string"
            ? data.widget_path
            : typeof data.widgetPath === "string"
              ? data.widgetPath
              : null;
        // Prefer widget_path constructed from the known tenant auth base URL.
        // Absolute widget_url can be wrong when proxies omit x-forwarded-proto (http→https redirect),
        // which breaks `postMessage` origin matching for the iframe.
        const widgetUrl = widgetPath
          ? `${String(authBaseUrl).replace(/\/$/, "")}${widgetPath}`
          : typeof data.widget_url === "string"
            ? data.widget_url
            : typeof data.widgetUrl === "string"
              ? data.widgetUrl
              : "";

        if (!sessionId || !widgetUrl) {
          throw new Error("Widget session response invalid");
        }

        return {
          sessionId,
          expiresIn: Number(expiresIn || 0),
          widgetPath,
          widgetUrl,
        };
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getAccessToken, state.status, tenant],
  );

  return { create, isLoading, error };
};

/**
 * Faucet metadata returned by `useFaucets`.
 *
 * @remarks
 * - Includes the faucet contract and network identifier.
 *
 * @property id - Faucet identifier (best-effort).
 * @property name - Faucet display name.
 * @property logoUrl - Faucet logo URL (nullable).
 * @property faucetContract - Faucet contract identifier.
 * @property networkId - Network identifier (numeric, nullable).
 *
 * @example
 * { "id": "faucet", "faucetContract": "0x...", "networkId": 43113 }
 *
 * @returns DTO type only; no runtime behavior.
 * @errors None.
 * @sideEffects None.
 * @invariants `faucetContract` is a 0x-prefixed identifier.
 */
interface FaucetItem {
  id: string;
  name: string;
  logoUrl?: string;
  faucetContract: string;
  networkId?: number | null;
}

/**
 * Return tenant faucet providers (faucets only by default).
 *
 * @remarks
 * Purpose:
 * - Surface faucet metadata derived from transfer provider configuration.
 *
 * When to use:
 * - Use when presenting faucet links or faucet selection UI.
 *
 * When not to use:
 * - Do not use for general transfer provider lists; use transferProviders from useTenantConfig.
 *
 * - Filters transfer providers to those configured as faucets.
 *
 * Parameters:
 * - `faucetsOnly`: When true, only returns providers marked as faucets. Nullable: yes.
 *
 * Return semantics:
 * - Returns `{ faucets }` with faucet metadata list.
 *
 * Errors/failure modes:
 * - None (best-effort mapping).
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `faucets` is always an array.
 *
 * Data/auth references:
 * - Derived from tenant transfer provider configuration.
 *
 * @example
 * const { faucets } = useFaucets();
 */
export const useFaucets = (faucetsOnly = true) => {
  const { transferProviders, networks } = useTenantConfig();
  const faucets = useMemo<FaucetItem[]>(() => {
    const providers = (transferProviders || []) as TransferProvider[];
    const mapped: FaucetItem[] = [];
    for (const p of providers) {
      const isFaucet = p.integrationMethod === "faucet" || p.metadata?.faucetContract;
      if (faucetsOnly && !isFaucet) continue;
      const faucetContract = p.metadata?.faucetContract;
      if (!faucetContract) continue;
      const fallbackNetworkId =
        networks.find((n) => (n as any)?.networkId)?.networkId ?? null;
      const rawNetworkId =
        p.networkId ??
        p.supportedNetworks?.[0]?.networkId ??
        (fallbackNetworkId !== null ? Number(fallbackNetworkId) : null);
      const networkId =
        rawNetworkId !== null && Number.isFinite(Number(rawNetworkId))
          ? Number(rawNetworkId)
          : null;
      mapped.push({
        id: p.id ?? p.name ?? "faucet",
        name: p.name ?? "Faucet",
        logoUrl: p.logoUrl ?? undefined,
        faucetContract,
        networkId
      });
    }
    return mapped;
  }, [transferProviders, networks, faucetsOnly]);

  return { faucets };
};
