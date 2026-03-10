import { APIClient, type IeeReceiptProvider } from "@xkova/sdk-core";
export interface LaunchIeeParams {
    /** Full URL to the oauth-server IEE (SafeApprove) surface (GET /iee). */
    ieeUrl: string;
    /** Exact origin expected from postMessage events (e.g., https://auth.example.com). */
    expectedIeeOrigin: string;
    /** Correlation id used to bind messages to a specific pending intent. */
    receiptRequestId: string;
    /** Prep ticket id issued by oauth-server. */
    ticketId: string;
    /** Optional draft/intent id for display correlation. */
    draftId?: string;
    /** Optional timeout in milliseconds (defaults to 60s). */
    timeoutMs?: number;
    /** Abort signal to cancel launch. */
    signal?: AbortSignal;
    /**
     * Origin that should receive the receipt (defaults to window.location.origin).
     * This must match an allowlisted origin configured for the OAuth client.
     */
    returnOrigin?: string;
}
export type LaunchIeeResult = {
    status: 'approved';
    receipt: string;
    actionType?: string;
    actionHash?: string;
    jti?: string;
    receiptExpiresAt?: number;
    contextHash?: string | null;
    txIntent?: any;
    userOpHash?: string | null;
    /** Transaction hash returned by the IEE (SafeApprove) submission flow (when available). */
    transactionHash?: string | null;
    /** Optional preparation token returned by IEE (SafeApprove) signing flows. */
    preparationToken?: string | null;
    /** Optional installation id returned by agent install flows. */
    installationId?: string | null;
    /** Optional canonical payload returned by the IEE (SafeApprove) flow. */
    resolvedPayload?: Record<string, unknown> | null;
} | {
    status: 'cancelled';
} | {
    status: 'error';
    error: {
        code: string;
        message: string;
    };
};
export interface BrowserIeeReceiptProviderOptions {
    /** Full URL to the oauth-server IEE (SafeApprove) surface (GET /iee). */
    ieeUrl: string;
    /**
     * Expected origin for postMessage validation.
     * Defaults to the origin derived from `ieeUrl` when omitted.
     */
    expectedIeeOrigin?: string;
    /**
     * OAuth API client for issuing prep tickets.
     * Provide this or `authBaseUrl` + `getAccessToken`.
     */
    authApi?: APIClient;
    /**
     * OAuth base URL used to construct an APIClient when `authApi` is omitted.
     */
    authBaseUrl?: string;
    /**
     * Access token provider used with `authBaseUrl`.
     */
    getAccessToken?: () => Promise<string | null>;
    /** Optional draft/intent id for display correlation. */
    draftId?: string;
    /** Optional timeout in milliseconds (defaults to 60s). */
    timeoutMs?: number;
    /**
     * Origin that should receive the receipt (defaults to window.location.origin).
     * This must match an allowlisted origin configured for the OAuth client.
     */
    returnOrigin?: string;
}
/**
 * Launch the XKOVA IEE (SafeApprove) iframe and resolve when a receipt (or cancellation/error) is returned.
 *
 * Guards:
 * - Enforces exact origin match for postMessage events.
 * - Enforces matching receipt_request_id on inbound messages.
 * - Tracks a startup `ready` handshake and fails fast when the IEE frame never becomes visible.
 * - Falls back to reading `window.name` from the iframe when postMessage is unavailable.
 * - Uses explicit targetOrigin (no wildcard).
 * - Temporarily re-enables pointer events on the document to avoid modal overlays blocking the IEE (SafeApprove) iframe.
 */
export declare function launchIee(params: LaunchIeeParams): Promise<LaunchIeeResult>;
/**
 * Build a browser receipt provider for non-React flows.
 *
 * @remarks
 * Purpose:
 * - Create prep tickets with oauth-server, launch the IEE (SafeApprove) modal, and normalize receipt outcomes.
 *
 * When to use:
 * - Use in non-React browser apps with {@link IeeOrchestrator}.
 *
 * When not to use:
 * - Do not use in SSR/Node environments; requires DOM and window.postMessage.
 *
 * Parameters:
 * - `options`: BrowserIeeReceiptProviderOptions. Nullable: no.
 *
 * Return semantics:
 * - Returns an {@link IeeReceiptProvider}-compatible adapter.
 *
 * Errors/failure modes:
 * - Throws when auth configuration is missing or invalid.
 * - Returns `{ status: "error" }` when ticket issuance or IEE (SafeApprove) launch fails.
 *
 * Side effects:
 * - Issues an OAuth request to `/iee/tickets`.
 * - Opens the IEE (SafeApprove) iframe modal via {@link launchIee}.
 */
export declare const createBrowserIeeReceiptProvider: (options: BrowserIeeReceiptProviderOptions) => IeeReceiptProvider;
