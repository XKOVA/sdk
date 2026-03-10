import { TokenSet } from './types.js';
import { type RequestPolicy, type RetryOptions } from './http.js';
import { type SDKTelemetry } from './telemetry.js';
/**
 * Low-level configuration for {@link APIClient}.
 *
 * @remarks
 * Purpose:
 * - Provide transport, auth, retry, and telemetry options for raw API requests.
 *
 * When to use:
 * - Use when you need direct control over HTTP behavior or custom endpoint calls.
 *
 * When not to use:
 * - Prefer higher-level SDK services (for example, AccountService, ContactsService) for standard flows.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Configuration shape only; no runtime behavior.
 *
 * Runtime constraints:
 * - Requires a compatible `fetch` implementation (browser or Node 18+). Provide `fetch` explicitly in older Node.
 *
 * Security notes:
 * - `getAccessToken` and `onUnauthorized` must avoid leaking tokens into logs or URLs.
 *
 * Errors/failure modes:
 * - Exceptions thrown by `getAccessToken`/`onUnauthorized` will reject the request.
 *
 * Side effects:
 * - None directly; behavior depends on hooks provided by the caller.
 *
 * Invariants/assumptions:
 * - `baseUrl` is an absolute URL without a trailing slash (the client normalizes trailing slashes).
 * - Timeout values are positive integers when provided.
 *
 * Data/auth references:
 * - `getAccessToken` supplies the bearer token; `onUnauthorized` handles refresh on 401.
 *
 * @advanced
 */
export interface APIClientOptions {
    baseUrl: string;
    fetch?: typeof fetch;
    /**
     * Total timeout budget for the whole request (including retries/backoff), in ms.
     * Default: 30000.
     */
    timeoutMs?: number;
    /**
     * Per-attempt timeout in ms. Default: 10000.
     */
    attemptTimeoutMs?: number;
    /**
     * Retry policy (idempotent-only by default). Default: { retries: 2, backoffMs: 300 }.
     */
    retry?: RetryOptions;
    /**
     * Optional observability hooks. No logging is performed by default.
     */
    telemetry?: SDKTelemetry;
    /**
     * Called to obtain the latest access token. If it returns null the request is sent unauthenticated.
     */
    getAccessToken?: () => Promise<string | null>;
    /**
     * Optional refresh hook. If a request returns 401, this callback is invoked once before retrying.
     */
    onUnauthorized?: () => Promise<TokenSet | null>;
}
/**
 * Low-level HTTP client with bearer auth, retry policy, and typed SDK errors.
 *
 * @remarks
 * Purpose:
 * - Centralize transport behavior for SDK services and advanced integrations.
 *
 * When to use:
 * - Use for custom endpoint calls not covered by the higher-level SDK service classes.
 *
 * When not to use:
 * - Prefer SDK services created by `createServices` or purpose-built helpers where available.
 * - Do not rely on APIClient for IEE (SafeApprove) enforcement; it never injects `X-XKOVA-IEE-Receipt`.
 *
 * Parameters:
 * - `options`: APIClientOptions for transport, auth, and telemetry. Nullable: no.
 *
 * Return semantics:
 * - Constructs a client instance; methods perform network requests.
 *
 * Runtime constraints:
 * - Requires a compatible `fetch` implementation (browser or Node 18+).
 *
 * Security notes:
 * - Sends access tokens via `Authorization: Bearer ...`. Do not log headers or URLs containing secrets.
 * - Cookies are explicitly omitted (`credentials: "omit"`).
 * - APIClient never adds `X-XKOVA-IEE-Receipt`; supply it manually for third-party write calls.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses (NetworkError, TimeoutError, OAuthError, etc.).
 *
 * Side effects:
 * - Performs network requests and may invoke telemetry hooks and `onUnauthorized`.
 *
 * Invariants/assumptions:
 * - `baseUrl` is a stable origin for your tenant.
 * - `path` is appended verbatim to `baseUrl`.
 *
 * Data/auth references:
 * - Uses `getAccessToken` and `onUnauthorized` from {@link APIClientOptions}.
 *
 * @example
 * const client = new APIClient({ baseUrl, getAccessToken });
 * const profile = await client.get<UserInfo>("/api/v1/profile");
 *
 * @advanced
 */
export declare class APIClient {
    private fetchImpl;
    private baseUrl;
    private getAccessToken?;
    private onUnauthorized?;
    private requestPolicy;
    private telemetry?;
    constructor(options: APIClientOptions);
    /**
     * Perform a GET request against `baseUrl + path`.
     *
     * @remarks
     * Purpose:
     * - Retrieve data from a custom endpoint using the configured transport stack.
     *
     * When to use:
     * - Use for read-only calls not already modeled by SDK services.
     *
     * When not to use:
     * - Prefer typed service methods when available.
     *
     * Parameters:
     * - `path`: Absolute path appended to `baseUrl` (should begin with `/`). Nullable: no.
     * - `options`: Optional signal/headers override. Nullable: yes.
     *
     * Return semantics:
     * - Resolves with parsed JSON (unwraps `{ data }` envelopes when present).
     *
     * Errors/failure modes:
     * - Throws SDKError subclasses for transport, auth, validation, rate limit, or server failures.
     *
     * Side effects:
     * - Performs a network request and emits telemetry hooks when configured.
     *
     * Invariants/assumptions:
     * - `path` is a valid URI path and is concatenated verbatim to `baseUrl`.
     *
     * Data/auth references:
     * - Includes bearer token from `getAccessToken` when available.
     *
     * @example
     * const profile = await client.get<UserInfo>("/api/v1/profile");
     */
    get<T>(path: string, signal?: AbortSignal): Promise<T>;
    /**
     * Perform a POST request against `baseUrl + path`.
     *
     * @remarks
     * Purpose:
     * - Create resources or trigger actions on custom endpoints.
     *
     * When to use:
     * - Use for write operations not covered by SDK services.
     *
     * When not to use:
     * - Prefer typed service methods where available.
     *
     * Parameters:
     * - `path`: Absolute path appended to `baseUrl` (should begin with `/`). Nullable: no.
     * - `body`: JSON-serializable payload. Nullable: yes.
     * - `options`: Optional signal/headers/request policy overrides. Nullable: yes.
     *
     * Return semantics:
     * - Resolves with parsed JSON (unwraps `{ data }` envelopes when present).
     *
     * Errors/failure modes:
     * - Throws SDKError subclasses for transport, auth, validation, rate limit, or server failures.
     *
     * Side effects:
     * - Performs a network request and emits telemetry hooks when configured.
     *
     * Invariants/assumptions:
     * - `body` must be JSON-serializable when provided.
     *
     * Data/auth references:
     * - Includes bearer token from `getAccessToken` when available.
     *
     * @example
     * const result = await client.post("/api/v1/contacts", { email, name });
     */
    post<TBody, TResponse>(path: string, body?: TBody, options?: AbortSignal | {
        signal?: AbortSignal;
        headers?: Record<string, string>;
        requestPolicy?: RequestPolicy;
    }): Promise<TResponse>;
    /**
     * Perform a PUT request against `baseUrl + path`.
     *
     * @remarks
     * Purpose:
     * - Replace or fully update a resource on custom endpoints.
     *
     * When to use:
     * - Use for full updates not covered by SDK services.
     *
     * When not to use:
     * - Prefer typed service methods where available.
     *
     * Parameters:
     * - `path`: Absolute path appended to `baseUrl` (should begin with `/`). Nullable: no.
     * - `body`: JSON-serializable payload. Nullable: yes.
     * - `options`: Optional signal/headers overrides. Nullable: yes.
     *
     * Return semantics:
     * - Resolves with parsed JSON (unwraps `{ data }` envelopes when present).
     *
     * Errors/failure modes:
     * - Throws SDKError subclasses for transport, auth, validation, rate limit, or server failures.
     *
     * Side effects:
     * - Performs a network request and emits telemetry hooks when configured.
     *
     * Invariants/assumptions:
     * - `body` must be JSON-serializable when provided.
     *
     * Data/auth references:
     * - Includes bearer token from `getAccessToken` when available.
     *
     * @example
     * const updated = await client.put("/api/v1/profile", payload);
     */
    put<TBody, TResponse>(path: string, body?: TBody, options?: AbortSignal | {
        signal?: AbortSignal;
        headers?: Record<string, string>;
    }): Promise<TResponse>;
    /**
     * Perform a PATCH request against `baseUrl + path`.
     *
     * @remarks
     * Purpose:
     * - Partially update a resource on custom endpoints.
     *
     * When to use:
     * - Use for partial updates not covered by SDK services.
     *
     * When not to use:
     * - Prefer typed service methods where available.
     *
     * Parameters:
     * - `path`: Absolute path appended to `baseUrl` (should begin with `/`). Nullable: no.
     * - `body`: JSON-serializable payload. Nullable: yes.
     * - `signal`: Optional AbortSignal for cancellation/timeouts. Nullable: yes.
     *
     * Return semantics:
     * - Resolves with parsed JSON (unwraps `{ data }` envelopes when present).
     *
     * Errors/failure modes:
     * - Throws SDKError subclasses for transport, auth, validation, rate limit, or server failures.
     *
     * Side effects:
     * - Performs a network request and emits telemetry hooks when configured.
     *
     * Invariants/assumptions:
     * - `body` must be JSON-serializable when provided.
     *
     * Data/auth references:
     * - Includes bearer token from `getAccessToken` when available.
     *
     * @example
     * const updated = await client.patch("/api/v1/contacts/123", { name: "New" });
     */
    patch<TBody, TResponse>(path: string, body?: TBody, options?: AbortSignal | {
        signal?: AbortSignal;
        headers?: Record<string, string>;
    }): Promise<TResponse>;
    /**
     * Perform a DELETE request against `baseUrl + path`.
     *
     * @remarks
     * Purpose:
     * - Delete a resource on custom endpoints.
     *
     * When to use:
     * - Use for delete operations not covered by SDK services.
     *
     * When not to use:
     * - Prefer typed service methods where available.
     *
     * Parameters:
     * - `path`: Absolute path appended to `baseUrl` (should begin with `/`). Nullable: no.
     * - `signal`: Optional AbortSignal for cancellation/timeouts. Nullable: yes.
     *
     * Return semantics:
     * - Resolves with parsed JSON (unwraps `{ data }` envelopes when present).
     *
     * Errors/failure modes:
     * - Throws SDKError subclasses for transport, auth, validation, rate limit, or server failures.
     *
     * Side effects:
     * - Performs a network request and emits telemetry hooks when configured.
     *
     * Invariants/assumptions:
     * - `path` points to a deletable resource.
     *
     * Data/auth references:
     * - Includes bearer token from `getAccessToken` when available.
     *
     * @example
     * const result = await client.delete("/api/v1/contacts/123");
     */
    delete<T>(path: string, options?: AbortSignal | {
        signal?: AbortSignal;
        headers?: Record<string, string>;
    }): Promise<T>;
    /**
     * Execute an HTTP request with auth propagation and normalized errors.
     *
     * @remarks
     * Purpose:
     * - Centralize request construction, retries, and error mapping.
     *
     * Parameters:
     * - `options`: Request options including path, method, headers, and body. Nullable: no.
     *
     * Return semantics:
     * - Returns the parsed response payload (unwraps `{ data }` envelopes when present).
     *
     * Errors/failure modes:
     * - Throws NetworkError/TimeoutError/AbortedError for transport failures.
     * - Throws UnauthorizedError for 401/403, NotFoundError for 404.
     * - Throws ValidationError for 400/422, RateLimitedError for 429.
     * - Throws ServerError for 5xx responses.
     * - Throws OAuthError when OAuth error payloads are detected; BadResponseError otherwise.
     *
     * Side effects:
     * - Emits telemetry hooks and retries according to the request policy.
     * - Logs network failures to the console in non-production environments for debugging.
     *
     * Invariants/assumptions:
     * - Requests are bearer-authenticated and do not send cookies.
     *
     * Data/auth references:
     * - Uses `getAccessToken` and `onUnauthorized` when provided.
     *
     * @example
     * const payload = await client.request({ path: "/account", method: "GET" });
     */
    private request;
}
