"use client";

import type { SDKTelemetryError } from "@xkova/sdk-core/telemetry";
import { toast } from "sonner";

type PrivacyHandlerOptions = {
  /** OAuth base URL for the tenant auth domain (used to open the storage access helper). */
  baseUrl: string;
  /** Optional toast override. When omitted, sonner toasts are used. */
  onToast?: (type: "error", message: string, options?: { actionLabel?: string; actionUrl?: string }) => void;
  /** Debounce window in ms to avoid repeated toasts. */
  debounceMs?: number;
};

let installed = false;

const PRIVACY_ERROR_SNIPPET = "browser privacy settings prevented authentication";

const isPrivacyError = (message?: string | null) =>
  typeof message === "string" && message.toLowerCase().includes(PRIVACY_ERROR_SNIPPET);

/**
 * Install a global handler that surfaces IEE cookie/privacy errors with a help action.
 *
 * @remarks
 * Purpose:
 * - Show a consistent, user-friendly message when browser privacy settings block IEE auth.
 * - Provide a one-click helper to establish storage access.
 *
 * When to use:
 * - Call once in your app provider on the client.
 *
 * When not to use:
 * - Do not call on the server (relies on `window`).
 *
 * Side effects:
 * - Registers `xkova-sdk-telemetry` and `unhandledrejection` listeners.
 *
 * Data/auth references:
 * - Reads SDK telemetry error messages and uses the tenant auth base URL.
 */
export function installPrivacyErrorHandler(options: PrivacyHandlerOptions): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (installed) return () => undefined;
  installed = true;

  const debounceMs = options.debounceMs ?? 10_000;
  let lastToastAt = 0;

  const helperUrl = `${options.baseUrl.replace(/\/+$/, "")}/iee/storage-access-helper?origin=${encodeURIComponent(
    window.location.origin,
  )}`;

  const showToast = () => {
    const now = Date.now();
    if (now - lastToastAt < debounceMs) return;
    lastToastAt = now;

    if (options.onToast) {
      options.onToast("error", "Browser privacy settings prevented authentication.", {
        actionLabel: "Open helper",
        actionUrl: helperUrl,
      });
      return;
    }

    toast.error("Browser privacy settings prevented authentication.", {
      description:
        "Allow cookies for this site, use a non-incognito window, or try a different browser. If prompted, click Allow for cookie access.",
      action: {
        label: "Open helper",
        onClick: () => window.open(helperUrl, "_blank", "noopener,noreferrer"),
      },
      duration: 12000,
    });
  };

  const handleTelemetry = (event: Event) => {
    const detail = (event as CustomEvent).detail as SDKTelemetryError | undefined;
    const message = (detail as any)?.error?.message as string | undefined;
    if (isPrivacyError(message)) {
      showToast();
    }
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason as any;
    const message = reason?.message ?? (typeof reason === "string" ? reason : null);
    if (isPrivacyError(message)) {
      showToast();
    }
  };

  window.addEventListener("xkova-sdk-telemetry", handleTelemetry);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("xkova-sdk-telemetry", handleTelemetry);
    window.removeEventListener("unhandledrejection", handleRejection);
    installed = false;
  };
}
