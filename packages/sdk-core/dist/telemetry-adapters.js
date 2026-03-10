import { defaultRedact, generateRequestId, } from "./telemetry.js";
import { SDKError } from "./errors.js";
const nowIso = () => new Date().toISOString();
/**
 * Create a headless telemetry adapter for error events.
 *
 * @remarks
 * Purpose:
 * - Bridge sanitized, non-UI error events into SDKTelemetry.
 *
 * When to use:
 * - Use in headless flows or custom UI stacks that want SDK-style error telemetry.
 *
 * When not to use:
 * - Do not use when telemetry is not configured (returns null).
 *
 * Parameters:
 * - `telemetry`: SDK telemetry hooks (object | null | undefined). Nullable: yes.
 * - `opts`: Optional overrides for synthetic telemetry fields. Nullable: yes.
 * - `opts.url`: Synthetic URL identifier (string, optional, default: "headless://error").
 * - `opts.method`: Synthetic method identifier (string, optional, default: "HEADLESS").
 *
 * Return semantics:
 * - Returns a handler that forwards HeadlessErrorTelemetryEvent into telemetry.
 * - Returns null when telemetry is missing or does not define `onRequestError`.
 *
 * Errors/failure modes:
 * - None; does not throw.
 *
 * Side effects:
 * - None; returned handler invokes `telemetry.onRequestError` when called.
 *
 * Invariants/assumptions:
 * - Inputs are sanitized; avoid token material in `message` or `context`.
 * - Synthetic telemetry fields are not real HTTP endpoints.
 *
 * Data/auth references:
 * - No auth data is emitted; caller controls the message content.
 *
 * @example
 * const emitError = createHeadlessErrorTelemetryAdapter(telemetry);
 * emitError?.({ context: "Balances refresh failed", message: "Failed to load balances" });
 */
export const createHeadlessErrorTelemetryAdapter = (telemetry, opts) => {
    if (!telemetry?.onRequestError)
        return null;
    const url = opts?.url ?? "headless://error";
    const method = opts?.method ?? "HEADLESS";
    return (event) => {
        const requestId = generateRequestId();
        const error = new SDKError(event.message, "unknown", undefined, {
            kind: "headless_error",
            context: event.context,
        }, { requestId, url, method });
        telemetry.onRequestError?.({
            requestId,
            url,
            method,
            startedAt: event.timestamp ?? Date.now(),
            durationMs: 0,
            error,
        });
    };
};
/**
 * Console-based telemetry adapter for SDK HTTP activity.
 *
 * @remarks
 * Purpose:
 * - Provide a lightweight logger for request lifecycle events.
 *
 * When to use:
 * - Use for local development, debugging, or simple logging setups.
 *
 * When not to use:
 * - Avoid in production without sampling or structured logging controls.
 *
 * Parameters:
 * - `opts`: Logger configuration (optional). Nullable: yes.
 * - `opts.logger`: Logger-like object (console-compatible). Nullable: yes.
 * - `opts.level`: Minimum log level. Nullable: yes.
 * - `opts.logSuccess`: Whether to log successful requests. Nullable: yes.
 * - `opts.logRetries`: Whether to log retries. Nullable: yes.
 * - `opts.logErrors`: Whether to log errors. Nullable: yes.
 * - `opts.redact`: Optional redactor for headers/body. Nullable: yes.
 *
 * Return semantics:
 * - Returns an SDKTelemetry implementation.
 *
 * Errors/failure modes:
 * - None; logger failures are not caught.
 *
 * Side effects:
 * - Writes logs to the provided logger/console.
 *
 * Invariants/assumptions:
 * - Redaction is applied to headers/body before logging.
 *
 * Data/auth references:
 * - Logs request URLs and metadata; avoid exposing tokens in logs.
 *
 * @advanced
 */
export function createConsoleTelemetry(opts) {
    const logger = opts?.logger ?? console;
    const logSuccess = opts?.logSuccess ?? true;
    const logRetries = opts?.logRetries ?? true;
    const logErrors = opts?.logErrors ?? true;
    const redact = opts?.redact ?? ((i) => defaultRedact(i));
    const pick = (kind) => {
        return (logger[kind] ??
            logger.log ??
            (() => {
                /* ignore */
            }));
    };
    const info = pick(opts?.level ?? "info");
    const warn = pick("warn");
    const err = pick("error");
    return {
        redact,
        onRequestStart: (e) => {
            // noop: avoid log spam; we log on terminal outcomes by default.
            // debug-level integrations can log this if they want.
            if ((opts?.level ?? "info") === "debug") {
                info(`[xkova] ${nowIso()} request_start`, {
                    requestId: e.requestId,
                    method: e.method,
                    url: e.url,
                });
            }
        },
        onRequestRetry: (e) => {
            if (!logRetries)
                return;
            warn(`[xkova] ${nowIso()} request_retry`, {
                requestId: e.requestId,
                method: e.method,
                url: e.url,
                attempt: e.attempt,
                waitMs: e.waitMs,
                reason: e.reason,
            });
        },
        onRequestSuccess: (e) => {
            if (!logSuccess)
                return;
            info(`[xkova] ${nowIso()} request_success`, {
                requestId: e.requestId,
                method: e.method,
                url: e.url,
                status: e.status,
                durationMs: e.durationMs,
            });
        },
        onRequestError: (e) => {
            if (!logErrors)
                return;
            const payload = {
                requestId: e.requestId,
                method: e.method,
                url: e.url,
                status: e.status,
                durationMs: e.durationMs,
            };
            const error = e.error;
            if (error && typeof error === "object") {
                payload.errorName = error.name;
                payload.errorCode = error.code;
                payload.errorMessage = error.message;
                payload.meta = error.meta;
            }
            err(`[xkova] ${nowIso()} request_error`, payload);
        },
    };
}
/**
 * OpenTelemetry adapter (no dependency). Accepts any tracer/span objects
 * that behave like the OpenTelemetry API.
 */
/**
 * OpenTelemetry adapter factory (no dependency).
 *
 * @remarks
 * Purpose:
 * - Bridge SDK request telemetry into OpenTelemetry spans.
 *
 * When to use:
 * - Use when your app already has an OpenTelemetry tracer configured.
 *
 * When not to use:
 * - Do not use if you cannot provide a tracer/span implementation.
 *
 * Parameters:
 * - `opts`: Adapter configuration. Nullable: no.
 * - `opts.tracer`: Tracer with startSpan API. Nullable: no.
 * - `opts.spanName`: Optional span name override. Nullable: yes.
 * - `opts.redact`: Optional redactor for headers/body. Nullable: yes.
 *
 * Return semantics:
 * - Returns an SDKTelemetry implementation that emits spans per request.
 *
 * Errors/failure modes:
 * - None; adapter assumes tracer methods are available.
 *
 * Side effects:
 * - Emits OpenTelemetry spans for SDK requests.
 *
 * Invariants/assumptions:
 * - Spans are keyed by requestId and ended on success/error.
 *
 * Data/auth references:
 * - Attributes include request URLs and status codes; ensure redaction is applied.
 *
 * @advanced
 */
export function createOpenTelemetryTelemetry(opts) {
    const spans = new Map();
    const spanName = opts.spanName ?? "xkova.sdk.request";
    const redact = opts.redact ?? ((i) => defaultRedact(i));
    return {
        redact,
        onRequestStart: (e) => {
            const span = opts.tracer.startSpan(spanName, {
                attributes: {
                    "http.method": e.method,
                    "http.url": e.url,
                    "xkova.request_id": e.requestId,
                },
            });
            spans.set(e.requestId, span);
            span?.addEvent?.("request_start");
        },
        onRequestRetry: (e) => {
            const span = spans.get(e.requestId);
            span?.addEvent?.("request_retry", {
                attempt: e.attempt,
                wait_ms: e.waitMs,
                reason: e.reason.kind === "status" ? `status:${e.reason.status}` : "network",
            });
        },
        onRequestSuccess: (e) => {
            const span = spans.get(e.requestId);
            if (span) {
                span?.setAttributes?.({
                    "http.status_code": e.status,
                    "xkova.duration_ms": e.durationMs,
                });
                span?.setStatus?.({ code: 1 });
                span?.end?.();
                spans.delete(e.requestId);
            }
        },
        onRequestError: (e) => {
            const span = spans.get(e.requestId);
            if (span) {
                span?.setAttribute?.("xkova.duration_ms", e.durationMs);
                if (typeof e.status === "number")
                    span?.setAttribute?.("http.status_code", e.status);
                span?.recordException?.(e.error);
                span?.setStatus?.({ code: 2, message: e?.error?.message });
                span?.end?.();
                spans.delete(e.requestId);
            }
        },
    };
}
/**
 * Datadog APM adapter (dd-trace-like). No dependency.
 */
/**
 * Datadog APM (dd-trace-like) telemetry adapter factory.
 *
 * @remarks
 * Purpose:
 * - Bridge SDK request telemetry into Datadog APM spans.
 *
 * When to use:
 * - Use when you have a dd-trace compatible tracer in Node or browser.
 *
 * When not to use:
 * - Do not use if you cannot provide a tracer with startSpan API.
 *
 * Parameters:
 * - `opts`: Adapter configuration. Nullable: no.
 * - `opts.tracer`: Tracer with startSpan API. Nullable: no.
 * - `opts.spanName`: Optional span name override. Nullable: yes.
 * - `opts.service`: Optional service name. Nullable: yes.
 * - `opts.redact`: Optional redactor for headers/body. Nullable: yes.
 *
 * Return semantics:
 * - Returns an SDKTelemetry implementation that emits Datadog spans.
 *
 * Errors/failure modes:
 * - None; adapter assumes tracer methods are available.
 *
 * Side effects:
 * - Emits Datadog APM spans for SDK requests.
 *
 * Invariants/assumptions:
 * - Spans are keyed by requestId and finished on success/error.
 *
 * Data/auth references:
 * - Attributes include request URLs and status codes; ensure redaction is applied.
 *
 * @advanced
 */
export function createDatadogTraceTelemetry(opts) {
    const spans = new Map();
    const spanName = opts.spanName ?? "xkova.sdk.request";
    const redact = opts.redact ?? ((i) => defaultRedact(i));
    return {
        redact,
        onRequestStart: (e) => {
            const span = opts.tracer.startSpan(spanName, {
                service: opts.service,
                resource: `${e.method} ${e.url}`,
                type: "http",
                tags: {
                    "http.method": e.method,
                    "http.url": e.url,
                    "xkova.request_id": e.requestId,
                },
            });
            spans.set(e.requestId, span);
        },
        onRequestRetry: (e) => {
            const span = spans.get(e.requestId);
            span?.setTag?.("xkova.retry.attempt", e.attempt);
            span?.setTag?.("xkova.retry.wait_ms", e.waitMs);
            span?.setTag?.("xkova.retry.reason", e.reason.kind === "status" ? `status:${e.reason.status}` : "network");
        },
        onRequestSuccess: (e) => {
            const span = spans.get(e.requestId);
            if (span) {
                span?.setTag?.("http.status_code", e.status);
                span?.setTag?.("xkova.duration_ms", e.durationMs);
                span?.finish?.();
                spans.delete(e.requestId);
            }
        },
        onRequestError: (e) => {
            const span = spans.get(e.requestId);
            if (span) {
                if (typeof e.status === "number")
                    span?.setTag?.("http.status_code", e.status);
                span?.setTag?.("error", true);
                span?.setTag?.("xkova.duration_ms", e.durationMs);
                const err = e.error;
                if (err?.message)
                    span?.setTag?.("error.message", err.message);
                if (err?.name)
                    span?.setTag?.("error.type", err.name);
                span?.finish?.();
                spans.delete(e.requestId);
            }
        },
    };
}
/**
 * Datadog RUM adapter (browser). No dependency.
 */
/**
 * Datadog RUM adapter factory for browser telemetry.
 *
 * @remarks
 * Purpose:
 * - Emit SDK request events into Datadog RUM.
 *
 * When to use:
 * - Use in browser apps that already initialize Datadog RUM.
 *
 * When not to use:
 * - Do not use in Node environments or without a RUM client instance.
 *
 * Parameters:
 * - `opts`: Adapter configuration. Nullable: no.
 * - `opts.rum`: Datadog RUM client instance. Nullable: no.
 * - `opts.redact`: Optional redactor for headers/body. Nullable: yes.
 *
 * Return semantics:
 * - Returns an SDKTelemetry implementation that emits RUM events.
 *
 * Errors/failure modes:
 * - None; adapter assumes rum methods are available.
 *
 * Side effects:
 * - Emits RUM events for SDK requests.
 *
 * Invariants/assumptions:
 * - RUM context is updated per requestId.
 *
 * Data/auth references:
 * - Emits URLs and status codes; ensure redaction is applied.
 *
 * @advanced
 */
export function createDatadogRumTelemetry(opts) {
    const redact = opts.redact ?? ((i) => defaultRedact(i));
    return {
        redact,
        onRequestSuccess: (e) => {
            opts.rum.addAction?.("xkova.sdk.request", {
                requestId: e.requestId,
                method: e.method,
                url: e.url,
                status: e.status,
                durationMs: e.durationMs,
            });
        },
        onRequestError: (e) => {
            opts.rum.addError?.(e.error, {
                requestId: e.requestId,
                method: e.method,
                url: e.url,
                status: e.status,
                durationMs: e.durationMs,
            });
        },
    };
}
/**
 * Sentry adapter (errors + optional spans). No dependency.
 *
 * - Always supports error capture via `captureException` if provided.
 * - Supports spans if `startSpan` (returning a span) or `startSpanManual` exists.
 */
/**
 * Sentry telemetry adapter factory for SDK requests.
 *
 * @remarks
 * Purpose:
 * - Emit SDK request breadcrumbs and spans into Sentry.
 *
 * When to use:
 * - Use when Sentry is initialized and you want SDK request observability.
 *
 * When not to use:
 * - Do not use without Sentry client APIs configured.
 *
 * Parameters:
 * - `opts`: Adapter configuration. Nullable: no.
 * - `opts.sentry`: Sentry client APIs (startSpan/addBreadcrumb). Nullable: no.
 * - `opts.spanName`: Optional span name override. Nullable: yes.
 * - `opts.redact`: Optional redactor for headers/body. Nullable: yes.
 *
 * Return semantics:
 * - Returns an SDKTelemetry implementation that emits Sentry spans/breadcrumbs.
 *
 * Errors/failure modes:
 * - None; adapter assumes Sentry APIs are available.
 *
 * Side effects:
 * - Emits Sentry spans and breadcrumbs for SDK requests.
 *
 * Invariants/assumptions:
 * - Spans are keyed by requestId and finished on success/error.
 *
 * Data/auth references:
 * - Emits URLs and status codes; ensure redaction is applied.
 *
 * @advanced
 */
export function createSentryTelemetry(opts) {
    const spans = new Map();
    const spanName = opts.spanName ?? "xkova.sdk.request";
    const redact = opts.redact ?? ((i) => defaultRedact(i));
    const captureErrors = opts.captureErrors ?? true;
    const startSpan = (opts.Sentry.startSpanManual ?? opts.Sentry.startSpan)?.bind(opts.Sentry);
    return {
        redact,
        onRequestStart: (e) => {
            if (!startSpan)
                return;
            const span = startSpan({
                name: spanName,
                op: "http.client",
                attributes: {
                    "http.method": e.method,
                    "http.url": e.url,
                    "xkova.request_id": e.requestId,
                },
            });
            if (span)
                spans.set(e.requestId, span);
        },
        onRequestRetry: (e) => {
            const span = spans.get(e.requestId);
            span?.setAttribute?.("xkova.retry.attempt", e.attempt);
            span?.setAttribute?.("xkova.retry.wait_ms", e.waitMs);
        },
        onRequestSuccess: (e) => {
            const span = spans.get(e.requestId);
            if (span) {
                span?.setAttribute?.("http.status_code", e.status);
                span?.setAttribute?.("xkova.duration_ms", e.durationMs);
                span?.end?.();
                spans.delete(e.requestId);
            }
        },
        onRequestError: (e) => {
            const span = spans.get(e.requestId);
            if (span) {
                if (typeof e.status === "number")
                    span?.setAttribute?.("http.status_code", e.status);
                span?.setAttribute?.("xkova.duration_ms", e.durationMs);
                span?.setStatus?.({ code: "error" });
                span?.end?.();
                spans.delete(e.requestId);
            }
            if (captureErrors) {
                opts.Sentry.captureException?.(e.error, {
                    tags: {
                        "xkova.request_id": e.requestId,
                        "xkova.method": e.method,
                    },
                    extra: {
                        url: e.url,
                        status: e.status,
                        durationMs: e.durationMs,
                    },
                });
            }
        },
    };
}
