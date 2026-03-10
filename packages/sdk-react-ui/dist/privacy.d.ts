type PrivacyHandlerOptions = {
    /** OAuth base URL for the tenant auth domain (used to open the storage access helper). */
    baseUrl: string;
    /** Optional toast override. When omitted, sonner toasts are used. */
    onToast?: (type: "error", message: string, options?: {
        actionLabel?: string;
        actionUrl?: string;
    }) => void;
    /** Debounce window in ms to avoid repeated toasts. */
    debounceMs?: number;
};
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
export declare function installPrivacyErrorHandler(options: PrivacyHandlerOptions): () => void;
export {};
