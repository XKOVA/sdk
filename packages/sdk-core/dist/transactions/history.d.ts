import { TransactionDirection, TransactionHistoryItem, TransactionHistoryResponse, type TransactionStatusCanonical, type TokenAsset, type TransferProvider } from "../types.js";
import { type TransactionHistoryParams } from "../services.js";
/**
 * Transaction history view modes.
 *
 * @remarks
 * - grouped: server-side grouping (1 row per agent transaction, including fee-split batches).
 * - events: raw rows (shows each fee-split transfer leg).
 */
export type TransactionHistoryView = "grouped" | "events";
export type TransactionHistoryDisplayItem = TransactionHistoryItem & {
    tokenDecimals: number;
    tokenSymbol: string;
    displayAmount: string;
    direction: TransactionDirection;
    tokenLogoUrl?: string | null;
    /**
     * @deprecated Use `image.url` + `image.source`.
     */
    rampProviderLogoUrl?: string | null;
    displayType?: string;
    counterpartyLabel?: string | null;
    /**
     * @deprecated Use `image.url` + `image.source`.
     */
    counterpartyAvatarUrl?: string | null;
    senderContact?: string | null;
    recipientContact?: string | null;
    rampProviderId?: string | null;
    rampProviderName?: string | null;
    /**
     * SDK-normalized feed status for lightweight UIs.
     *
     * @remarks
     * Derived from canonical status semantics:
     * - `success` => `completed`
     * - `failed` => `failed`
     * - `queued`/`pending`/`unknown` => `pending`
     */
    feedStatus: "pending" | "completed" | "failed";
};
/**
 * Derive a UI feed status from canonical transaction status.
 *
 * @remarks
 * This keeps lightweight transaction feeds aligned to server canonical semantics
 * without each app duplicating status mapping logic.
 *
 * @param statusCanonical - Canonical status emitted by apps/api.
 * @returns Feed status enum for simple UI rendering.
 */
export declare const deriveFeedStatus: (statusCanonical: TransactionStatusCanonical | null | undefined) => "pending" | "completed" | "failed";
/**
 * Build query params for transaction history requests.
 *
 * @remarks
 * Purpose:
 * - Apply the same query normalization as sdk-react hooks.
 * - Default is grouped view (1 row per agent transaction); set view=events for raw fee-split transfers.
 * - Excludes user-operation wrapper rows by default unless explicitly disabled.
 *
 * Return semantics:
 * - Returns URLSearchParams ready to append to `/transactions/history`.
 */
export declare const buildTransactionHistorySearchParams: (params?: TransactionHistoryParams & {
    view?: TransactionHistoryView;
}) => URLSearchParams;
/**
 * Normalize and enrich transaction history response items.
 *
 * @remarks
 * Purpose:
 * - Compute display amounts, token metadata fallbacks, and direction.
 * - Preserve API-owned canonical semantics (`category`, `provenance`, `counterparty`).
 * - Extract contact/provider metadata for display labels only.
 * - Prefer API-provided canonical image object and apply strict fallback mapping when absent.
 * - Filter duplicate user_operation wrapper rows when grouped.
 *
 * Return semantics:
 * - Returns a response object with mapped transaction items.
 */
export declare const normalizeTransactionHistoryResponse: (payload: TransactionHistoryResponse, options?: {
    tokens?: Array<TokenAsset | string>;
    view?: TransactionHistoryView;
    transferProviders?: TransferProvider[];
}) => TransactionHistoryResponse & {
    transactions: TransactionHistoryDisplayItem[];
};
