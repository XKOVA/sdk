import { AbortedError, BadResponseError, NetworkError, NotFoundError, OAuthError, RateLimitedError, ServerError, TimeoutError, UnauthorizedError, ValidationError, } from './errors.js';
import { fetchWithPolicy } from './http.js';
import { defaultRedact, generateRequestId, headersToRecord, } from './telemetry.js';
function isApiEnvelope(value) {
    if (!value || typeof value !== 'object')
        return false;
    const v = value;
    return 'data' in v && typeof v.timestamp === 'string';
}
/**
 * Resolve an origin hint for error messages without relying on browser globals.
 *
 * @remarks
 * Purpose:
 * - Provide a stable origin string for network/CORS error hints.
 *
 * Parameters:
 * - `url`: Full request URL. Nullable: no.
 * - `baseUrl`: Client base URL. Nullable: no.
 *
 * Return semantics:
 * - Returns the parsed origin or falls back to baseUrl.
 *
 * Errors/failure modes:
 * - Swallows URL parsing errors and returns baseUrl.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `baseUrl` is a valid absolute URL.
 */
function resolveOriginHint(url, baseUrl) {
    try {
        return new URL(url).origin;
    }
    catch {
        return baseUrl;
    }
}
function normalizeInsufficientScopeMessage(message) {
    const trimmed = message.trim();
    if (!trimmed)
        return message;
    // oauth-server already emits the ideal format:
    // "Insufficient scope. Required: agents:read (all)"
    if (/^Insufficient scope\.\s*Required:/i.test(trimmed)) {
        return trimmed;
    }
    // apps/api scope guard emits:
    // - "Insufficient permissions. Missing scopes: X"
    // - "Insufficient permissions. Requires one of: A, B"
    const missing = /^Insufficient permissions\.\s*Missing scopes:\s*(.+)$/i.exec(trimmed);
    if (missing?.[1]) {
        return `Insufficient scope. Required: ${missing[1]} (all)`;
    }
    const oneOf = /^Insufficient permissions\.\s*Requires one of:\s*(.+)$/i.exec(trimmed);
    if (oneOf?.[1]) {
        return `Insufficient scope. Required: ${oneOf[1]} (any)`;
    }
    // Some endpoints use this shorter wording.
    const requires = /^Insufficient scope\.\s*Requires\s*(.+)$/i.exec(trimmed);
    if (requires?.[1]) {
        return `Insufficient scope. Required: ${requires[1]} (all)`;
    }
    // Keep "forbidden scope present" informative, but normalize the prefix.
    const forbidden = /^Access denied\.\s*Forbidden scopes present:\s*(.+)$/i.exec(trimmed);
    if (forbidden?.[1]) {
        return `Insufficient scope. Forbidden: ${forbidden[1]}`;
    }
    return trimmed;
}
function extractServerErrorMessage(data) {
    if (!data)
        return null;
    if (typeof data === 'string')
        return data;
    if (typeof data === 'object') {
        const d = data;
        // OAuth-style errors
        if (typeof d.error_description === 'string' && d.error_description)
            return d.error_description;
        if (typeof d.error === 'string' &&
            d.error &&
            typeof d.error_description !== 'string')
            return d.error;
        // apps/api HttpExceptionFilter shape: { error: { code, message }, request_id, timestamp }
        if (typeof d.error?.message === 'string' && d.error.message)
            return d.error.message;
        if (Array.isArray(d.error?.message) && d.error.message.length > 0) {
            return d.error.message
                .filter((x) => typeof x === 'string')
                .join(', ');
        }
        // NestJS default exception shape: { statusCode, message, error }
        if (typeof d.message === 'string' && d.message)
            return d.message;
        if (Array.isArray(d.message) && d.message.length > 0) {
            return d.message.filter((x) => typeof x === 'string').join(', ');
        }
    }
    return null;
}
/**
 * Detect OAuth-style error payloads.
 *
 * @remarks
 * Purpose:
 * - Distinguish OAuth error envelopes from generic API errors.
 *
 * Parameters:
 * - `data`: Parsed response payload. Nullable: yes.
 *
 * Return semantics:
 * - Returns true when payload includes an OAuth `error` field.
 *
 * Errors/failure modes:
 * - None; best-effort detection.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - OAuth errors include `error` and/or `error_description`.
 */
function isOAuthErrorPayload(data) {
    if (!data || typeof data !== 'object')
        return false;
    const payload = data;
    return typeof payload.error === 'string' && payload.error.length > 0;
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
export class APIClient {
    constructor(options) {
        // Ensure fetch is called with the correct binding to avoid "Illegal invocation".
        this.fetchImpl =
            options.fetch ??
                ((...args) => {
                    const f = globalThis.fetch;
                    return f.apply(globalThis, args);
                });
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.getAccessToken = options.getAccessToken;
        this.onUnauthorized = options.onUnauthorized;
        this.requestPolicy = {
            timeoutMs: options.timeoutMs ?? 30000,
            attemptTimeoutMs: options.attemptTimeoutMs ?? 10000,
            retry: options.retry,
        };
        this.telemetry = options.telemetry;
    }
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
    async get(path, signal) {
        return this.request({ path, method: 'GET', signal });
    }
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
    async post(path, body, options) {
        const normalized = options &&
            typeof options === 'object' &&
            ('signal' in options || 'headers' in options || 'requestPolicy' in options)
            ? options
            : undefined;
        const signal = normalized?.signal ?? options;
        const headers = normalized?.headers;
        const requestPolicy = normalized?.requestPolicy;
        return this.request({
            path,
            method: 'POST',
            body,
            signal,
            headers,
            requestPolicy,
        });
    }
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
    async put(path, body, options) {
        const normalized = options && typeof options === 'object' && ('signal' in options || 'headers' in options)
            ? options
            : undefined;
        const signal = normalized?.signal ?? options;
        const headers = normalized?.headers;
        return this.request({
            path,
            method: 'PUT',
            body,
            signal,
            headers,
        });
    }
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
    async patch(path, body, options) {
        const normalized = options && typeof options === 'object' && ('signal' in options || 'headers' in options)
            ? options
            : undefined;
        const signal = normalized?.signal ?? options;
        const headers = normalized?.headers;
        return this.request({
            path,
            method: 'PATCH',
            body,
            signal,
            headers,
        });
    }
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
    async delete(path, options) {
        const normalized = options && typeof options === 'object' && ('signal' in options || 'headers' in options)
            ? options
            : undefined;
        const signal = normalized?.signal ?? options;
        const headers = normalized?.headers;
        return this.request({ path, method: 'DELETE', signal, headers });
    }
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
    async request(options) {
        const attempt = async (retrying = false) => {
            const headers = {
                Accept: 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers ?? {}),
            };
            const token = await this.getAccessToken?.();
            if (token)
                headers.Authorization = `Bearer ${token}`;
            const url = `${this.baseUrl}${options.path}`;
            const requestId = headers['x-request-id'] ??
                headers['X-Request-ID'] ??
                generateRequestId();
            headers['x-request-id'] = requestId;
            const redactor = this.telemetry?.redact ?? ((i) => defaultRedact(i));
            const redacted = redactor({
                url,
                method: options.method,
                headers,
                body: options.body,
            });
            const startedAt = Date.now();
            let response;
            try {
                this.telemetry?.onRequestStart?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    headers: redacted.headers,
                    body: redacted.body,
                    attempt: 0,
                    maxRetries: this.requestPolicy.retry?.retries ?? 2,
                });
                const effectivePolicy = options.requestPolicy
                    ? {
                        ...this.requestPolicy,
                        ...options.requestPolicy,
                        retry: options.requestPolicy.retry ?? this.requestPolicy.retry,
                    }
                    : this.requestPolicy;
                response = await fetchWithPolicy(this.fetchImpl, url, {
                    method: options.method,
                    headers,
                    body: options.body ? JSON.stringify(options.body) : undefined,
                    // API requests are Bearer-token authenticated. Do not send cookies; avoid credentialed CORS.
                    credentials: 'omit',
                    signal: options.signal,
                }, {
                    ...effectivePolicy,
                    hooks: {
                        onRetry: (ctx) => {
                            this.telemetry?.onRequestRetry?.({
                                requestId,
                                url,
                                method: options.method,
                                startedAt,
                                attempt: ctx.attempt,
                                maxRetries: ctx.maxRetries,
                                waitMs: ctx.waitMs,
                                reason: ctx.reason,
                            });
                        },
                    },
                });
            }
            catch (err) {
                const originHint = resolveOriginHint(url, this.baseUrl);
                const meta = {
                    requestId,
                    url,
                    method: options.method,
                };
                const durationMs = Date.now() - startedAt;
                if (err?.name === 'AbortError') {
                    const abortedByCaller = options.signal?.aborted === true;
                    const e = abortedByCaller
                        ? new AbortedError('Request aborted', { cause: err }, meta)
                        : new TimeoutError('Request timed out', { cause: err }, meta);
                    this.telemetry?.onRequestError?.({
                        requestId,
                        url,
                        method: options.method,
                        startedAt,
                        durationMs,
                        error: e,
                    });
                    throw e;
                }
                const isDev = typeof process !== 'undefined' &&
                    typeof process.env?.NODE_ENV === 'string' &&
                    process.env.NODE_ENV !== 'production';
                if (isDev) {
                    const rawError = err;
                    const errorName = typeof rawError?.name === 'string' ? rawError.name : 'Error';
                    const errorMessage = typeof rawError?.message === 'string'
                        ? rawError.message
                        : rawError?.message != null
                            ? String(rawError.message)
                            : 'Network request failed';
                    // eslint-disable-next-line no-console
                    console.warn(`[XKOVA SDK] Network error (${options.method} ${url}): ${errorName}: ${errorMessage}`);
                }
                const e = new NetworkError(`Failed to reach ${url}. Check your network or CORS allowlist for ${originHint}.`, { cause: err }, meta);
                this.telemetry?.onRequestError?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs,
                    error: e,
                });
                throw e;
            }
            const serverRequestId = response.headers.get('x-request-id') ??
                response.headers.get('X-Request-ID');
            if (response.status === 204)
                return undefined;
            let data = null;
            const text = await response.text();
            if (text) {
                try {
                    data = JSON.parse(text);
                }
                catch {
                    data = text;
                }
            }
            if (response.ok) {
                this.telemetry?.onRequestSuccess?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs: Date.now() - startedAt,
                    status: response.status,
                    headers: headersToRecord(response.headers),
                });
                // apps/api wraps all successful responses in { data, request_id, timestamp }.
                // Unwrap centrally so callers can treat responses as their domain payload.
                const payload = isApiEnvelope(data) ? data.data : data;
                return payload;
            }
            if (response.status === 401 && this.onUnauthorized && !retrying) {
                const refreshed = await this.onUnauthorized();
                if (refreshed) {
                    return attempt(true);
                }
            }
            const meta = {
                requestId,
                url,
                method: options.method,
                status: response.status,
                serverRequestId,
            };
            if (response.status === 401) {
                const e = new UnauthorizedError('Request unauthorized', response.status, data, meta);
                this.telemetry?.onRequestError?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs: Date.now() - startedAt,
                    status: response.status,
                    error: e,
                });
                throw e;
            }
            if (response.status === 429) {
                const e = new RateLimitedError('Rate limited', response.status, data, meta);
                this.telemetry?.onRequestError?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs: Date.now() - startedAt,
                    status: response.status,
                    error: e,
                });
                throw e;
            }
            if (response.status >= 500) {
                const e = new ServerError('Server error', response.status, data, meta);
                this.telemetry?.onRequestError?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs: Date.now() - startedAt,
                    status: response.status,
                    error: e,
                });
                throw e;
            }
            const rawMessage = extractServerErrorMessage(data) ?? 'Request failed';
            const message = normalizeInsufficientScopeMessage(rawMessage);
            if (response.status === 404) {
                const e = new NotFoundError(message, response.status, data, meta);
                this.telemetry?.onRequestError?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs: Date.now() - startedAt,
                    status: response.status,
                    error: e,
                });
                throw e;
            }
            if (response.status === 400 || response.status === 422) {
                const e = new ValidationError(message, data, meta);
                this.telemetry?.onRequestError?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs: Date.now() - startedAt,
                    status: response.status,
                    error: e,
                });
                throw e;
            }
            if (response.status === 403) {
                const e = new UnauthorizedError(message || 'Request forbidden', response.status, data, meta);
                this.telemetry?.onRequestError?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs: Date.now() - startedAt,
                    status: response.status,
                    error: e,
                });
                throw e;
            }
            if (response.status >= 400 && response.status < 500) {
                const e = isOAuthErrorPayload(data)
                    ? new OAuthError(message, response.status, data, meta)
                    : new BadResponseError(message, response.status, data, meta);
                this.telemetry?.onRequestError?.({
                    requestId,
                    url,
                    method: options.method,
                    startedAt,
                    durationMs: Date.now() - startedAt,
                    status: response.status,
                    error: e,
                });
                throw e;
            }
            const e = new BadResponseError('Unexpected server response', response.status, data, meta);
            this.telemetry?.onRequestError?.({
                requestId,
                url,
                method: options.method,
                startedAt,
                durationMs: Date.now() - startedAt,
                status: response.status,
                error: e,
            });
            throw e;
        };
        return attempt(false);
    }
}
