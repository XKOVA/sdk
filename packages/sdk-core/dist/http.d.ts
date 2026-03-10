/**
 * Retry configuration for HTTP requests.
 *
 * @remarks
 * Purpose:
 * - Configure retry behavior for transient network and status failures.
 *
 * When to use:
 * - Use when you need custom retry/backoff behavior for SDK transport.
 *
 * When not to use:
 * - Do not enable aggressive retries for non-idempotent endpoints unless you understand side effects.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None directly; applied by fetchWithPolicy.
 *
 * Invariants/assumptions:
 * - Retry counts are non-negative integers when provided.
 *
 * Data/auth references:
 * - Retry policy applies to apps/api and oauth-server requests.
 */
export type RetryOptions = {
    /**
     * Number of retries AFTER the initial attempt.
     * Default: 2
     */
    retries?: number;
    /**
     * Base backoff in ms. Default: 300
     */
    backoffMs?: number;
    /**
     * Maximum backoff in ms. Default: 3000
     */
    maxBackoffMs?: number;
    /**
     * Retryable methods. Default: GET/HEAD/OPTIONS
     */
    methods?: string[];
    /**
     * Retry when response status matches. Default: 408, 429, 5xx
     */
    retryOnStatus?: (status: number) => boolean;
    /**
     * When true, honors Retry-After for retryable status responses.
     * Default: false.
     */
    respectRetryAfter?: boolean;
};
/**
 * Request policy configuration for timeout and retry handling.
 *
 * @remarks
 * Purpose:
 * - Define total timeout budgets, per-attempt timeouts, and retry rules.
 *
 * When to use:
 * - Use when customizing transport behavior for API clients or OAuth flows.
 *
 * When not to use:
 * - Do not set timeouts to zero unless you explicitly want no timeout.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None directly; applied by fetchWithPolicy.
 *
 * Invariants/assumptions:
 * - Timeouts are in milliseconds.
 *
 * Data/auth references:
 * - Applies to HTTP requests made by the SDK.
 */
export type RequestPolicy = {
    /**
     * Total timeout budget for the whole request (including retries/backoff), in ms.
     * Default: 30000
     */
    timeoutMs?: number;
    /**
     * Per-attempt timeout in ms. Default: 10000
     * This is capped by the remaining total timeout budget.
     */
    attemptTimeoutMs?: number;
    retry?: RetryOptions;
    /**
     * If true, allows retry for non-idempotent methods (POST/PUT/PATCH/DELETE).
     * Default: false (secure/boring).
     */
    allowRetryForNonIdempotent?: boolean;
    /**
     * Optional observability hooks for attempts/retries (no logging by default).
     */
    hooks?: {
        onAttemptStart?: (ctx: {
            url: string;
            method: string;
            attempt: number;
            maxRetries: number;
        }) => void;
        onRetry?: (ctx: {
            url: string;
            method: string;
            attempt: number;
            maxRetries: number;
            waitMs: number;
            reason: {
                kind: "status";
                status: number;
            } | {
                kind: "network";
            };
        }) => void;
        onAttemptEnd?: (ctx: {
            url: string;
            method: string;
            attempt: number;
            status?: number;
            error?: unknown;
        }) => void;
    };
};
/**
 * Fetch wrapper with timeout and retry policy.
 *
 * @remarks
 * Purpose:
 * - Provide a single request helper with retries, backoff, and timeouts.
 *
 * When to use:
 * - Use in SDK internals or custom API clients that need consistent retry behavior.
 *
 * When not to use:
 * - Do not use for non-idempotent requests unless you opt in to retries explicitly.
 *
 * Parameters:
 * - `fetchFn`: Fetch implementation (browser or Node 18+). Nullable: no.
 * - `url`: Absolute or relative URL. Nullable: no.
 * - `init`: Fetch init options. Nullable: yes.
 * - `policy`: RequestPolicy configuration. Nullable: yes.
 *
 * Return semantics:
 * - Resolves with a Response (successful or error status).
 *
 * Errors/failure modes:
 * - Throws on timeout or when retryable attempts are exhausted.
 * - Throws AbortError when an AbortSignal cancels the request.
 *
 * Side effects:
 * - Performs network requests and may delay between retries.
 *
 * Invariants/assumptions:
 * - Retries are idempotent-only by default (GET/HEAD/OPTIONS).
 *
 * Data/auth references:
 * - Requests may include authorization headers provided by the caller.
 */
export declare function fetchWithPolicy(fetchFn: typeof fetch, url: string, init?: RequestInit, policy?: RequestPolicy): Promise<Response>;
/**
 * Legacy helper that wraps global fetch with retry defaults.
 *
 * @remarks
 * Purpose:
 * - Provide a lightweight compatibility wrapper around fetchWithPolicy.
 *
 * When to use:
 * - Use only in legacy integrations that expect the older signature.
 *
 * When not to use:
 * - Prefer fetchWithPolicy with a RequestPolicy for new integrations.
 *
 * Parameters:
 * - `url`: Request URL. Nullable: no.
 * - `init`: Fetch init options. Nullable: yes.
 * - `retries`: Number of retries after the initial attempt. Nullable: yes.
 * - `backoffMs`: Base backoff in milliseconds. Nullable: yes.
 *
 * Return semantics:
 * - Resolves with a Response (successful or error status).
 *
 * Errors/failure modes:
 * - Throws on timeout, abort, or when retries are exhausted.
 *
 * Side effects:
 * - Performs network requests and delays between retries.
 *
 * Invariants/assumptions:
 * - Retries are idempotent-only by default.
 *
 * Data/auth references:
 * - Requests may include authorization headers provided by the caller.
 */
