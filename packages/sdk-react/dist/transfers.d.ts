import { type TransferTransaction, type CreateTransferTransactionInput, type ExecuteFaucetTransferInput, type UpdateTransferTransactionInput, type TransferTransactionsQuery } from "@xkova/sdk-core";
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
export declare const useTransferTransactions: (filter?: TransferTransactionsQuery & {
    autoRefreshMs?: number;
}) => {
    transactions: TransferTransaction[];
    total: number;
    count: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
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
export declare const useCreateTransferTransaction: () => {
    create: (input: CreateTransferTransactionInput, options?: {
        receipt?: string | null;
    }) => Promise<TransferTransaction>;
    isLoading: boolean;
    error: Error | null;
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
export declare const useExecuteFaucetTransfer: () => {
    execute: (input: ExecuteFaucetTransferInput, options?: {
        receipt?: string | null;
    }) => Promise<TransferTransaction>;
    isLoading: boolean;
    error: Error | null;
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
export declare const useUpdateTransferTransaction: () => {
    update: (transactionId: string, input: UpdateTransferTransactionInput, options?: {
        receipt?: string | null;
    }) => Promise<TransferTransaction>;
    isLoading: boolean;
    error: Error | null;
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
export declare const useCreateTransferWidgetSession: () => {
    create: (input: CreateTransferProviderWidgetSessionInput) => Promise<TransferProviderWidgetSession>;
    isLoading: boolean;
    error: Error | null;
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
export declare const useFaucets: (faucetsOnly?: boolean) => {
    faucets: FaucetItem[];
};
export {};
