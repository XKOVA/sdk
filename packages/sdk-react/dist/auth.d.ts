import { type AuthState, type UserInfo } from "@xkova/sdk-core";
/**
 * Read auth state and SDK environment metadata.
 *
 * @remarks
 * Purpose:
 * - Provide auth status, user, tokens, and helper actions for UI.
 * - Expose environment info derived from the OAuth base URL.
 *
 * When to use:
 * - Use when components need auth state, logout, or token refresh helpers.
 *
 * When not to use:
 * - Do not use outside XKOVAProvider; prefer useSDK only when you need low-level clients.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns auth state plus `refreshTokens`, `logout`, `isLoading`, `environment`,
 *   `sessionStatus`, and `lastSessionCheck`.
 * - `environment` is null until the SDK context is available; when present it includes:
 *   { mode, isLocalhost, isTest, isProduction, authDomain }.
 * - `sessionStatus` is one of `unknown`, `valid`, or `invalid`.
 * - `lastSessionCheck` is a millisecond timestamp or null when never checked.
 *
 * Errors/failure modes:
 * - Throws when used outside <XKOVAProvider> (via useSDK).
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Requires an SDK provider in the React tree.
 *
 * Data/auth references:
 * - Uses the OAuth base URL from SDK state; no direct network calls.
 * - Session status is derived from the provider's app session monitor.
 *
 * @example
 * const { user, isLoading, environment } = useAuth();
 *
 * @see useSDK
 */
export declare const useAuth: () => {
    user: UserInfo | null;
    refreshTokens: () => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    environment: {
        mode: "test" | "production";
        isLocalhost: boolean;
        isTest: boolean;
        isProduction: boolean;
        authDomain: string;
    } | null;
    sessionStatus: "unknown" | "valid" | "invalid";
    lastSessionCheck: number | null;
    status: "loading" | "authenticated" | "unauthenticated" | "error";
    tokens: import("@xkova/sdk-core").TokenSet | null;
    tenant: import("@xkova/sdk-core").TenantConfig | null;
    accountState: import("@xkova/sdk-core").AccountState | null;
    error?: Error;
};
/**
 * Options for {@link useHumanAuth}.
 *
 * @remarks
 * Purpose:
 * - Configure error handling for the human auth hook.
 *
 * When to use:
 * - Use when you want to capture auth errors without throwing to the UI.
 *
 * When not to use:
 * - Do not rely on this for logging sensitive data.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns null balance.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `onError` is invoked with Error instances when available.
 *
 * Data/auth references:
 * - Applies to OAuth session validation.
 */
export interface HumanAuthOptions {
    onError?: (err: Error) => void;
}
/**
 * State returned by {@link useHumanAuth}.
 *
 * @remarks
 * Purpose:
 * - Describe current auth status and convenience actions for human flows.
 *
 * When to use:
 * - Use for UI that needs a human-friendly auth status summary.
 *
 * When not to use:
 * - Do not use in agent or service contexts.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns an empty balance list.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `status` maps to SDK auth state.
 *
 * Data/auth references:
 * - Derived from SDK auth state and user profile data.
 */
export interface HumanAuthState {
    status: AuthState["status"];
    user: UserInfo | null;
    displayName: string | undefined;
    handleClick: () => Promise<void>;
    handleLogout: () => Promise<void>;
}
/**
 * Headless auth handler for Human UI triggers.
 *
 * @remarks
 * Purpose:
 * - Provide click/logout handlers and display name for auth UI surfaces.
 *
 * When to use:
 * - Use when wiring Human UI buttons that toggle login/logout behavior.
 *
 * When not to use:
 * - Do not use on the server; this hook uses window.location redirects.
 *
 * Parameters:
 * - `options.onError`: Optional error callback. Nullable: yes.
 *
 * Return semantics:
 * - Returns auth status, user, displayName, and handler functions.
 *
 * Errors/failure modes:
 * - Handler errors are caught and forwarded to `options.onError`.
 * - Throws if called during server-side rendering when a redirect is attempted.
 *
 * Side effects:
 * - Redirects to the app-owned login endpoint for BFF authentication.
 *
 * Invariants/assumptions:
 * - Requires an SDK provider with appSession login URL configured.
 *
 * Data/auth references:
 * - App-owned login endpoint (e.g. `/auth/login`).
 *
 * @example
 * const { handleClick, displayName } = useHumanAuth({ tenantSlug });
 *
 * @see useAuth
 */
export declare const useHumanAuth: (options?: HumanAuthOptions) => HumanAuthState;
