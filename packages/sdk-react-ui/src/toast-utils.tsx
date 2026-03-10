import { toast } from "sonner";
import { SDKError } from "@xkova/sdk-core";
import { generateRequestId, type SDKTelemetry } from "@xkova/sdk-core/telemetry";

/**
 * Toast kind identifiers used by sdk-react-ui helpers.
 *
 * @remarks
 * Purpose:
 * - Represent the supported toast variants for notify helpers.
 *
 * When to use:
 * - Use when calling `notify` or custom toast handlers.
 *
 * When not to use:
 * - Do not invent new values; UI helpers only handle these kinds.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - None.
 */
export type ToastKind = "success" | "error" | "info";

type UnknownError = unknown;

/**
 * Sanitized error event emitted by SDK UI helpers.
 *
 * @remarks
 * Purpose:
 * - Provide a safe, minimal error payload for app telemetry.
 *
 * When to use:
 * - Use when capturing SDK UI error telemetry in host apps.
 *
 * When not to use:
 * - Do not include raw error objects or secrets; use the sanitized fields only.
 *
 * Fields:
 * - `context`: Short label describing the error source.
 * - `message`: Sanitized message safe for logs and dashboards.
 * - `kind`: Event kind (always "error" for this hook).
 * - `timestamp`: Unix epoch milliseconds when the event was emitted.
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
 * - Message has been sanitized to avoid token leakage.
 *
 * Data/auth references:
 * - Errors are sanitized to suppress token-like strings.
 *
 * @example
 * { context: "SendPaymentCard submit failed", message: "Transfer failed.", kind: "error", timestamp: 1712345678901 }
 */
export type UIErrorTelemetryEvent = {
  context: string;
  message: string;
  kind: "error";
  timestamp: number;
};

type UIErrorTelemetryHandler = (event: UIErrorTelemetryEvent) => void;

let uiErrorTelemetryHandler: UIErrorTelemetryHandler | null = null;

/**
 * Register an error telemetry handler for SDK UI toasts.
 *
 * @remarks
 * Purpose:
 * - Allow host apps to capture sanitized error events without console output.
 *
 * When to use:
 * - Use to register a handler that receives sanitized UI error events.
 *
 * When not to use:
 * - Do not register handlers that log sensitive data or throw.
 *
 * Parameters:
 * - handler: Telemetry callback invoked for SDK UI errors. Pass null to clear.
 *
 * Return semantics:
 * - Returns void after updating the handler.
 *
 * Errors/failure modes:
 * - None; does not throw.
 *
 * Side effects:
 * - Stores the handler in module scope for later toast/error events.
 *
 * Invariants/assumptions:
 * - Handler must be idempotent and fast; errors are not swallowed.
 *
 * Data/auth references:
 * - Receives sanitized messages only (no tokens).
 *
 * @example
 * setUIErrorTelemetryHandler((evt) => track("sdk_error", evt));
 */
export function setUIErrorTelemetryHandler(
  handler: UIErrorTelemetryHandler | null,
): void {
  uiErrorTelemetryHandler = handler;
}

/**
 * Create an adapter that forwards UI error telemetry into SDKTelemetry.
 *
 * @remarks
 * Purpose:
 * - Bridge sanitized UI errors into the existing SDK telemetry pipeline.
 *
 * When to use:
 * - Use when you already provide SDKTelemetry and want UI error events.
 *
 * When not to use:
 * - Do not use when telemetry is not configured (returns null).
 *
 * Parameters:
 * - telemetry: SDK telemetry hooks from the host app (object | null | undefined, optional).
 * - opts: Optional overrides for synthetic telemetry fields.
 *   - url: Synthetic URL identifier (string, optional, default: "ui://error").
 *   - method: Synthetic method identifier (string, optional, default: "UI").
 *
 * Return semantics:
 * - Returns a UI error handler when telemetry is provided.
 * - Returns null when telemetry is missing or does not define `onRequestError`.
 *
 * Errors/failure modes:
 * - None; does not throw.
 *
 * Side effects:
 * - None; returned handler invokes `telemetry.onRequestError` when called.
 *
 * Invariants/assumptions:
 * - Uses sanitized UI error messages only.
 * - Synthetic telemetry fields are not real HTTP endpoints.
 *
 * Data/auth references:
 * - No auth data is emitted; messages are sanitized to avoid token leakage.
 *
 * @example
 * const handler = createUIErrorTelemetryAdapter(telemetry);
 * setUIErrorTelemetryHandler(handler);
 *
 * @see setUIErrorTelemetryHandler
 */
export const createUIErrorTelemetryAdapter = (
  telemetry?: SDKTelemetry | null,
  opts?: { url?: string; method?: string },
): UIErrorTelemetryHandler | null => {
  if (!telemetry?.onRequestError) return null;
  const url = opts?.url ?? "ui://error";
  const method = opts?.method ?? "UI";

  return (event) => {
    const requestId = generateRequestId();
    const meta = { requestId, url, method };
    const error = new SDKError(
      event.message,
      "unknown",
      undefined,
      {
        kind: "ui_error",
        context: event.context,
      },
      meta,
    );
    telemetry.onRequestError?.({
      requestId,
      url,
      method,
      startedAt: event.timestamp,
      durationMs: 0,
      error,
    });
  };
};

const emitErrorTelemetry = (context: string, message: string): void => {
  if (!uiErrorTelemetryHandler) return;
  uiErrorTelemetryHandler({
    context,
    message,
    kind: "error",
    timestamp: Date.now(),
  });
};

/**
 * Derive a safe, user-facing message from an unknown error.
 *
 * @remarks
 * Purpose:
 * - Convert opaque errors into user-friendly strings.
 * - Suppress technical or token-like details in UI messaging.
 *
 * When to use:
 * - Use when converting errors to safe UI messages.
 *
 * When not to use:
 * - Do not use when you need full error details for debugging.
 *
 * Parameters:
 * - err: Unknown error value (unknown, required).
 * - fallback: Default message used when the error is technical or empty (string, required).
 *
 * Return semantics:
 * - Returns a sanitized message string.
 * - Returns `fallback` when the message is missing or sensitive.
 *
 * Errors/failure modes:
 * - None; never throws.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Does not mutate the input error object.
 *
 * Data/auth references:
 * - Treats token-like strings and bearer prefixes as sensitive.
 *
 * @example
 * getUserFriendlyErrorMessage(err, "Something went wrong.")
 */
export function getUserFriendlyErrorMessage(err: UnknownError, fallback: string) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (err as any)?.message;

  if (!message || typeof message !== "string") return fallback;

  const m = message.trim();

  // Hide technical/noisy messages behind a friendly fallback.
  const technical =
    /^(authorization failed|user verification failed|fetch failed|networkerror|typeerror:|tx_|http\s?\d{3}|internal server error|invalid response|unexpected token)/i.test(
      m,
    ) ||
    /(bearer\s+[a-z0-9\-_.=]+|access_token|authorization_token|operation_token|refresh_token)/i.test(
      m,
    ) ||
    /eyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}/i.test(m) ||
    /0x[a-f0-9]{16,}/i.test(m);

  if (technical) return fallback;

  // Strip common SDK prefixes that aren’t helpful to end users.
  return m
    .replace(/^authorization failed:\s*/i, "")
    .replace(/^user verification failed:\s*/i, "")
    .replace(/^token approval failed:\s*/i, "Token approval failed. ")
    .trim();
}

/**
 * Record an error event without emitting console output.
 *
 * @remarks
 * Purpose:
 * - Provide a stable hook for callers that want to invoke error handling.
 * - Avoid leaking sensitive error details to the console.
 *
 * When to use:
 * - Use when you want to record errors without showing UI toasts.
 *
 * When not to use:
 * - Do not use to suppress critical errors that need user visibility.
 *
 * Parameters:
 * - context: Short label describing the error source (string, required).
 * - err: Unknown error value (unknown, required).
 * - extra: Optional metadata for caller-side handling (object, optional).
 *
 * Return semantics:
 * - Returns void; no output is produced.
 *
 * Errors/failure modes:
 * - None; never throws.
 *
 * Side effects:
 * - Emits a sanitized error telemetry event when a handler is registered.
 *
 * Invariants/assumptions:
 * - Sanitization is handled by toast helpers before rendering.
 *
 * Data/auth references:
 * - This helper does not emit auth or token data.
 *
 * @example
 * logError("Session refresh failed", err);
 */
export function logError(context: string, err: UnknownError, extra?: Record<string, unknown>) {
  const safeMessage = getUserFriendlyErrorMessage(
    err,
    "An unexpected error occurred.",
  );
  emitErrorTelemetry(context, safeMessage);
  void extra;
}

/**
 * Show a sanitized error toast.
 *
 * @remarks
 * Purpose:
 * - Render a user-safe error message via the toast system.
 *
 * When to use:
 * - Use when showing error notifications to users.
 *
 * When not to use:
 * - Do not use for silent/background errors.
 *
 * Parameters:
 * - context: Short label describing the failure (string, required).
 * - err: Unknown error value (unknown, required).
 * - fallback: Default message when the error is technical (string, required).
 *
 * Return semantics:
 * - Returns void after enqueuing a toast.
 *
 * Errors/failure modes:
 * - None; never throws.
 *
 * Side effects:
 * - Emits a toast notification.
 * - Emits a sanitized error telemetry event when a handler is registered.
 *
 * Invariants/assumptions:
 * - Error messages are sanitized before display.
 *
 * Data/auth references:
 * - Suppresses token-like strings in user-visible output.
 *
 * @example
 * toastError("Send failed", err, "Transfer failed. Please try again.");
 */
export function toastError(context: string, err: UnknownError, fallback: string) {
  const safeMessage = getUserFriendlyErrorMessage(err, fallback);
  emitErrorTelemetry(context, safeMessage);
  toast.error(safeMessage);
}

/**
 * Show a success toast.
 *
 * @remarks
 * Purpose:
 * - Provide a consistent success message surface.
 *
 * When to use:
 * - Use after successful user actions.
 *
 * When not to use:
 * - Do not use for background or noisy events.
 *
 * Parameters:
 * - message: Message to display (string, required).
 *
 * Return semantics:
 * - Returns void after enqueuing a toast.
 *
 * Errors/failure modes:
 * - None; never throws.
 *
 * Side effects:
 * - Emits a toast notification.
 *
 * Invariants/assumptions:
 * - Message is safe for user display.
 *
 * Data/auth references:
 * - None.
 *
 * @example
 * toastSuccess("Saved");
 */
export function toastSuccess(message: string) {
  toast.success(message);
}

/**
 * Show an informational toast.
 *
 * @remarks
 * Purpose:
 * - Provide a lightweight info message surface.
 *
 * When to use:
 * - Use for neutral status updates (loading, tips).
 *
 * When not to use:
 * - Do not use for errors or success notifications.
 *
 * Parameters:
 * - message: Message to display (string, required).
 *
 * Return semantics:
 * - Returns void after enqueuing a toast.
 *
 * Errors/failure modes:
 * - None; never throws.
 *
 * Side effects:
 * - Emits a toast notification.
 *
 * Invariants/assumptions:
 * - Message is safe for user display.
 *
 * Data/auth references:
 * - None.
 *
 * @example
 * toastInfo("Loading...");
 */
export function toastInfo(message: string) {
  toast(message);
}

/**
 * Small helper for components that accept an `onToast` override.
 *
 * @remarks
 * Purpose:
 * - Provide a unified toast entrypoint with optional override hooks.
 *
 * When to use:
 * - Use when components accept an onToast override callback.
 *
 * When not to use:
 * - Do not use when you want full control over toast rendering.
 *
 * Parameters:
 * - kind: Toast kind ("success" | "error" | "info", required).
 * - message: Default message string (string, required).
 * - opts: Optional overrides for custom toasts and error context.
 *   - onToast: Optional callback to render custom toasts.
 *   - error: Optional error value to sanitize.
 *   - context: Optional error context label.
 *   - fallbackForError: Optional fallback when the error is technical.
 *
 * Return semantics:
 * - Returns void; uses `onToast` when provided, otherwise Sonner.
 *
 * Errors/failure modes:
 * - None; never throws.
 *
 * Side effects:
 * - Emits toast notifications.
 * - Emits a sanitized error telemetry event when `kind` is "error".
 *
 * Invariants/assumptions:
 * - Error messages are sanitized before display.
 *
 * Data/auth references:
 * - Suppresses token-like strings in user-visible output.
 *
 * @example
 * notify("success", "Saved");
 */
export function notify(
  kind: ToastKind,
  message: string,
  opts?: {
    onToast?: (type: ToastKind, message: string) => void;
    error?: UnknownError;
    context?: string;
    fallbackForError?: string;
  },
) {
  const { onToast, error, context, fallbackForError } = opts ?? {};

  if (kind === "error") {
    const safeMessage = error
      ? getUserFriendlyErrorMessage(error, fallbackForError ?? message)
      : getUserFriendlyErrorMessage(
          new Error(message),
          "An unexpected error occurred.",
        );
    emitErrorTelemetry(context ?? "error", safeMessage);
    message = safeMessage;
  }

  if (onToast) {
    onToast(kind, message);
    return;
  }

  if (kind === "success") toast.success(message);
  else if (kind === "error") toast.error(message);
  else toast(message);
}
