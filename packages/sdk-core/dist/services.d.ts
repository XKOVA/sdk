import { APIClient } from './api-client.js';
import { IeeOrchestrator, type IeeReceiptApproval } from './iee-orchestration.js';
import { AccountState, AgentInstallationDetails, AgentInstallationFailureCountResponse, AgentInstallationFailureCountsResponse, AgentInstallationFailuresResponse, BootstrapPayload, BulkContactsOperationInput, BulkContactsOperationResult, ConfirmInstallationRequest, ConfirmInstallationResponse, Contact, ContactsListQuery, ContactsListResponse, CreateContactInput, DeleteContactResult, MarketplaceAgent, PrepareInstallationRequest, PrepareInstallationResponse, RevokeOtherSessionsResult, RevokeUserSessionResult, UserSessionListResult, TenantConfig, TokenAsset, UninstallAgentResult, TransactionDirection, TransactionEventType, TransactionExecutionMethod, TransactionHistoryItem, TransactionHistoryResponse, TransactionStatus, SendPayment, SendPaymentsListResult, SendPaymentsQuery, PaymentActionResult, PaymentRequest, PaymentRequestActionResult, PaymentRequestsListResponse, PaymentRequestsQuery, TransactionVerificationResult, UpdateProfileInput, AvatarUploadTicket, UserInfo, TransactionCategory, TransferTransactionsListResult, TransferTransactionsQuery, TransferTransaction, CreateTransferTransactionInput, ExecuteFaucetTransferInput, UpdateTransferTransactionInput, UpdateContactInput, UpdateInstallationConfigOptions } from './types.js';
import type { SubmitSendPaymentInput } from './payments/send-payment.js';
interface BaseOptions {
    client: APIClient;
    iee?: IeeOrchestrator;
}
declare class BaseService {
    protected client: APIClient;
    protected iee: IeeOrchestrator;
    constructor(options: BaseOptions);
    protected ensureIeeReceipt(params: {
        actionType: string;
        payload: Record<string, unknown>;
        receipt?: string | null;
    }): Promise<IeeReceiptApproval>;
}
/**
 * Account service for OAuth `/account` endpoints.
 *
 * @remarks
 * Purpose:
 * - Provide low-level access to account state.
 *
 * When to use:
 * - Use in headless or custom integrations that call `/account` directly.
 *
 * When not to use:
 * - Prefer sdk-react hooks (useAccountState/useAccountActions) in React apps.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests when methods are called.
 *
 * Invariants/assumptions:
 * - APIClient baseUrl must point to the OAuth protocol host.
 *
 * Data/auth references:
 * - /account endpoint.
 *
 * @advanced
 */
export declare class AccountService extends BaseService {
    /**
     * Fetches account state for the authenticated user.
     *
     * @param _none - No parameters; uses bearer token from API client.
     * @returns Canonical account state.
     * @errors Network/authorization errors from the API client.
     * @sideEffects None.
     * @invariants `account` is always present in the response.
     */
    getAccountState(): Promise<AccountState>;
}
/**
 * Tenant bootstrap service for `/oauth/user` and `/oauth/tenant`.
 *
 * @remarks
 * Purpose:
 * - Fetch user and tenant bootstrap payloads without instantiating OAuthService.
 *
 * When to use:
 * - Use when you already have an APIClient bound to oauth-server.
 *
 * When not to use:
 * - Prefer OAuthService.fetchBootstrap for storage-aware OAuth sessions.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests to fetch bootstrap data.
 *
 * Invariants/assumptions:
 * - APIClient baseUrl must point to the OAuth protocol host.
 *
 * Data/auth references:
 * - /oauth/user and /oauth/tenant endpoints.
 *
 * @advanced
 */
export declare class TenantConfigService extends BaseService {
    /**
     * Retrieves bootstrap data (user, tenant, networks, tokens).
     * @scope openid profile email account:read
     */
    getBootstrap(): Promise<BootstrapPayload>;
    /** Convenience accessor for tenant configuration only. */
    getTenant(): Promise<TenantConfig>;
    /** Returns network-aware token metadata from bootstrap. */
    getTokens(): Promise<TokenAsset[]>;
}
/**
 * User profile service for `/oauth/user`.
 *
 * @remarks
 * Purpose:
 * - Read and update the authenticated user's profile fields.
 *
 * When to use:
 * - Use in headless integrations that need profile data outside React hooks.
 *
 * When not to use:
 * - Prefer sdk-react hooks (useUserProfile) in React apps.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests for profile reads/updates.
 *
 * Invariants/assumptions:
 * - APIClient baseUrl must point to the OAuth protocol host.
 *
 * Data/auth references:
 * - /oauth/user endpoint.
 *
 * @advanced
 */
export declare class UserProfileService extends BaseService {
    /**
     * Reads the authenticated user's profile.
     * @scope account:read
     */
    getProfile(): Promise<UserInfo>;
    /**
     * Updates the authenticated user's profile.
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `profile_update_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Profile updates.
     * @param options - Receipt override (optional).
     * @scope account:manage
     */
    updateProfile(input: UpdateProfileInput, options?: {
        receipt?: string | null;
    }): Promise<UserInfo>;
    /**
     * Creates a signed avatar upload ticket.
     *
     * @remarks
     * - Returns a signed upload URL plus storage path.
     * - Requires an IEE (SafeApprove) receipt header for third-party writes.
     *
     * @scope account:manage
     */
    createAvatarUpload(options?: {
        receipt?: string | null;
    }): Promise<AvatarUploadTicket>;
    /**
     * Uploads an avatar file and updates the profile.
     *
     * @remarks
     * - Performs a signed upload, then calls `PUT /oauth/user` with `avatar_path`.
     * - Requires IEE (SafeApprove) approval for `profile_update_v1`.
     * - When third-party writes are enabled, upload ticket creation also requires IEE approval.
     *
     * @param file - Avatar file contents.
     * @param options - Upload options (optional).
     * @scope account:manage
     */
    uploadAvatar(file: Blob | ArrayBuffer | Uint8Array | FormData, options?: {
        contentType?: string;
        fetch?: typeof fetch;
        receipt?: string | null;
        avatarPath?: string;
    }): Promise<UserInfo>;
    private uploadToSignedUrl;
}
export interface CreateIeePrepTicketInput {
    actionType: string;
    payload: Record<string, unknown>;
    expiresInSeconds?: number;
}
export interface IeePrepTicket {
    ticketId: string;
    expiresAt: string;
}
/**
 * IEE (SafeApprove) ticket service for issuing prep tickets (oauth-server).
 *
 * @remarks
 * Purpose:
 * - Mint short-lived, single-use IEE (SafeApprove) prep tickets bound to an action_type + payload.
 *
 * When to use:
 * - Use prior to launching the oauth-server IEE (SafeApprove) iframe modal.
 *
 * When not to use:
 * - Do not use for commit endpoints; this only issues tickets.
 *
 * Return semantics:
 * - Returns ticket id + expiry timestamp.
 *
 * Errors/failure modes:
 * - Propagates HTTP/validation errors from oauth-server.
 *
 * Side effects:
 * - Persists a prep ticket in oauth-server (Supabase) for later redemption by the IEE (SafeApprove).
 *
 * Invariants/assumptions:
 * - Caller is authenticated (user access token) and has required scopes for the action_type.
 */
export declare class IeeService extends BaseService {
    /**
     * Issue a short-lived IEE (SafeApprove) prep ticket.
     */
    createPrepTicket(input: CreateIeePrepTicketInput): Promise<IeePrepTicket>;
}
/**
 * Session management helpers around oauth-server `/tenant/sessions`.
 *
 * @remarks
 * Purpose:
 * - List and revoke user sessions with bearer-authenticated calls.
 *
 * When to use:
 * - Use in BFF/app-session patterns where you have access to bearer tokens.
 *
 * When not to use:
 * - Prefer OAuthService.logout or SDK provider flows for standard sign-out.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Revokes sessions server-side when requested.
 *
 * Invariants/assumptions:
 * - The server forbids revoking the current session.
 * - Scopes required: `account:read` (list) and `account:manage` (revoke).
 *
 * Data/auth references:
 * - /tenant/sessions and /tenant/sessions/others endpoints.
 *
 * @advanced
 */
export declare class SessionManagementService extends BaseService {
    /**
     * List all active sessions for the current user.
     *
     * @param options - Optional pagination options.
     * @param options.limit - Page size (1-200). When omitted, the server default is used.
     * @param options.offset - Pagination offset (>= 0). When omitted, the server default is used.
     * @returns Normalized session list payload.
     * @errors Network/authorization errors from the OAuth server.
     * @sideEffects Performs a network request to oauth-server.
     * @invariants `sessions` is always an array.
     */
    listSessions(options?: {
        limit?: number;
        offset?: number;
    }): Promise<UserSessionListResult>;
    /**
     * Revoke a specific session for the current user.
     *
     * @remarks
     * - The server forbids revoking the current session.
     * - Requires an IEE (SafeApprove) receipt header for `session_revoke_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param sessionId - Session UUID to revoke.
     * @returns Revocation result payload.
     * @errors Throws when `sessionId` is empty, IEE (SafeApprove) validation fails, or OAuth rejects the request.
     * @sideEffects Revokes the session server-side.
     * @invariants Does not revoke the current session (server-enforced).
     */
    revokeSession(sessionId: string, options?: {
        receipt?: string | null;
    }): Promise<RevokeUserSessionResult>;
    /**
     * Revoke all sessions except the current one ("sign out of other devices").
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `session_revoke_others_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @returns Revocation result payload.
     * @errors OAuth errors when the token is missing required scopes or IEE (SafeApprove) validation fails.
     * @sideEffects Revokes sessions server-side.
     * @invariants The current session is preserved.
     */
    revokeOtherSessions(options?: {
        receipt?: string | null;
    }): Promise<RevokeOtherSessionsResult>;
}
/**
 * Contacts service for `/api/v1/contacts` endpoints (apps/api).
 *
 * @remarks
 * Purpose:
 * - CRUD operations for the authenticated user's personal contacts.
 *
 * When to use:
 * - Use in headless or custom SDK integrations that call contacts endpoints directly.
 *
 * When not to use:
 * - Prefer sdk-react hooks (useContacts/useCreateContact/etc.) in React apps.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for contact CRUD operations.
 *
 * Invariants/assumptions:
 * - Uses offset pagination (`limit`/`offset`) for list/search endpoints.
 * - Read operations require `contacts:read`; mutations require `contacts:manage`.
 *
 * Data/auth references:
 * - apps/api: `/api/v1/contacts`.
 *
 * @see /api/v1/contacts
 *
 * @advanced
 */
export declare class ContactsService extends BaseService {
    /**
     * Lists the authenticated user's contacts.
     *
     * @remarks
     * - Backed by `GET /api/v1/contacts`.
     * - Supports search via `query` (matches name/email).
     *
     * @param query - Optional search and pagination parameters.
     * @returns Contacts list response.
     * @errors Network/authorization errors from the API client.
     * @sideEffects Performs a network request to apps/api.
     * @invariants `contacts` is always an array.
     */
    listContacts(query?: ContactsListQuery): Promise<ContactsListResponse>;
    /**
     * Searches contacts using the primary contacts list route.
     *
     * @remarks
     * - Backed by `GET /api/v1/contacts`.
     * - `GET /api/v1/contacts/search` has been removed; this is now an alias for `listContacts`.
     *
     * @param query - Optional search and pagination parameters.
     * @returns Contacts list response.
     * @errors Network/authorization errors from the API client.
     * @sideEffects Performs a network request to apps/api.
     * @invariants `contacts` is always an array.
     */
    searchContacts(query?: ContactsListQuery): Promise<ContactsListResponse>;
    /**
     * Retrieves a single contact by id.
     *
     * @remarks
     * - Backed by `GET /api/v1/contacts/:contactId`.
     *
     * @param contactId - Contact UUID (v4).
     * @returns Contact record.
     * @errors Throws when `contactId` is empty or when the API rejects the request.
     * @sideEffects Performs a network request to apps/api.
     * @invariants The returned contact is scoped to the authenticated user (server-enforced).
     */
    getContactById(contactId: string): Promise<Contact>;
    /**
     * Creates a new contact.
     *
     * @remarks
     * - Backed by `POST /api/v1/contacts`.
     * - Server rejects duplicate emails (case-insensitive) within the user's contact list.
     * - Requires an IEE (SafeApprove) receipt header for `contact_create_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Contact create payload.
     * @returns Created contact record.
     * @errors Throws when `email`/`name` is empty, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects Persists a new contact record.
     * @invariants The created record is owned by the authenticated user (server-enforced).
     */
    createContact(input: CreateContactInput, options?: {
        receipt?: string | null;
    }): Promise<Contact>;
    /**
     * Updates an existing contact.
     *
     * @remarks
     * - Backed by `PATCH /api/v1/contacts/:contactId`.
     * - Requires an IEE (SafeApprove) receipt header for `contact_update_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param contactId - Contact UUID (v4).
     * @param input - Contact update payload.
     * @returns Updated contact record.
     * @errors Throws when `contactId` is empty, when no fields are provided, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects Updates a persisted contact record.
     * @invariants The updated record is owned by the authenticated user (server-enforced).
     */
    updateContact(contactId: string, input: UpdateContactInput, options?: {
        receipt?: string | null;
    }): Promise<Contact>;
    /**
     * Deletes a contact.
     *
     * @remarks
     * - Backed by `DELETE /api/v1/contacts/:contactId`.
     * - Requires an IEE (SafeApprove) receipt header for `contact_delete_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param contactId - Contact UUID (v4).
     * @returns Delete result envelope.
     * @errors Throws when `contactId` is empty, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects Deletes a persisted contact record.
     * @invariants The deleted record is owned by the authenticated user (server-enforced).
     */
    deleteContact(contactId: string, options?: {
        receipt?: string | null;
    }): Promise<DeleteContactResult>;
    /**
     * Performs a bulk operation on contacts.
     *
     * @remarks
     * - Backed by `POST /api/v1/contacts/bulk`.
     * - Bulk delete is supported; favorite operations are accepted but are currently no-ops in apps/api schema.
     * - Requires an IEE (SafeApprove) receipt header for `contact_bulk_operation_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Bulk operation payload.
     * @returns Bulk operation result.
     * @errors Throws when inputs are invalid, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects May delete contacts server-side when `operation=delete`.
     * @invariants The operation is scoped to the authenticated user's contacts (server-enforced).
     */
    bulkContacts(input: BulkContactsOperationInput, options?: {
        receipt?: string | null;
    }): Promise<BulkContactsOperationResult>;
}
/**
 * Transfers service for `/transfers/*` endpoints (apps/api).
 *
 * @remarks
 * Purpose:
 * - Manage deposit/withdraw provider transactions ("transfer activity").
 *
 * When to use:
 * - Use when integrating transfer providers and listing transfer activity.
 *
 * When not to use:
 * - Use TransactionHistoryService for on-chain transaction history.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for transfer transactions.
 *
 * Invariants/assumptions:
 * - Requires `transfers` scope for list/create/update operations.
 *
 * Data/auth references:
 * - /api/v1/transfers/transactions endpoints.
 *
 * @see /api/v1/transfers/transactions
 *
 * @advanced
 */
export declare class TransfersService extends BaseService {
    /**
     * Lists deposit/withdraw transfer transactions for the authenticated user.
     *
     * @remarks
     * - Uses offset pagination (`limit`/`offset`).
     * - Requires `transfers` scope.
     *
     * @param query - Optional filters and pagination options.
     * @returns Transfer transactions list response.
     * @errors Network/authorization errors from the API client.
     * @sideEffects Performs a network request to apps/api.
     * @invariants `transactions` is always an array.
     */
    listTransferTransactions(query?: TransferTransactionsQuery): Promise<TransferTransactionsListResult>;
    /**
     * Creates a transfer transaction record (deposit/withdraw provider activity).
     *
     * @remarks
     * - Backed by `POST /api/v1/transfers/transactions`.
     * - Requires `transfers` scope.
     * - Requires an IEE (SafeApprove) receipt header for `transfer_transaction_create_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Transfer transaction create payload.
     * @returns Created transfer transaction.
     * @errors Network/authorization errors from the API client or when IEE (SafeApprove) validation fails.
     * @sideEffects Persists a new transfer transaction record.
     * @invariants `type` is always `deposit` or `withdraw`.
     */
    createTransferTransaction(input: CreateTransferTransactionInput, options?: {
        receipt?: string | null;
    }): Promise<TransferTransaction>;
    /**
     * Executes a faucet transfer transaction (single-approval).
     *
     * @remarks
     * - Backed by `POST /api/v1/transfers/transactions/faucet`.
     * - Requires `transfers` scope.
     * - Requires an IEE (SafeApprove) receipt header for `transfer_faucet_execute_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Faucet transfer payload (includes transaction hash).
     * @param options - Receipt header for the faucet execution action.
     * @returns Created transfer transaction.
     * @errors Network/authorization errors from the API client or when IEE (SafeApprove) validation fails.
     * @sideEffects Persists a new transfer transaction record and marks it completed.
     * @invariants `transactionHash` must be a valid transaction hash.
     */
    executeFaucetTransfer(input: ExecuteFaucetTransferInput, options?: {
        receipt?: string | null;
    }): Promise<TransferTransaction>;
    /**
     * Updates an existing transfer transaction record with status/hash.
     *
     * @remarks
     * - Backed by `PATCH /api/v1/transfers/transactions/:transactionId`.
     * - Requires `transfers` scope.
     * - Requires an IEE (SafeApprove) receipt header for `transfer_transaction_update_v1`.
     * - Faucet transfers must use `executeFaucetTransfer`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param transactionId - Transfer transaction UUID.
     * @param input - Status/hash update payload.
     * @param options - Receipt header for the update action.
     * @returns Updated transfer transaction.
     * @errors Throws when `transactionId` is empty, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects Updates the persisted transfer transaction record.
     * @invariants `transactionId` must be a UUID.
     */
    updateTransferTransaction(transactionId: string, input: UpdateTransferTransactionInput, options?: {
        receipt?: string | null;
    }): Promise<TransferTransaction>;
}
/**
 * Send payments service for `/api/v1/payments/send`.
 *
 * @remarks
 * Purpose:
 * - Retrieve and manage send payments for the authenticated user.
 *
 * When to use:
 * - Use in headless integrations to list and manage send payments.
 *
 * When not to use:
 * - Do not use for payment requests; use PaymentRequestsService instead.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for send payment history and actions.
 *
 * Invariants/assumptions:
 * - Requires `payments:read` scope for history endpoints.
 *
 * Data/auth references:
 * - /api/v1/payments/send endpoint.
 *
 * @advanced
 */
export declare class SendPaymentsService extends BaseService {
    /**
     * Returns send payment history (including pending/escrowed).
     * @scope payments:read
     */
    listSendPaymentHistory(query?: SendPaymentsQuery): Promise<SendPaymentsListResult>;
    /**
     * Submit a send payment.
     * @scope payments:execute
     * @iee send_payment_submit
     */
    submitSendPayment(input: SubmitSendPaymentInput, options?: {
        receipt?: string;
    }): Promise<SendPayment>;
    /**
     * Cancel a send payment.
     * @scope payments:execute
     * @iee send_payment_cancel
     */
    cancelSendPayment(paymentId: string, options?: {
        receipt?: string;
    }): Promise<PaymentActionResult>;
    /**
     * Remind recipient of a send payment.
     * @scope payments:execute
     * @iee send_payment_remind
     */
    remindSendPayment(paymentId: string, options?: {
        receipt?: string;
    }): Promise<PaymentActionResult>;
    /**
     * Verify a send payment transaction hash.
     * @scope payments:execute
     * @iee send_payment_verify
     */
    verifySendPayment(paymentId: string, input: {
        transactionHash: string;
        network?: string;
    }, options?: {
        receipt?: string;
    }): Promise<TransactionVerificationResult>;
    /**
     * Cancel a pending on-chain payment.
     * @scope payments:execute
     * @iee send_payment_cancel_onchain
     */
    cancelPendingPaymentOnchain(paymentId: string, input: {
        cancelTxHash: string;
    }, options?: {
        receipt?: string;
    }): Promise<PaymentActionResult>;
}
/**
 * Payment requests service for `/api/v1/payments/requests/*`.
 *
 * @remarks
 * Purpose:
 * - Retrieve and manage payment requests for the authenticated user.
 *
 * When to use:
 * - Use in headless integrations to list and manage payment requests.
 *
 * When not to use:
 * - Do not use for send payments; use SendPaymentsService instead.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for payment request history and actions.
 *
 * Invariants/assumptions:
 * - Requires `payments:read` scope for history endpoints.
 *
 * Data/auth references:
 * - /api/v1/payments/requests/incoming and /api/v1/payments/requests/transactions endpoints.
 *
 * @advanced
 */
export declare class PaymentRequestsService extends BaseService {
    /**
     * Returns incoming payment request history (payer/recipient view).
     * @scope payments:read
     */
    listIncomingPaymentRequestHistory(query?: PaymentRequestsQuery): Promise<PaymentRequestsListResponse>;
    /**
     * Returns outgoing payment request history (requestor view).
     * @scope payments:read
     */
    listOutgoingPaymentRequestHistory(query?: PaymentRequestsQuery): Promise<PaymentRequestsListResponse>;
    /**
     * Create a payment request.
     * @scope payments:execute
     * @iee payment_request_create
     */
    createPaymentRequest(input: {
        type?: 'P2P' | 'BUSINESS';
        transactionType: string;
        amountWei: string;
        feeAmountWei?: string;
        account: string;
        payerEmail: string;
        description?: string;
        expiresAt?: string;
        networkId?: string;
    }, options?: {
        receipt?: string;
    }): Promise<PaymentRequest>;
    /**
     * Cancel a payment request.
     * @scope payments:execute
     * @iee payment_request_cancel
     */
    cancelPaymentRequest(requestId: string, options?: {
        receipt?: string;
    }): Promise<PaymentRequestActionResult>;
    /**
     * Decline a payment request.
     * @scope payments:execute
     * @iee payment_request_decline
     */
    declinePaymentRequest(requestId: string, options?: {
        receipt?: string;
    }): Promise<PaymentRequestActionResult>;
    /**
     * Remind payer of a payment request.
     * @scope payments:execute
     * @iee payment_request_remind
     */
    remindPaymentRequest(requestId: string, options?: {
        receipt?: string;
    }): Promise<PaymentRequestActionResult>;
}
/**
 * Transaction history wrapper around `/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Retrieve transaction history and agent failure telemetry for the authenticated user.
 *
 * When to use:
 * - Use for reading on-chain or ledger transaction history in apps/api.
 *
 * When not to use:
 * - Do not use for transfer-provider deposits/withdrawals; use TransfersService instead.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for transaction history and agent failure data.
 *
 * Invariants/assumptions:
 * - Requires `payments:read` scope for history and failure endpoints.
 *
 * Data/auth references:
 * - /api/v1/transactions/history and /api/v1/transactions/installations/* endpoints.
 *
 * @advanced
 */
export declare class TransactionHistoryService extends BaseService {
    /**
     * Returns paginated transaction history.
     * @scope payments:read
     */
    getHistory(params?: TransactionHistoryParams): Promise<TransactionHistoryResponse>;
    /**
     * Returns failures for a specific agent installation.
     * @scope payments:read
     */
    getInstallationFailures(params: {
        installationId: string;
        limit?: number;
        offset?: number;
    }): Promise<AgentInstallationFailuresResponse>;
    /**
     * Returns the failure count for a specific agent installation.
     *
     * @remarks
     * Response may include a breakdown of pre-submission vs on-chain failures.
     * @scope payments:read
     */
    getInstallationFailureCount(installationId: string): Promise<AgentInstallationFailureCountResponse>;
    /**
     * Returns failure counts for multiple installations (batch).
     *
     * @remarks
     * Uses `GET /transactions/installations/failures/counts` with repeated `installationIds` query params.
     * Response may include a breakdown of pre-submission vs on-chain failures.
     *
     * @scope payments:read
     */
    getInstallationFailureCounts(installationIds: string[]): Promise<AgentInstallationFailureCountsResponse>;
}
/**
 * Format a transaction history amount for display.
 *
 * @remarks
 * Purpose:
 * - Convert raw amount and decimals into a localized, human-readable string.
 *
 * When to use:
 * - Use when rendering TransactionHistoryItem amounts in UI.
 *
 * When not to use:
 * - Do not use for precise calculations or for transfer-provider activity; use raw values instead.
 *
 * Parameters:
 * - `item`: Transaction fields required for formatting (amountRaw, tokenDecimals, tokenSymbol, direction). Nullable: no.
 * - `locale`: Locale(s) for Intl.NumberFormat. Nullable: yes.
 *
 * Return semantics:
 * - Returns a formatted amount string (prefixed with "-" for outflows).
 *
 * Errors/failure modes:
 * - None; returns empty string when amount is missing.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `tokenDecimals` is numeric when provided.
 *
 * Data/auth references:
 * - Uses TransactionHistoryItem fields provided by apps/api.
 */
export declare const formatTransactionAmount: (item: Pick<TransactionHistoryItem, "amountRaw" | "tokenDecimals" | "tokenSymbol" | "direction">, locale?: string | string[]) => string;
/**
 * Query parameters for `/api/v1/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Filter and paginate transaction history results from apps/api.
 *
 * When to use:
 * - Use with TransactionHistoryService.getHistory or useTransactionHistory hooks.
 *
 * When not to use:
 * - Do not use for transfer-provider activity; use TransferTransactionsQuery instead.
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
 * - `limit` must be within API bounds when provided.
 *
 * @property account - Account identifier filter (nullable).
 * @property agentInstallationId - Agent installation UUID filter (nullable).
 * @property agentServiceId - Agent service UUID filter (nullable).
 * @property networkId - Network identifier filter (nullable).
 * @property eventType - Event type filter (nullable).
 * @property eventSubtype - Event subtype filter (nullable).
 * @property executionMethod - Execution method filter (nullable).
 * @property excludeUserOperationWrappers - Exclude user-operation wrapper rows (nullable).
 * @property status - Status filter (nullable).
 * @property direction - Direction filter (nullable).
 * @property contract - Contract identifier filter (nullable).
 * @property category - Category filter (nullable).
 * @property assetType - Asset type filter (nullable).
 * @property source - Data source filter ("all" | "api" | "indexer", nullable).
 * @property view - Response view mode ("grouped" | "events", nullable).
 * @property limit - Page size (nullable).
 * @property cursor - Cursor for pagination (events view only; ignored for grouped view).
 * @property offset - Offset for pagination (grouped view).
 *
 * @example
 * { "account": "0x1234...", "networkId": 43113, "limit": 20 }
 * Data/auth references:
 * - apps/api `/api/v1/transactions/history` endpoint.
 */
export interface TransactionHistoryParams {
    account?: string;
    agentInstallationId?: string;
    agentServiceId?: string;
    networkId?: number;
    eventType?: TransactionEventType;
    eventSubtype?: string;
    executionMethod?: TransactionExecutionMethod;
    excludeUserOperationWrappers?: boolean;
    status?: TransactionStatus;
    direction?: TransactionDirection;
    contract?: string;
    category?: TransactionCategory;
    assetType?: TransactionHistoryItem['assetType'];
    source?: "all" | "api" | "indexer";
    view?: "grouped" | "events";
    limit?: number;
    cursor?: string;
    offset?: number;
}
/**
 * Marketplace catalog service for listing available agents.
 *
 * @remarks
 * Purpose:
 * - Retrieve tenant-scoped agent catalog entries for end users.
 *
 * When to use:
 * - Use when you need to list marketplace agents for a tenant.
 *
 * When not to use:
 * - Do not use for global catalog discovery; this surface is tenant-scoped.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests to the marketplace catalog endpoints.
 *
 * Invariants/assumptions:
 * - Catalog is curated per tenant.
 *
 * Data/auth references:
 * - /marketplace/tenant/catalog endpoints.
 *
 * @advanced
 */
export declare class MarketplaceCatalogService extends BaseService {
    /**
     * Lists approved agents from the marketplace catalog.
     * @scope agents:read
     */
    listAgents(): Promise<MarketplaceAgent[]>;
    /**
     * Lists tenant-enabled agents for the current tenant context (curated set for end users).
     * @scope agents:read
     */
    listTenantAgents(): Promise<MarketplaceAgent[]>;
}
/**
 * Agent actions service for install/uninstall operations.
 *
 * @remarks
 * Purpose:
 * - Manage agent installations, budgets, and lifecycle actions for a tenant.
 *
 * When to use:
 * - Use when you need low-level access to agent installation endpoints.
 *
 * When not to use:
 * - Prefer sdk-react hooks (useAgentActions/useMyAgentInstallations) in React apps.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests that may trigger on-chain workflows.
 *
 * Invariants/assumptions:
 * - Requires `agents:read` for reads and `agents:manage` for mutations.
 *
 * Data/auth references:
 * - /agents, /agents/install/*, and related OAuth agent endpoints.
 *
 * @advanced
 */
export declare class AgentActionsService extends BaseService {
    /**
     * Lists user's agent installations.
     * @scope agents:read
     */
    listInstallations(): Promise<AgentInstallationDetails[]>;
    /**
     * Gets a specific agent installation.
     * @scope agents:read
     */
    getInstallation(agentActorId: string): Promise<AgentInstallationDetails>;
    /**
     * Prepares agent installation (returns unsigned transaction).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_install_prepare_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * - When `validateInstallInputs` is true, validates installInputs against installQuestions before sending.
     * @scope agents:manage
     */
    prepareInstallation(request: PrepareInstallationRequest): Promise<PrepareInstallationResponse>;
    /**
     * Confirms agent installation after client-side signing.
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_install_confirm_v1`.
     * - Uses an extended timeout to accommodate on-chain verification and provisioning work.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    confirmInstallation(request: ConfirmInstallationRequest): Promise<ConfirmInstallationResponse>;
    /**
     * Revokes/uninstalls an agent.
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_uninstall_initiate_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    uninstallAgent(agentActorId: string, receipt?: string | null): Promise<UninstallAgentResult>;
    /**
     * Confirms uninstall/revocation after the user signs the on-chain revoke transaction.
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_uninstall_confirm_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    confirmRevocation(installationId: string, transactionHash: string, receipt?: string | null): Promise<{
        status: 'revoked';
    }>;
    /**
     * Pauses an installation (user-initiated or admin override).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_installation_pause_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    pauseInstallation(installationId: string, reason?: string, options?: {
        receipt?: string | null;
    }): Promise<{
        status: string;
        pauseCode: string | null;
    }>;
    /**
     * Gets installation status for polling the provisioning flow.
     *
     * @remarks
     * - Calls the OAuth endpoint `GET /agents/installations/:installationId/status`.
     * - OAuth responds with snake_case keys; this method maps to camelCase for SDK consumers.
     *
     * @param installationId - Installation UUID returned by confirm-installation.
     * @returns Installation status snapshot with canonical fields.
     * @errors Throws if the OAuth request fails or the response is malformed.
     * @sideEffects Performs a network request to the OAuth server.
     * @invariants `installationId` must reference an installation owned by the caller.
     *
     * @scope agents:read
     */
    getInstallationStatus(installationId: string): Promise<{
        status: string;
        message: string;
        canRetry: boolean;
        installationId: string;
        createdAt: string;
    }>;
    /**
     * Retry provisioning webhook delivery for an installation.
     *
     * @remarks
     * - Calls `POST /agents/installations/:installationId/retry-webhook`.
     * - Intended for pending_webhook installs when provisioning delivery failed.
     * - Requires an IEE (SafeApprove) receipt header for `agent_installation_retry_webhook_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    retryProvisioningWebhook(installationId: string, receipt?: string | null): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Update install configuration inputs and optional token budget metadata for an installation.
     *
     * @remarks
     * - Calls `PATCH /agents/installations/:installationId/config`.
     * - Requires an IEE (SafeApprove) receipt header for `agent_installation_config_update_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * - When `validateInstallInputs` is true, validates installInputs against installQuestions before sending.
     * @scope agents:manage
     */
    updateInstallationConfig(installationId: string, installInputs: Record<string, string | number>, options?: UpdateInstallationConfigOptions): Promise<{
        installationId: string;
        installInputs: Record<string, string>;
        installQuestionsVersion: number | null;
        updatedAt: string;
    }>;
    /**
     * Increase budget for an agent installation (adds base-units to the policy ceiling).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_increase_offchain_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    increaseBudget(installationId: string, additionalBudget: string, receipt?: string | null): Promise<{
        updated: boolean;
        newBudget: string;
    }>;
    /**
     * Prepare an on-chain agentPass permission update for a budget increase (Option A).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_increase_prepare_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    prepareIncreaseBudget(installationId: string, additionalBudget: string, receipt?: string | null): Promise<{
        preparationToken: string;
        installationId: string;
        agentPass: string;
        account: string;
        unsignedTransaction: unknown;
        thirdwebClientId: string;
        expiresAt: string;
        newBudget: string;
    }>;
    /**
     * Confirm an on-chain agentPass permission update for a budget increase (Option A).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_increase_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * - `additionalBudget` is required when the SDK must obtain a receipt.
     * - When a receipt is provided explicitly, it must already be bound to the budget delta + transaction hash.
     * @scope agents:manage
     */
    confirmIncreaseBudget(installationId: string, preparationToken: string, transactionHash: string, receiptOrOptions?: string | {
        receipt?: string | null;
        additionalBudget?: string | null;
        tokenBudgetsByTokenPoolId?: Record<string, string> | null;
        tokenBudgetMode?: 'single' | 'all' | null;
    }): Promise<{
        updated: boolean;
        newBudget: string;
    }>;
    /**
     * Prepare an on-chain agentPass permission update for a budget decrease (reuse existing key).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_decrease_prepare_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    prepareDecreaseBudget(installationId: string, decreaseAmount: string, receipt?: string | null): Promise<{
        preparationToken: string;
        installationId: string;
        agentPass: string;
        account: string;
        unsignedTransaction: unknown;
        thirdwebClientId: string;
        expiresAt: string;
        newBudget: string;
    }>;
    /**
     * Confirm an on-chain agentPass permission update for a budget decrease (reuse existing key).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_decrease_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * - `decreaseAmount` is required when the SDK must obtain a receipt.
     * - When a receipt is provided explicitly, it must already be bound to the budget delta + transaction hash.
     * @scope agents:manage
     */
    confirmDecreaseBudget(installationId: string, preparationToken: string, transactionHash: string, receiptOrOptions?: string | {
        receipt?: string | null;
        decreaseAmount?: string | null;
        tokenBudgetsByTokenPoolId?: Record<string, string> | null;
        tokenBudgetMode?: 'single' | 'all' | null;
    }): Promise<{
        updated: boolean;
        newBudget: string;
    }>;
    /**
     * Resume a paused installation (manual resume).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_installation_resume_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    resumeInstallation(installationId: string, receipt?: string | null): Promise<{
        status: string;
    }>;
    private stableStringify;
    private resolveInstallationById;
}
/**
 * Construct grouped SDK service instances from API clients.
 *
 * @remarks
 * Purpose:
 * - Create a convenience bundle of apps/api and oauth-server service wrappers.
 *
 * When to use:
 * - Use in headless integrations where you manage APIClient instances directly.
 *
 * When not to use:
 * - Prefer OAuthService or sdk-react hooks in React-first integrations.
 *
 * Parameters:
 * - `options.api`: APIClient configured for apps/api base URL. Nullable: no.
 * - `options.auth`: APIClient configured for the OAuth protocol host. Nullable: no.
 * - `options.iee`: Optional IEE (SafeApprove) orchestrator to auto-collect receipts for write calls. Nullable: yes.
 *
 * Return semantics:
 * - Returns a grouped object with service instances for accounts, contacts, transfers, etc.
 *
 * Errors/failure modes:
 * - None during construction; service methods may throw SDKError subclasses.
 *
 * Side effects:
 * - None; no network requests are made during construction.
 *
 * Invariants/assumptions:
 * - Clients are correctly configured with base URLs and auth hooks.
 *
 * Data/auth references:
 * - apps/api and oauth-server endpoints per the included services.
 *
 * @advanced
 */
export declare const createServices: (options: {
    api: APIClient;
    auth: APIClient;
    iee?: IeeOrchestrator;
}) => {
    contacts: ContactsService;
    transfers: TransfersService;
    transactions: TransactionHistoryService;
    account: AccountService;
    tenantConfig: TenantConfigService;
    userProfile: UserProfileService;
    iee: IeeService;
    sessions: SessionManagementService;
    marketplace: MarketplaceCatalogService;
    agentActions: AgentActionsService;
};
export {};
