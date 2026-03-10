import { useCallback, useMemo } from "react";
import { ValidationError } from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { useCachedAvatarUrl } from "./avatar-cache.js";
import { useCachedProxyAvatarUrl } from "./avatar-proxy-cache.js";
const isLocalhost = () => {
    if (typeof window === "undefined")
        return false;
    const host = window.location.hostname;
    return (host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1");
};
const isLocalhostHostname = (hostname) => {
    const lower = hostname.toLowerCase();
    return (lower === "localhost" ||
        lower === "127.0.0.1" ||
        lower === "::1" ||
        lower.endsWith(".localhost"));
};
// Local environment detection to avoid exporting internal oauth helpers.
const normalizeOAuthBaseUrl = (input) => {
    if (!input) {
        throw new ValidationError("baseUrl is required");
    }
    let url;
    try {
        url = new URL(input);
    }
    catch {
        throw new ValidationError("baseUrl must be a valid absolute URL");
    }
    const trimmedPath = url.pathname.replace(/\/+$/, "");
    const withoutOauth = trimmedPath.endsWith("/oauth")
        ? trimmedPath.slice(0, -"/oauth".length)
        : trimmedPath;
    if (withoutOauth && withoutOauth !== "/") {
        throw new ValidationError("baseUrl must point to the OAuth protocol host (origin only)");
    }
    const hostname = url.hostname.toLowerCase();
    if (!isLocalhostHostname(hostname) &&
        !hostname.startsWith("oauth") &&
        !hostname.startsWith("auth")) {
        throw new ValidationError("baseUrl must be the OAuth protocol host (AUTH_SERVER_URL), not a tenant auth domain");
    }
    return `${url.protocol}//${url.host}`;
};
const shouldUseDevMode = (config) => {
    if (config.environment === "test")
        return true;
    if (config.environment === "production")
        return false;
    const normalized = normalizeOAuthBaseUrl(config.baseUrl);
    const hostname = new URL(normalized).hostname.toLowerCase();
    if (isLocalhostHostname(hostname))
        return true;
    return normalized.includes("-test.");
};
const detectEnvironment = (baseUrl) => {
    return shouldUseDevMode({ baseUrl, environment: "auto" })
        ? "test"
        : "production";
};
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
export const useAuth = () => {
    const { state, refreshTokens, logout, oauth, sessionStatus, lastSessionCheck } = useSDK();
    const rawAvatarUrl = state.user?.avatarUrl ?? null;
    const shouldUseProxy = typeof rawAvatarUrl === "string" &&
        /\/api\/v1\/users\/[^/]+\/avatar/.test(rawAvatarUrl);
    const cachedProxyAvatarUrl = useCachedProxyAvatarUrl(shouldUseProxy ? rawAvatarUrl : null);
    const cachedAvatarUrl = useCachedAvatarUrl(state.user);
    const resolvedAvatarUrl = shouldUseProxy
        ? cachedProxyAvatarUrl ?? null
        : cachedAvatarUrl ?? rawAvatarUrl ?? null;
    const userWithCachedAvatar = useMemo(() => {
        if (!state.user)
            return null;
        if (!resolvedAvatarUrl) {
            if (shouldUseProxy) {
                return { ...state.user, avatarUrl: null };
            }
            return state.user;
        }
        if (state.user.avatarUrl === resolvedAvatarUrl)
            return state.user;
        return { ...state.user, avatarUrl: resolvedAvatarUrl };
    }, [resolvedAvatarUrl, shouldUseProxy, state.user]);
    const environment = useMemo(() => {
        if (!oauth)
            return null;
        const baseUrl = oauth.getBaseUrl();
        const mode = detectEnvironment(baseUrl);
        return {
            mode,
            isLocalhost: isLocalhost(),
            isTest: mode === "test",
            isProduction: mode === "production",
            authDomain: baseUrl
        };
    }, [oauth]);
    return {
        ...state,
        user: userWithCachedAvatar,
        refreshTokens,
        logout,
        isLoading: state.status === "loading",
        environment,
        sessionStatus,
        lastSessionCheck
    };
};
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
export const useHumanAuth = (options) => {
    const { appSession } = useSDK();
    const { status, user, logout } = useAuth();
    const onError = options?.onError;
    const displayName = useMemo(() => {
        const full = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
        if (full)
            return full;
        const email = user?.email;
        if (email && email.includes("@"))
            return email.split("@")[0];
        return email || user?.id;
    }, [user]);
    const handleLogout = useCallback(async () => {
        try {
            await logout();
        }
        catch (err) {
            onError?.(err);
        }
    }, [logout, onError]);
    const handleClick = useCallback(async () => {
        try {
            if (status === "authenticated") {
                await handleLogout();
                return;
            }
            if (!appSession?.loginUrl) {
                throw new Error("XKOVAProvider requires appLoginUrl for BFF sign-in.");
            }
            if (typeof window !== "undefined") {
                window.location.assign(appSession.loginUrl);
            }
            else {
                throw new Error("Cannot redirect during server-side rendering. Use client-side navigation.");
            }
        }
        catch (err) {
            onError?.(err);
        }
    }, [
        status,
        handleLogout,
        appSession?.loginUrl,
        onError
    ]);
    return { status, user, displayName, handleClick, handleLogout };
};
