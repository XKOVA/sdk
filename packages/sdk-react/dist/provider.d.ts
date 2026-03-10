import React, { PropsWithChildren, ReactNode } from "react";
import { APIClient, OAuthService, OAuthServiceOptions, AuthStorage, AuthState, BootstrapPayload, IeeOrchestrator } from "@xkova/sdk-core";
import type { SDKTelemetry } from "@xkova/sdk-core/telemetry";
type AuthChangeHandler = (state: AuthState) => void;
type SessionStatus = "unknown" | "valid" | "invalid";
/**
 * Real-time connection state for SDK resource invalidation.
 *
 * @remarks
 * Contract:
 * - Transport: Socket.IO namespace `${apiHost}/notifications`.
 * - Payload model: invalidate-only events; data hooks refetch after invalidation.
 * - Ownership: `XKOVAProvider` is the canonical transport-to-resource mapper.
 * - Consumer apps must consume hooks/resources and must not duplicate this socket mapping.
 */
export type RealtimeStatus = {
    status: "disabled" | "connecting" | "connected" | "disconnected" | "error";
    lastConnectedAt: number | null;
    lastDisconnectedAt: number | null;
    lastError: string | null;
};
/**
 * Convenience factory for in-memory SDK storage.
 *
 * @remarks
 * Purpose:
 * - Provide memory-only AuthStorage for app-session/BFF patterns.
 *
 * When to use:
 * - Use when tokens should not persist across reloads (server or short-lived sessions).
 *
 * When not to use:
 * - Do not use if you need persistent browser storage; provide a persistent adapter instead.
 *
 * Parameters:
 * - `prefix`: Optional key prefix for storage namespacing. Nullable: yes.
 * - `tenantId`: Optional tenant ID for storage namespacing. Nullable: yes.
 *
 * Return semantics:
 * - Returns AuthStorage backed by MemoryStorage.
 *
 * Errors/failure modes:
 * - Captures fetch errors in `error` and returns an empty balance list.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Storage is reset on reload; tokens are not persisted in the browser.
 *
 * Data/auth references:
 * - Stores OAuth tokens in memory only.
 */
export declare const createDefaultStorage: (prefix?: string, tenantId?: string) => AuthStorage;
interface SDKContextValue {
    state: AuthState;
    bootstrap: BootstrapPayload | null;
    oauth: OAuthService;
    apiClient: APIClient;
    authClient: APIClient;
    /** IEE (SafeApprove) orchestrator for receipt-safe write operations. */
    iee: IeeOrchestrator;
    /** API base host for app API and RPC proxy usage (host-only). */
    apiBaseUrl: string | undefined;
    /** Optional SDK telemetry hooks passed from provider configuration. */
    telemetry?: SDKTelemetry;
    /** Session validation status derived from the app session endpoint. */
    sessionStatus: SessionStatus;
    /** Last session validation timestamp (ms since epoch) or null if never checked. */
    lastSessionCheck: number | null;
    /** Real-time connection status for SDK invalidation. */
    realtime: RealtimeStatus;
    /**
     * Provider-agnostic access token getter.
     * - Fetches short-lived access tokens from the app session endpoint (cookie-authenticated).
     */
    getAccessToken: (forceRefresh?: boolean) => Promise<string | null>;
    refreshTokens: () => Promise<void>;
    reloadBootstrap: () => Promise<BootstrapPayload | null>;
    logout: () => Promise<void>;
    /**
     * Optional app-owned session endpoints.
     * When present, UI components can route auth through the application's own endpoints.
     */
    appSession?: {
        /** App-owned login start URL (usually `GET /auth/login`). */
        loginUrl: string;
        /** App-owned token endpoint (usually `POST /api/token`). */
        tokenEndpoint: string;
        /** App-owned logout endpoint (usually `POST /api/logout`). */
        logoutEndpoint: string;
        /** App-owned session validation endpoint (usually `GET /api/auth/session`). */
        sessionEndpoint: string;
    };
}
/**
 * Props for {@link XKOVAProvider}.
 *
 * @remarks
 * Purpose:
 * - Configure the SDK React provider for OAuth and API access.
 *
 * When to use:
 * - Use when wrapping a React app that uses sdk-react hooks.
 *
 * When not to use:
 * - Do not use outside React; use OAuthService directly in non-React environments.
 *
 * Parameters:
 * - `children`: React children rendered within the provider. Nullable: no.
 * - `baseUrl`: OAuth protocol host (origin). Nullable: yes (required via env or prop).
 * - `clientId`: OAuth client id for the app. Nullable: yes.
 * - `fetch`: Optional fetch override. Nullable: yes.
 * - `timeoutMs`: Optional request timeout budget. Nullable: yes.
 * - `attemptTimeoutMs`: Optional per-attempt timeout. Nullable: yes.
 * - `retry`: Optional retry policy. Nullable: yes.
 * - `telemetry`: Optional SDK telemetry hooks. Nullable: yes.
 * - `apiBaseUrl`: Optional API base host override. Nullable: yes.
 * - `onAuthChange`: Optional auth state callback. Nullable: yes.
 * - `environment`: Optional environment override. Nullable: yes.
 * - `tenantId`: Optional tenant ID for storage scoping. Nullable: yes.
 * - `debug`: Optional debug flag. Nullable: yes.
 * - `onError`: Optional error callback. Nullable: yes.
 * - `appLoginUrl`: Optional app-owned login URL. Nullable: yes.
 * - `appTokenEndpoint`: Optional app-owned token endpoint. Nullable: yes.
 * - `appLogoutEndpoint`: Optional app-owned logout endpoint. Nullable: yes.
 * - `appSessionEndpoint`: Optional app-owned session validation endpoint (default `/api/auth/session`). Nullable: yes.
 *
 * Return semantics:
 * - Props interface only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None at the type level; runtime errors are thrown by XKOVAProvider.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - baseUrl must resolve to the OAuth protocol host.
 *
 * Data/auth references:
 * - Controls access to OAuth tokens and apps/api requests.
 */
export interface XKOVAProviderProps extends Partial<OAuthServiceOptions> {
    children: ReactNode;
    onAuthChange?: AuthChangeHandler;
    /**
     * @internal Override for API base host. For internal/testing use only.
     * Accepts host-only URLs; `/api` or `/api/v{n}` suffixes are normalized away.
     */
    apiBaseUrl?: string;
    environment?: "test" | "production" | "auto";
    tenantId?: string;
    debug?: boolean;
    onError?: (error: Error) => void;
    /**
     * App-owned login start URL (usually `GET /auth/login`).
     * The SDK UI components will redirect here to start auth.
     */
    appLoginUrl?: string;
    /**
     * App-owned token endpoint (usually `POST /api/token`).
     * Must return `{ access_token, expires_in, token_type, scope }`.
     */
    appTokenEndpoint?: string;
    /**
     * App-owned logout endpoint (usually `POST /api/logout`).
     */
    appLogoutEndpoint?: string;
    /**
     * App-owned session validation endpoint (usually `GET /api/auth/session`).
     * The SDK always calls this endpoint to validate session health; apps must implement it.
     */
    appSessionEndpoint?: string;
    /**
     * When true, disable auto-launching the IEE (SafeApprove) modal and require explicit receipts.
     */
    requireExplicitReceipt?: boolean;
    /**
     * Enable real-time SDK invalidation via WebSockets (Socket.IO).
     * When disabled, hooks should rely on manual refetch or polling.
     */
    enableRealtime?: boolean;
}
/**
 * Default provider (app-owned session pattern) for third-party web apps.
 *
 * @remarks
 * Purpose:
 * - Provide React context with OAuth + API clients using app-owned sessions.
 *
 * When to use:
 * - Use in React apps that manage OAuth server-side and expose a token endpoint.
 *
 * When not to use:
 * - Do not use if your app cannot expose a secure token endpoint for the browser.
 *
 * Parameters:
 * - `props`: XKOVAProviderProps. Nullable: no.
 *
 * Return semantics:
 * - Returns a React element that provides SDK context to descendants.
 *
 * Errors/failure modes:
 * - Throws when baseUrl is missing or token responses are malformed.
 *
 * Side effects:
 * - Fetches session tokens and bootstrap data; updates React state.
 *
 * Invariants/assumptions:
 * - OAuth authorize + code exchange happen server-side in your app.
 * - Browser fetches short-lived access tokens from the app (cookie-authenticated).
 * - SDK uses those access tokens to call oauth-server + api-server with Bearer auth (no cookies).
 * - Session validity is checked via the app session endpoint on an interval and focus/visibility changes.
 *
 * Data/auth references:
 * - Uses OAuth bootstrap endpoints and app-owned session/token endpoints.
 */
export declare const XKOVAProvider: ({ children, baseUrl, clientId, fetch: fetchOverride, timeoutMs, attemptTimeoutMs, retry, telemetry, apiBaseUrl, onAuthChange, environment, tenantId, onError, appLoginUrl, appTokenEndpoint, appLogoutEndpoint, appSessionEndpoint, requireExplicitReceipt, enableRealtime, }: PropsWithChildren<XKOVAProviderProps>) => React.FunctionComponentElement<React.ProviderProps<SDKContextValue | null>>;
/**
 * Access the SDK React context.
 *
 * @remarks
 * Purpose:
 * - Expose AuthState, OAuthService, API clients, and helpers from XKOVAProvider.
 *
 * When to use:
 * - Use inside React components that need direct access to SDK context.
 *
 * When not to use:
 * - Do not call outside XKOVAProvider; this hook throws.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns SDKContextValue with auth state, clients, and helper methods.
 *
 * Errors/failure modes:
 * - Throws Error when XKOVAProvider is missing from the React tree.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Requires XKOVAProvider to be mounted above in the tree.
 *
 * Data/auth references:
 * - Provides access to OAuthService, APIClient instances, and token helpers.
 */
export declare const useSDK: () => SDKContextValue;
/**
 * Convenience hook to fetch IEE (SafeApprove)-relevant identity context.
 *
 * @remarks
 * Purpose:
 * - Provide tenant/user identifiers and client/scope hints for IEE (SafeApprove) payloads without re-reading the SDK state tree.
 *
 * When to use:
 * - Use before issuing IEE (SafeApprove) prep tickets or calling receipt-gated endpoints.
 *
 * When not to use:
 * - Do not call outside a mounted XKOVAProvider (throws via useSDK).
 *
 * Return semantics:
 * - Returns normalized ids (or null when unavailable) and scope/email for logging or payload construction.
 */
export declare const useIeeContext: () => {
    tenantId: string | null;
    clientId: string | null;
    userId: string | null;
    userEmail: string | null;
    scope: string | null;
};
export {};
