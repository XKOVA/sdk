/**
 * Canonical error code identifiers exposed by the SDK.
 *
 * @remarks
 * Purpose:
 * - Provide stable string identifiers for branching on SDK errors.
 *
 * When to use:
 * - Use to switch on `SDKError.code` values in error handlers.
 *
 * When not to use:
 * - Do not parse `message` strings for control flow when `code` is available.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - String literal union only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Codes are stable across SDK releases for compatibility.
 *
 * Data/auth references:
 * - Used by SDKError subclasses raised from OAuth/apps/api requests.
 */
export type SDKErrorCode = "network" | "timeout" | "aborted" | "rate_limited" | "server_error" | "bad_response" | "oauth" | "validation" | "unauthorized" | "not_found" | "unknown" | "IEE_REQUIRED" | "IEE_CANCELLED" | "IEE_FAILED" | "IEE_ACTION_MAPPING_MISSING" | "THIRD_PARTY_ACTION_UNSUPPORTED";
/**
 * Canonical error code identifiers for IEE (SafeApprove) orchestration.
 *
 * @remarks
 * Purpose:
 * - Provide machine-distinguishable codes for IEE (SafeApprove) receipt failures.
 *
 * When to use:
 * - Thrown by IEE (SafeApprove) orchestration when receipt requirements are not met.
 *
 * When not to use:
 * - Do not use to represent generic network or OAuth errors.
 *
 * Return semantics:
 * - String literal union only; no runtime behavior.
 *
 * Side effects:
 * - None.
 */
export type IeeErrorCode = "IEE_REQUIRED" | "IEE_CANCELLED" | "IEE_FAILED" | "IEE_ACTION_MAPPING_MISSING" | "THIRD_PARTY_ACTION_UNSUPPORTED";
/**
 * Structured details attached to IEE (SafeApprove) orchestration errors.
 */
export type IeeErrorDetails = {
    sdkActionType?: string;
    serverActionType?: string | null;
    providerErrorCode?: string | null;
};
/**
 * Metadata attached to SDK errors for debugging and observability.
 *
 * @remarks
 * Purpose:
 * - Capture request context (request id, URL, method, status) alongside SDK errors.
 *
 * When to use:
 * - Inspect in error handlers or telemetry to correlate failures with backend logs.
 *
 * When not to use:
 * - Do not surface raw metadata to end users; it may include sensitive URLs or identifiers.
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
 * - None.
 *
 * Invariants/assumptions:
 * - Fields are optional and may be undefined on client-side errors.
 *
 * Data/auth references:
 * - Populated from apps/api and oauth-server response metadata when available.
 */
export type SDKErrorMeta = {
    requestId?: string;
    url?: string;
    method?: string;
    status?: number;
    /**
     * Response header request id (e.g. X-Request-ID) when present.
     */
    serverRequestId?: string | null;
};
/**
 * Base error for all SDK failures.
 *
 * @remarks
 * Purpose:
 * - Provide a consistent error shape with stable `code` identifiers.
 *
 * When to use:
 * - Catch and branch on `code` or `name` when handling SDK failures.
 *
 * When not to use:
 * - Do not throw SDKError directly unless you are extending the SDK internals.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: no.
 * - `code`: Canonical SDK error code. Nullable: yes (defaults to "unknown").
 * - `status`: Optional HTTP status code. Nullable: yes.
 * - `details`: Optional response payload for debugging. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs an Error subclass with SDK-specific metadata.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `code` is one of SDKErrorCode values.
 *
 * Data/auth references:
 * - `meta` may include request identifiers from OAuth/apps/api responses.
 */
export declare class SDKError extends Error {
    readonly code: SDKErrorCode;
    readonly status?: number;
    readonly details?: unknown;
    readonly meta?: SDKErrorMeta;
    constructor(message: string, code?: SDKErrorCode, status?: number, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Error raised when IEE (SafeApprove) receipt orchestration fails or is blocked.
 *
 * @remarks
 * Purpose:
 * - Communicate receipt requirements, cancellations, and IEE (SafeApprove) flow failures.
 *
 * When to use:
 * - Thrown by IEE (SafeApprove) orchestration in sdk-core or sdk-react integrations.
 *
 * When not to use:
 * - Do not use for general HTTP or OAuth failures.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: no.
 * - `code`: IEE (SafeApprove)-specific error code. Nullable: no.
 * - `details`: Optional IEE (SafeApprove)-specific details (action types, provider code). Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs an SDKError with IEE (SafeApprove)-specific code and details.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `code` is one of IeeErrorCode values.
 */
export declare class IeeError extends SDKError {
    readonly details?: IeeErrorDetails;
    constructor(message: string, code: IeeErrorCode, details?: IeeErrorDetails, meta?: SDKErrorMeta);
}
/**
 * Raised when the network request fails before a response is available.
 *
 * @remarks
 * Purpose:
 * - Represent network-layer failures (DNS, connection reset, CORS).
 *
 * When to use:
 * - Catch to distinguish connectivity problems from server responses.
 *
 * When not to use:
 * - Do not use for HTTP error responses; those map to OAuthError/ServerError/etc.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: yes (defaults to "Network error").
 * - `details`: Optional error payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs a NetworkError with `code = "network"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Indicates failure before an HTTP response is available.
 *
 * Data/auth references:
 * - May include request URL/method metadata when available.
 */
export declare class NetworkError extends SDKError {
    constructor(message: string, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when a request exceeded the configured timeout budget.
 *
 * @remarks
 * Purpose:
 * - Represent client-enforced timeout failures.
 *
 * When to use:
 * - Catch when you need to retry or show timeout-specific messaging.
 *
 * When not to use:
 * - Do not treat as a server error; the request may not have reached the server.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: yes (defaults to "Request timed out").
 * - `details`: Optional error payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs a TimeoutError with `code = "timeout"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Indicates timeout budget elapsed for the request.
 *
 * Data/auth references:
 * - May include request URL/method metadata when available.
 */
export declare class TimeoutError extends SDKError {
    constructor(message?: string, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when a request was explicitly aborted/cancelled by the caller.
 *
 * @remarks
 * Purpose:
 * - Distinguish cancellation from network/server failures.
 *
 * When to use:
 * - Catch when you want to ignore user-initiated cancellations.
 *
 * When not to use:
 * - Do not treat as a retryable error; the caller intentionally aborted.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: yes (defaults to "Request aborted").
 * - `details`: Optional error payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs an AbortedError with `code = "aborted"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Indicates a deliberate abort or cancellation signal.
 *
 * Data/auth references:
 * - May include request URL/method metadata when available.
 */
export declare class AbortedError extends SDKError {
    constructor(message?: string, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when the OAuth server responds with an error payload.
 *
 * @remarks
 * Purpose:
 * - Normalize OAuth error responses into SDKError form.
 *
 * When to use:
 * - Catch to handle OAuth error codes and descriptions from the auth server.
 *
 * When not to use:
 * - Do not use for apps/api errors; those map to ServerError/BadResponseError.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: no.
 * - `status`: HTTP status code from OAuth server. Nullable: yes.
 * - `details`: OAuth error payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs an OAuthError with `code = "oauth"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `details` may include `error`/`error_description`.
 *
 * Data/auth references:
 * - Raised from oauth-server responses.
 */
export declare class OAuthError extends SDKError {
    constructor(message: string, status?: number, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when inputs do not meet validation requirements.
 *
 * @remarks
 * Purpose:
 * - Surface local validation failures before issuing network requests.
 *
 * When to use:
 * - Catch to show input validation errors to the user.
 *
 * When not to use:
 * - Do not use to represent server-side validation errors; those return BadResponseError.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: no.
 * - `details`: Optional validation detail payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs a ValidationError with `code = "validation"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Represents client-side validation failures.
 *
 * Data/auth references:
 * - None.
 */
export declare class ValidationError extends SDKError {
    constructor(message: string, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when authentication fails or tokens are missing.
 *
 * @remarks
 * Purpose:
 * - Normalize missing/expired credentials into a typed error.
 *
 * When to use:
 * - Catch to trigger logout or re-auth flows.
 *
 * When not to use:
 * - Do not use for insufficient scope; those are surfaced as OAuthError/BadResponseError.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: yes (defaults to "Authentication required").
 * - `status`: Optional HTTP status code. Nullable: yes.
 * - `details`: Optional error payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs an UnauthorizedError with `code = "unauthorized"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Indicates missing or invalid auth context.
 *
 * Data/auth references:
 * - Often raised on 401 responses from OAuth/apps/api.
 */
export declare class UnauthorizedError extends SDKError {
    constructor(message?: string, status?: number, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when a requested resource is not found (HTTP 404).
 *
 * @remarks
 * Purpose:
 * - Provide a typed error for missing resources returned by API or OAuth endpoints.
 *
 * When to use:
 * - Catch to show "not found" UX or to branch on missing resources.
 *
 * When not to use:
 * - Do not use for authorization failures; those map to UnauthorizedError/OAuthError.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: yes (defaults to "Not found").
 * - `status`: HTTP status code (typically 404). Nullable: yes.
 * - `details`: Optional response payload for debugging. Nullable: yes.
 * - `meta`: Optional request metadata (request id, url, method). Nullable: yes.
 *
 * Return semantics:
 * - Constructs a NotFoundError with `code = "not_found"`.
 *
 * Errors/failure modes:
 * - None; this constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `status` is expected to be 404 when provided.
 *
 * Data/auth references:
 * - Raised from apps/api and oauth-server 404 responses.
 *
 * @example
 * throw new NotFoundError("Resource not found", 404, payload, meta);
 */
export declare class NotFoundError extends SDKError {
    constructor(message?: string, status?: number, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when a request is rate limited (HTTP 429).
 *
 * @remarks
 * Purpose:
 * - Provide a typed error for rate limit responses.
 *
 * When to use:
 * - Catch to implement backoff, retries, or user messaging for throttling.
 *
 * When not to use:
 * - Do not treat as a validation error; the request may succeed later.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: yes (defaults to "Rate limited").
 * - `status`: HTTP status code (typically 429). Nullable: yes.
 * - `details`: Optional response payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs a RateLimitedError with `code = "rate_limited"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `status` is expected to be 429 when provided.
 *
 * Data/auth references:
 * - Raised from apps/api and oauth-server responses with rate limits.
 */
export declare class RateLimitedError extends SDKError {
    constructor(message?: string, status?: number, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when a server returns a 5xx error response.
 *
 * @remarks
 * Purpose:
 * - Provide a typed error for server-side failures.
 *
 * When to use:
 * - Catch to display fallback messaging or trigger retries.
 *
 * When not to use:
 * - Do not use for network failures; those are NetworkError/TimeoutError.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: yes (defaults to "Server error").
 * - `status`: HTTP status code. Nullable: yes.
 * - `details`: Optional response payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs a ServerError with `code = "server_error"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `status` is typically >= 500 when provided.
 *
 * Data/auth references:
 * - Raised from apps/api and oauth-server 5xx responses.
 */
export declare class ServerError extends SDKError {
    constructor(message?: string, status?: number, details?: unknown, meta?: SDKErrorMeta);
}
/**
 * Raised when a response payload is malformed or unexpected.
 *
 * @remarks
 * Purpose:
 * - Surface schema/format mismatches between the SDK and backend responses.
 *
 * When to use:
 * - Catch to report API contract mismatches or show a generic error.
 *
 * When not to use:
 * - Do not use for application-level validation failures; those are ValidationError.
 *
 * Parameters:
 * - `message`: Human-readable error message. Nullable: yes (defaults to "Invalid response").
 * - `status`: HTTP status code. Nullable: yes.
 * - `details`: Optional response payload. Nullable: yes.
 * - `meta`: Optional request metadata. Nullable: yes.
 *
 * Return semantics:
 * - Constructs a BadResponseError with `code = "bad_response"`.
 *
 * Errors/failure modes:
 * - None; constructor does not throw.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Indicates a mismatch between expected and actual response shapes.
 *
 * Data/auth references:
 * - Raised from apps/api and oauth-server responses when parsing fails.
 */
export declare class BadResponseError extends SDKError {
    constructor(message?: string, status?: number, details?: unknown, meta?: SDKErrorMeta);
}
