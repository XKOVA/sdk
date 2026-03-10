import { SDKError } from "./errors.js";

/**
 * Telemetry event names emitted by the SDK transport layer.
 *
 * @remarks
 * Purpose:
 * - Provide stable event identifiers for telemetry adapters.
 *
 * When to use:
 * - Use to filter or branch on telemetry events in adapters.
 *
 * When not to use:
 * - Do not emit custom event names not defined here.
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
 * - Event names are stable across SDK releases.
 *
 * Data/auth references:
 * - Events describe apps/api and oauth-server requests.
 */
export type SDKTelemetryEventName =
  | "request_start"
  | "request_retry"
  | "request_success"
  | "request_error";

/**
 * Base telemetry payload shared by all SDK telemetry events.
 *
 * @remarks
 * Purpose:
 * - Provide common request metadata for telemetry callbacks.
 *
 * When to use:
 * - Use as the base shape when implementing custom telemetry adapters.
 *
 * When not to use:
 * - Do not assume fields are always populated; optional fields may be undefined.
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
 * - `requestId` is unique per request attempt.
 *
 * Data/auth references:
 * - `url` and `method` reference OAuth/apps/api endpoints.
 */
export type SDKTelemetryBase = {
  requestId: string;
  url: string;
  method: string;
  startedAt: number;
  durationMs?: number;
  attempt?: number;
  maxRetries?: number;
};

/**
 * Telemetry payload for request_start events.
 *
 * @remarks
 * Purpose:
 * - Capture request metadata including headers/body (redacted).
 *
 * When to use:
 * - Use in telemetry adapters that log or trace request starts.
 *
 * When not to use:
 * - Do not include raw secrets; ensure redaction is applied.
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
 * - `headers` and `body` are redacted by the SDK unless overridden.
 *
 * Data/auth references:
 * - May include Authorization headers if redaction is disabled.
 */
export type SDKTelemetryRequest = SDKTelemetryBase & {
  headers?: Record<string, string>;
  body?: unknown;
};

/**
 * Telemetry payload for request_success events.
 *
 * @remarks
 * Purpose:
 * - Record response status and timing for successful requests.
 *
 * When to use:
 * - Use to emit metrics for successful responses.
 *
 * When not to use:
 * - Do not treat as failure diagnostics; use SDKTelemetryError for failures.
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
 * - `status` is the HTTP status code.
 *
 * Data/auth references:
 * - Applies to OAuth/apps/api responses.
 */
export type SDKTelemetryResponse = SDKTelemetryBase & {
  status: number;
  headers?: Record<string, string>;
};

/**
 * Telemetry payload for request_retry events.
 *
 * @remarks
 * Purpose:
 * - Capture retry timing and reasons for transient failures.
 *
 * When to use:
 * - Use to observe retry behavior and tune retry policies.
 *
 * When not to use:
 * - Do not treat as a terminal failure; retries may still succeed.
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
 * - `reason.kind` is "status" or "network".
 *
 * Data/auth references:
 * - Applies to OAuth/apps/api request retries.
 */
export type SDKTelemetryRetry = SDKTelemetryBase & {
  waitMs: number;
  reason: { kind: "status"; status: number } | { kind: "network" } ;
};

/**
 * Telemetry payload for request_error events.
 *
 * @remarks
 * Purpose:
 * - Capture terminal failures for requests.
 *
 * When to use:
 * - Use to log errors or forward them to observability backends.
 *
 * When not to use:
 * - Do not treat as retry signals; retries have already been exhausted or disabled.
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
 * - `error` is an Error or SDKError instance when available.
 *
 * Data/auth references:
 * - Applies to OAuth/apps/api request failures.
 */
export type SDKTelemetryError = SDKTelemetryBase & {
  error: SDKError | Error | unknown;
  status?: number;
};

/**
 * Redactor function for telemetry payloads.
 *
 * @remarks
 * Purpose:
 * - Allow callers to redact or omit sensitive headers and bodies.
 *
 * When to use:
 * - Use when integrating telemetry with systems that must not receive raw tokens.
 *
 * When not to use:
 * - Do not disable redaction for production telemetry pipelines.
 *
 * Parameters:
 * - `input`: Raw request metadata (url, method, headers, body). Nullable: no.
 *
 * Return semantics:
 * - Returns redacted headers/body fields.
 *
 * Errors/failure modes:
 * - Implementations may throw; avoid throwing in telemetry paths.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Caller should preserve the shape of the input object.
 *
 * Data/auth references:
 * - Operates on Authorization and token-bearing headers.
 */
export type SDKTelemetryRedactor = (input: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}) => { headers?: Record<string, string>; body?: unknown };

/**
 * Telemetry callbacks for SDK HTTP activity.
 *
 * @remarks
 * Purpose:
 * - Provide hooks for request lifecycle events in SDK transport.
 *
 * When to use:
 * - Use to integrate logging, tracing, or metrics for SDK requests.
 *
 * When not to use:
 * - Do not log raw access tokens; rely on redaction or provide a custom redactor.
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
 * - Implementations may log or emit telemetry in external systems.
 *
 * Invariants/assumptions:
 * - Callbacks may be invoked multiple times per request (retries).
 *
 * Data/auth references:
 * - Telemetry is emitted for OAuth/apps/api requests.
 */
export type SDKTelemetry = {
  /**
   * Called for each request attempt start.
   */
  onRequestStart?: (evt: SDKTelemetryRequest) => void;
  /**
   * Called before a retry/backoff is applied.
   */
  onRequestRetry?: (evt: SDKTelemetryRetry) => void;
  /**
   * Called once when a response is received (final attempt that returned).
   */
  onRequestSuccess?: (evt: SDKTelemetryResponse) => void;
  /**
   * Called on terminal failure (network error, timeout, or non-retryable error).
   */
  onRequestError?: (evt: SDKTelemetryError) => void;
  /**
   * Optional redaction for headers/bodies passed to callbacks.
   * Default redactor removes Authorization/Cookie and obscures obvious bearer tokens.
   */
  redact?: SDKTelemetryRedactor;
};

/**
 * Generate a request identifier for SDK telemetry.
 *
 * @remarks
 * Purpose:
 * - Provide unique IDs for correlating request attempts.
 *
 * When to use:
 * - Use internally when emitting telemetry for SDK requests.
 *
 * When not to use:
 * - Do not use as a security token; it is not cryptographically strong in all runtimes.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns a unique string identifier.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Uses crypto.randomUUID when available, otherwise a best-effort fallback.
 *
 * Data/auth references:
 * - None.
 */
export function generateRequestId(): string {
  const c = (globalThis as any)?.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback: non-cryptographic but unique enough for tracing.
  return `xkova_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Normalize Headers into a lowercase key/value record for telemetry.
 *
 * @remarks
 * Purpose:
 * - Convert Headers to a serializable object for logging/tracing.
 *
 * When to use:
 * - Use in telemetry adapters when you need to inspect response headers.
 *
 * When not to use:
 * - Do not log sensitive headers without redaction.
 *
 * Parameters:
 * - `headers`: Headers instance to normalize. Nullable: no.
 *
 * Return semantics:
 * - Returns a plain object with lowercase header keys.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Header values are treated as opaque strings.
 *
 * Data/auth references:
 * - Headers may include authorization or session identifiers.
 */
export function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/**
 * Default redaction helper for telemetry payloads.
 *
 * @remarks
 * Purpose:
 * - Remove Authorization/Cookie headers and token-like values from telemetry payloads.
 *
 * When to use:
 * - Use as the default redactor for telemetry adapters.
 *
 * When not to use:
 * - Do not disable unless you have a secure private telemetry pipeline.
 *
 * Parameters:
 * - `input`: Headers/body object to redact. Nullable: no.
 *
 * Return semantics:
 * - Returns a new object with redacted headers and no body.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Token-like headers are redacted by key name matching.
 *
 * Data/auth references:
 * - Removes Authorization, Cookie, and token-bearing headers.
 */
export function defaultRedact(input: {
  headers?: Record<string, string>;
  body?: unknown;
}): { headers?: Record<string, string>; body?: unknown } {
  const h = input.headers ? { ...input.headers } : undefined;
  if (h) {
    for (const k of Object.keys(h)) {
      const key = k.toLowerCase();
      if (key === "authorization" || key === "cookie" || key === "set-cookie") {
        delete h[k];
      } else if (key.includes("token")) {
        h[k] = "[redacted]";
      }
    }
  }

  // We avoid attempting to deeply redact bodies (could be large/unknown).
  // Consumers can provide a custom redact function if desired.
  return { headers: h, body: undefined };
}

