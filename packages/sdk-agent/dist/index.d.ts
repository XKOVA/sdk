export declare const TOKEN_REFRESH_WINDOW_MS = 30000;
export declare const XKOVA_ENV_TO_AUTH_URL: Readonly<{
    production: "https://auth.xkova.com";
    staging: "https://auth-staging.xkova.com";
    dev: "https://auth-dev.xkova.com";
    local: "https://auth-local.xkova.com";
}>;
export declare const DEFAULT_XKOVA_ENV: XkovaEnvironment;
type AnyRecord = Record<string, any>;
type UnknownRecord = Record<string, unknown>;
type TransactionLifecycleEvent = 'transaction.submitted' | 'transaction.finalized';
export type XkovaEnvironment = 'production' | 'staging' | 'dev' | 'local';
export type TokenBudgetMode = 'single' | 'all';
export interface AgentLogger {
    info(message: string, meta?: AnyRecord): void;
    warn(message: string, meta?: AnyRecord): void;
    error(message: string, meta?: AnyRecord): void;
}
export interface HttpErrorOptions {
    url?: string;
    status?: number;
    bodySnippet?: string;
}
export interface ResolveJwksUrlOptions {
    jwksUrl?: string | null;
    agentpassBaseUrl?: string | null;
    xkovaEnv?: unknown;
}
export interface NumberConstraints {
    min?: number;
    max?: number;
}
export interface NormalizedTransactionLifecyclePayload {
    event: TransactionLifecycleEvent;
    installationId: string;
    transactionId: string;
    queueId: string | null;
    status: string | null;
    transactionHash: string | null;
    userOpHash: string | null;
    blockNumber: string | null;
    gasUsed: string | null;
    minedAt: string | null;
    revertReason: string | null;
    submittedAt: string | null;
    finalizedAt: string | null;
}
export interface InstallationOperatingToken {
    token_pool_id: string;
    symbol: string | null;
    name: string | null;
    contract: string | null;
    decimals: number | null;
    is_stable: boolean | null;
    network_pool_id: string | null;
    [key: string]: unknown;
}
export interface NormalizedInstallationPayload {
    installationId: string | number;
    agentActorId?: string | number;
    tenant_id?: string | number;
    status?: string;
    pause_code?: unknown | null;
    revoke_reason?: unknown | null;
    webhook_pending?: boolean;
    network?: unknown | null;
    selected_token_pool_id?: string | null;
    available_operating_tokens?: InstallationOperatingToken[];
    token_budgets_by_token_pool_id?: Record<string, string> | null;
    token_budget_mode?: TokenBudgetMode | null;
    install_inputs?: UnknownRecord | null;
    install_questions_version?: number | null;
}
export interface ParsedTransactionWebhookPayload {
    kind: 'transaction';
    payload: NormalizedTransactionLifecyclePayload;
}
export interface ParsedInstallationWebhookPayload {
    kind: 'installation';
    payload: NormalizedInstallationPayload;
}
export type ParsedAgentWebhookPayload = ParsedTransactionWebhookPayload | ParsedInstallationWebhookPayload;
export interface InstallationTokenResolutionContext extends UnknownRecord {
    available_operating_tokens?: unknown;
    install_inputs?: UnknownRecord | null;
    selected_token_pool_id?: unknown;
}
export interface ResolvedInstallationToken extends AnyRecord {
    token_pool_id: string;
}
export interface ResolveInstallationTokenParams {
    installation?: InstallationTokenResolutionContext | null;
    preferredTokenPoolId?: string | null;
    preferredSymbol?: string | null;
    installInputKey?: string;
}
export interface BuildErc20TransferTxParams {
    network?: {
        network_id?: number | string | null;
        chain_id?: number | string | null;
        [key: string]: unknown;
    } | null;
    token?: {
        contract?: string | null;
        address?: string | null;
        decimals?: number | null;
        [key: string]: unknown;
    } | null;
    installInputs?: UnknownRecord | null;
    targetAccount: string;
    defaultAmountTokenUnits: number;
    amountInputKey?: string;
}
export interface BuiltErc20TransferTx {
    to: string;
    data: string;
    value: '0';
    network_id?: number;
}
interface ServiceAuthParams {
    agentpassBaseUrl: string;
    serviceId: string;
    serviceCredential: string;
    logger?: AgentLogger;
}
export interface ListServiceInstallationsParams extends ServiceAuthParams {
}
export interface IssueInstallationTokenParams extends ServiceAuthParams {
    installationId: string;
}
export interface IssueInstallationTokenResult {
    token: string;
    expiresIn: number;
}
export interface SignManagedTransactionParams {
    agentpassBaseUrl: string;
    agentActorId: string;
    installationJwt: string;
    transaction: UnknownRecord;
    idempotencyKey?: string;
    logger?: AgentLogger;
}
export type SignManagedTransactionResult = UnknownRecord & {
    idempotency_key: string;
};
export interface CreateJwksWebhookVerifierOptions extends ResolveJwksUrlOptions {
    issuer?: string | null;
    audience?: string | string[] | null;
    algorithms?: string[] | null;
}
export interface WebhookRequestLike {
    headers?: ({
        authorization?: string | string[];
        Authorization?: string | string[];
    } & UnknownRecord) | null;
}
export type JwksWebhookVerifier = (input?: {
    req?: WebhookRequestLike | null;
} | null) => Promise<boolean>;
/**
 * Error thrown for non-2xx HTTP responses.
 */
export declare class HttpError extends Error {
    url?: string;
    status?: number;
    bodySnippet?: string;
    constructor(message: string, { url, status, bodySnippet }?: HttpErrorOptions);
}
/**
 * Normalize an XKOVA environment key with production fallback.
 *
 * @param rawValue - Environment value to normalize.
 * @returns One of `production`, `staging`, `dev`, or `local`.
 */
export declare function resolveXkovaEnvironment(rawValue: unknown): XkovaEnvironment;
/**
 * Resolve the OAuth base URL from an XKOVA environment value.
 *
 * @param rawValue - Environment key value.
 * @returns Base URL for the selected environment.
 */
export declare function resolveAgentpassBaseUrl(rawValue: unknown): string;
/**
 * Resolve JWKS URL using explicit input or derived environment defaults.
 *
 * @param options - Resolution options.
 * @returns Absolute JWKS URL.
 */
export declare function resolveJwksUrl(options?: ResolveJwksUrlOptions): string;
/**
 * Normalize one installation payload into a canonical in-memory shape.
 *
 * Preserves canonical token metadata fields when available:
 * - `selected_token_pool_id`
 * - `available_operating_tokens`
 * - `token_budgets_by_token_pool_id`
 * - `token_budget_mode`
 *
 * @param payload - Installation payload from webhook or list endpoint.
 * @returns Normalized installation object or null when installation id is missing.
 */
export declare function normalizeInstallationPayload(payload: unknown): NormalizedInstallationPayload | null;
/**
 * Normalize transaction lifecycle webhook payloads.
 *
 * @param body - Decoded webhook payload object.
 * @returns Normalized transaction lifecycle payload or null.
 */
export declare function normalizeTransactionLifecyclePayload(body: unknown): NormalizedTransactionLifecyclePayload | null;
/**
 * Parse an incoming webhook payload into installation or transaction primitives.
 *
 * @param input - Raw request body string or parsed object payload.
 * @returns Parsed webhook payload wrapper or null when unrecognized.
 */
export declare function parseAgentWebhookPayload(input: unknown): ParsedAgentWebhookPayload | null;
/**
 * Resolve a numeric install input with bounds and fallback.
 *
 * @param inputs - install_inputs object.
 * @param key - install input key.
 * @param fallback - fallback value.
 * @param constraints - optional bounds.
 * @returns Numeric value to use.
 */
export declare function getInstallInputNumber(inputs: AnyRecord | null | undefined, key: string, fallback: number, constraints?: NumberConstraints): number;
/**
 * Resolve one operating token from an installation token set.
 *
 * @param params - Resolution inputs.
 * @returns Selected operating token object from `available_operating_tokens`.
 */
export declare function resolveInstallationToken(params: ResolveInstallationTokenParams): ResolvedInstallationToken;
/**
 * Build a minimal ERC20 transfer transaction payload for managed signing.
 *
 * @param params - Build parameters.
 * @returns Transaction payload compatible with `/agents/:agentActorId/sign`.
 */
export declare function buildErc20TransferTx(params: BuildErc20TransferTxParams): BuiltErc20TransferTx;
/**
 * Fetch installations visible to a service credential.
 *
 * @param params - Service credential request parameters.
 * @returns Normalized installation list.
 */
export declare function listServiceInstallations(params: ListServiceInstallationsParams): Promise<AnyRecord[]>;
/**
 * Issue a short-lived installation JWT for one installation.
 *
 * @param params - Service credential issuance parameters.
 * @returns Installation token response.
 */
export declare function issueInstallationToken(params: IssueInstallationTokenParams): Promise<IssueInstallationTokenResult>;
/**
 * Submit one managed-sign transaction for an installation JWT.
 *
 * @remarks
 * Transport retries are intentionally disabled for this endpoint. Managed
 * signing idempotency keys are strict, and automatic replay of the same key
 * after a failed attempt can convert transient 5xx responses into terminal
 * `IDEMPOTENCY_KEY_ALREADY_USED` errors.
 *
 * @param params - Signing request parameters.
 * @returns Normalized signing response.
 */
export declare function signManagedTransaction(params: SignManagedTransactionParams): Promise<SignManagedTransactionResult>;
/**
 * Check whether a cached token should be refreshed.
 *
 * @param expiresAt - Absolute expiry timestamp in milliseconds.
 * @param now - Current timestamp in milliseconds.
 * @param refreshWindowMs - Refresh window before expiry.
 * @returns True when a new token should be issued.
 */
export declare function shouldRefreshToken(expiresAt: number, now?: number, refreshWindowMs?: number): boolean;
/**
 * Create a JWKS-backed webhook authorization verifier.
 *
 * @param options - Verifier options (`jwksUrl`, `agentpassBaseUrl`, or `xkovaEnv`).
 * @returns Verifier callback that validates bearer JWT signatures.
 */
export declare function createJwksWebhookVerifier(options?: CreateJwksWebhookVerifierOptions): JwksWebhookVerifier;
export {};
