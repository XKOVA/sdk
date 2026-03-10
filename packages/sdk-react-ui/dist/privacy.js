"use client";
import { toast } from "sonner";
let installed = false;
const PRIVACY_ERROR_SNIPPET = "browser privacy settings prevented authentication";
const isPrivacyError = (message) => typeof message === "string" && message.toLowerCase().includes(PRIVACY_ERROR_SNIPPET);
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
export function installPrivacyErrorHandler(options) {
    if (typeof window === "undefined")
        return () => undefined;
    if (installed)
        return () => undefined;
    installed = true;
    const debounceMs = options.debounceMs ?? 10000;
    let lastToastAt = 0;
    const helperUrl = `${options.baseUrl.replace(/\/+$/, "")}/iee/storage-access-helper?origin=${encodeURIComponent(window.location.origin)}`;
    const showToast = () => {
        const now = Date.now();
        if (now - lastToastAt < debounceMs)
            return;
        lastToastAt = now;
        if (options.onToast) {
            options.onToast("error", "Browser privacy settings prevented authentication.", {
                actionLabel: "Open helper",
                actionUrl: helperUrl,
            });
            return;
        }
        toast.error("Browser privacy settings prevented authentication.", {
            description: "Allow cookies for this site, use a non-incognito window, or try a different browser. If prompted, click Allow for cookie access.",
            action: {
                label: "Open helper",
                onClick: () => window.open(helperUrl, "_blank", "noopener,noreferrer"),
            },
            duration: 12000,
        });
    };
    const handleTelemetry = (event) => {
        const detail = event.detail;
        const message = detail?.error?.message;
        if (isPrivacyError(message)) {
            showToast();
        }
    };
    const handleRejection = (event) => {
        const reason = event.reason;
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
