import { type SDKTelemetry, type SDKTelemetryRedactor } from "./telemetry.js";
type LoggerLike = {
    debug?: (...args: any[]) => void;
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
    log?: (...args: any[]) => void;
};
/**
 * Sanitized error event for headless telemetry adapters.
 *
 * @remarks
 * Purpose:
 * - Describe non-UI error events to forward into SDK telemetry.
 *
 * When to use:
 * - Use when emitting custom errors from headless or custom UI flows.
 *
 * When not to use:
 * - Do not include raw secrets or token values in `message` or `context`.
 *
 * Fields:
 * - `context`: Short label describing the error source.
 * - `message`: Sanitized message safe for telemetry pipelines.
 * - `timestamp`: Unix epoch milliseconds when the event occurred (optional).
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
 * - Messages are sanitized to avoid leaking credentials.
 *
 * Data/auth references:
 * - Must not include access tokens or secrets.
 *
 * @example
 * { context: "Balances refresh failed", message: "Failed to load balances", timestamp: 1712345678901 }
 */
export type HeadlessErrorTelemetryEvent = {
    context: string;
    message: string;
    timestamp?: number;
};
type HeadlessErrorTelemetryHandler = (event: HeadlessErrorTelemetryEvent) => void;
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
export declare const createHeadlessErrorTelemetryAdapter: (telemetry?: SDKTelemetry | null, opts?: {
    url?: string;
    method?: string;
}) => HeadlessErrorTelemetryHandler | null;
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
export declare function createConsoleTelemetry(opts?: {
    logger?: LoggerLike;
    /**
     * Default: "info"
     */
    level?: "debug" | "info" | "warn" | "error";
    /**
     * Default: true (logs one line per request)
     */
    logSuccess?: boolean;
    /**
     * Default: true
     */
    logRetries?: boolean;
    /**
     * Default: true
     */
    logErrors?: boolean;
    /**
     * Optional redactor (defaults to SDK's default redaction)
     */
    redact?: SDKTelemetryRedactor;
}): SDKTelemetry;
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
export declare function createOpenTelemetryTelemetry(opts: {
    tracer: {
        startSpan: (name: string, options?: {
            attributes?: Record<string, any>;
        }) => {
            setAttribute?: (k: string, v: any) => void;
            setAttributes?: (attrs: Record<string, any>) => void;
            addEvent?: (name: string, attrs?: Record<string, any>) => void;
            recordException?: (err: any) => void;
            setStatus?: (s: {
                code: number;
                message?: string;
            }) => void;
            end?: () => void;
        };
    };
    spanName?: string;
    redact?: SDKTelemetryRedactor;
}): SDKTelemetry;
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
export declare function createDatadogTraceTelemetry(opts: {
    tracer: {
        startSpan: (name: string, options?: {
            service?: string;
            resource?: string;
            type?: string;
            tags?: Record<string, any>;
        }) => {
            setTag?: (k: string, v: any) => void;
            addTags?: (tags: Record<string, any>) => void;
            finish?: () => void;
        };
    };
    spanName?: string;
    service?: string;
    redact?: SDKTelemetryRedactor;
}): SDKTelemetry;
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
export declare function createDatadogRumTelemetry(opts: {
    rum: {
        addAction?: (name: string, ctx?: Record<string, any>) => void;
        addError?: (error: any, ctx?: Record<string, any>) => void;
    };
    redact?: SDKTelemetryRedactor;
}): SDKTelemetry;
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
export declare function createSentryTelemetry(opts: {
    Sentry: {
        captureException?: (err: any, ctx?: any) => void;
        captureMessage?: (msg: string, ctx?: any) => void;
        startSpan?: (ctx: any) => {
            setAttribute?: (k: string, v: any) => void;
            setStatus?: (s: any) => void;
            end?: () => void;
        };
        startSpanManual?: (ctx: any) => {
            setAttribute?: (k: string, v: any) => void;
            setStatus?: (s: any) => void;
            end?: () => void;
        };
    };
    spanName?: string;
    redact?: SDKTelemetryRedactor;
    /**
     * Default: true
     */
    captureErrors?: boolean;
}): SDKTelemetry;
export {};
