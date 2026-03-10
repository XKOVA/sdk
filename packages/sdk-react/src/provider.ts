import React, {
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  APIClient,
  OAuthService,
  OAuthServiceOptions,
  AuthStorage,
  MemoryStorage,
  AuthState,
  BootstrapPayload,
  TokenSet,
  API_BASE_URL,
  API_VERSION,
  ValidationError,
  IeeService,
  IeeOrchestrator,
  type IeeReceiptProvider
} from "@xkova/sdk-core";
import type { SDKTelemetry } from "@xkova/sdk-core/telemetry";
import { launchIee } from "@xkova/sdk-browser";
import { io, type Socket } from "socket.io-client";
import { normalizeTenantAuthBaseUrl } from "./shared.js";
import { invalidateSDKResource } from "./resources.js";
import { ensureFreshTokenWithDedupe } from "./token-refresh.js";

type AuthChangeHandler = (state: AuthState) => void;

type SessionStatus = "unknown" | "valid" | "invalid";

type SessionCheckSource = "bootstrap" | "interval" | "focus" | "visibility" | "unauthorized";

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

const SESSION_CHECK_INTERVAL_MS = 30_000;

const normalizeApiHost = (value: string): string =>
  value.replace(/\/+$/, "").replace(/\/api(\/v\d+)?$/, "");

const shouldInvalidateBootstrapSession = (error: unknown): boolean => {
  if (!(error instanceof ValidationError)) return false;
  const status = error.meta?.status;
  const url = error.meta?.url ?? "";
  if (status !== 400) return false;
  return url.includes("/oauth/user");
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
export const createDefaultStorage = (prefix?: string, tenantId?: string) =>
  new AuthStorage(new MemoryStorage(), prefix, tenantId);

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

const AuthContext = React.createContext<SDKContextValue | null>(null);

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
export const XKOVAProvider = ({
  children,
  baseUrl,
  clientId,
  fetch: fetchOverride,
  timeoutMs,
  attemptTimeoutMs,
  retry,
  telemetry,
  apiBaseUrl,
  onAuthChange,
  environment = "auto",
  tenantId,
  onError,
  appLoginUrl = "/auth/login",
  appTokenEndpoint = "/api/token",
  appLogoutEndpoint = "/api/logout",
  appSessionEndpoint = "/api/auth/session",
  requireExplicitReceipt = false,
  enableRealtime = true,
}: PropsWithChildren<XKOVAProviderProps>) => {
  const resolvedBaseUrl =
    baseUrl ??
    (typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_XKOVA_BASE_URL as string | undefined) ??
        (process.env.NEXT_PUBLIC_XKOVA_OAUTH_URL as string | undefined) ??
        (process.env.XKOVA_BASE_URL as string | undefined)
      : undefined);

  if (!resolvedBaseUrl) {
    throw new Error(
      "XKOVAProvider requires a baseUrl (set baseUrl prop or NEXT_PUBLIC_XKOVA_BASE_URL/NEXT_PUBLIC_XKOVA_OAUTH_URL/XKOVA_BASE_URL)",
    );
  }

  const fetchImpl = useMemo(
    () =>
      fetchOverride ??
      ((...args: Parameters<typeof globalThis.fetch>) => {
        const f = (globalThis as any).fetch as typeof globalThis.fetch | undefined;
        if (!f) {
          throw new ValidationError("No fetch implementation available");
        }
        return (f as any).apply(globalThis, args as any);
      }),
    [fetchOverride],
  );

  const storage = useMemo(
    () => createDefaultStorage(undefined, tenantId),
    [tenantId],
  );

  const oauth = useMemo(
    () =>
      new OAuthService({
        baseUrl: resolvedBaseUrl,
        clientId,
        fetch: fetchImpl,
        timeoutMs,
        attemptTimeoutMs,
        retry,
        telemetry,
        environment,
        tenantId,
        storage,
      }),
    [
      resolvedBaseUrl,
      clientId,
      fetchImpl,
      timeoutMs,
      attemptTimeoutMs,
      retry,
      telemetry,
      environment,
      tenantId,
      storage,
    ],
  );

  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    tokens: null,
    tenant: null,
    accountState: null,
  });
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("unknown");
  const [lastSessionCheck, setLastSessionCheck] = useState<number | null>(null);
  const [realtime, setRealtime] = useState<RealtimeStatus>({
    status: enableRealtime ? "disconnected" : "disabled",
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastError: null,
  });
  const onChangeRef = useRef<AuthChangeHandler | undefined>(onAuthChange);
  onChangeRef.current = onAuthChange;

  const syncState = useCallback(
    (next: AuthState) => {
      setState(next);
      onChangeRef.current?.(next);
    },
    [setState],
  );

  const tokensRef = useRef<TokenSet | null>(null);
  tokensRef.current = state.tokens;
  const tokenRefreshPromiseRef = useRef<Promise<TokenSet | null> | null>(null);
  const realtimeSocketRef = useRef<Socket | null>(null);

  /**
   * Reset local auth state when the app session is no longer valid.
   *
   * @remarks
   * Purpose:
   * - Centralize cleanup when session validation fails, bootstrap detects missing
   *   embedded Supabase tokens, or 401 retries are exhausted.
   *
   * Parameters:
   * - `source`: Trigger source for invalidation (`bootstrap`, `interval`, `focus`, `visibility`, `unauthorized`). Nullable: no.
   *
   * Return semantics:
   * - Returns void after clearing auth state.
   *
   * Errors/failure modes:
   * - None; this is a best-effort local cleanup.
   *
   * Side effects:
   * - Clears bootstrap, tokens, and updates auth/session state.
   *
   * Invariants/assumptions:
   * - Intended for BFF session invalidation signals.
   *
   * Data/auth references:
   * - No direct network calls; uses in-memory SDK state only.
   */
  const invalidateSession = useCallback(
    (source: SessionCheckSource) => {
      void source;
      setSessionStatus("invalid");
      setLastSessionCheck(Date.now());
      tokenRefreshPromiseRef.current = null;
      tokensRef.current = null;
      setBootstrap(null);
      syncState({
        status: "unauthenticated",
        user: null,
        tokens: null,
        tenant: null,
        accountState: null,
      });
    },
    [syncState],
  );

  /**
   * Validate the app session via the configured session endpoint.
   *
   * @remarks
   * Purpose:
   * - Provide a lightweight yes/no session check without rotating tokens.
   *
   * Parameters:
   * - `source`: Trigger source for the check (`bootstrap`, `interval`, `focus`, `visibility`, `unauthorized`). Nullable: no.
   *
   * Return semantics:
   * - Returns `valid`, `invalid`, or `unknown` based on the session endpoint response.
   *
   * Errors/failure modes:
   * - Returns `unknown` on network failures or non-OK responses (except 401).
   *
   * Side effects:
   * - Updates `sessionStatus`, `lastSessionCheck`, and clears local auth state on invalid sessions.
   *
   * Invariants/assumptions:
   * - The session endpoint is app-owned and returns `{ authenticated: boolean }` or 401.
   *
   * Data/auth references:
   * - Calls the app session validation endpoint with cookies (`credentials: "include"`).
   */
  const validateSession = useCallback(
    async (source: SessionCheckSource): Promise<SessionStatus> => {
      if (typeof window === "undefined") return "unknown";

      const endpoint = appSessionEndpoint.startsWith("http")
        ? appSessionEndpoint
        : `${window.location.origin}${appSessionEndpoint.startsWith("/") ? "" : "/"}${appSessionEndpoint}`;

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        setLastSessionCheck(Date.now());
        setSessionStatus("unknown");
        return "unknown";
      }

      setLastSessionCheck(Date.now());

      if (response.status === 401) {
        invalidateSession(source);
        return "invalid";
      }

      if (!response.ok) {
        setSessionStatus("unknown");
        return "unknown";
      }

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const authenticated =
        typeof payload?.authenticated === "boolean"
          ? payload.authenticated
          : true;

      if (!authenticated) {
        invalidateSession(source);
        return "invalid";
      }

      setSessionStatus("valid");
      return "valid";
    },
    [appSessionEndpoint, fetchImpl, invalidateSession],
  );

  const resolveApiBase = useCallback((): string => {
    if (apiBaseUrl) return normalizeApiHost(apiBaseUrl);

    const envUrl =
      (typeof process !== "undefined" &&
        (process.env.NEXT_PUBLIC_XKOVA_API_URL || process.env.XKOVA_API_URL)) ||
      undefined;
    if (envUrl) {
      if (envUrl.startsWith("http")) return normalizeApiHost(envUrl);
      const lower = envUrl.toLowerCase();
      if (["local", "dev", "beta", "staging"].includes(lower)) {
        return `https://api-${lower}.xkova.com`;
      }
    }

    const env =
      (typeof process !== "undefined" && process.env.XKOVA_ENV?.toLowerCase()) ||
      undefined;
    if (env && ["local", "dev", "beta", "staging"].includes(env)) {
      return `https://api-${env}.xkova.com`;
    }

    return API_BASE_URL;
  }, [apiBaseUrl]);

  const apiHostResolved = useMemo(() => normalizeApiHost(resolveApiBase()), [resolveApiBase]);

  const apiBaseUrlResolved = useMemo(() => {
    return `${apiHostResolved}/api/${API_VERSION}`;
  }, [apiHostResolved]);

  const parseScope = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.filter((item) => typeof item === "string") as string[];
    }
    if (typeof value === "string") {
      return value.split(" ").filter(Boolean);
    }
    return [];
  };

  const fetchAppTokens = useCallback(async (): Promise<TokenSet | null> => {
    if (typeof window === "undefined") return null;

    const url = appTokenEndpoint.startsWith("http")
      ? appTokenEndpoint
      : `${window.location.origin}${appTokenEndpoint.startsWith("/") ? "" : "/"}${appTokenEndpoint}`;

    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      // App-owned session cookie must be sent to the app (same-origin).
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401) {
      return null;
    }

    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      const message =
        payload?.error_description ||
        payload?.error ||
        "Failed to fetch session token from app session endpoint";
      throw new Error(message);
    }

    if (!payload?.access_token || typeof payload.expires_in !== "number") {
      throw new Error("Malformed token response from app session endpoint");
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = nowSec + Number(payload.expires_in);
    const scope = parseScope(payload.scope);

    return {
      accessToken: payload.access_token,
      refreshToken: undefined,
      expiresAt,
      scope,
      tokenType: (payload.token_type ?? "bearer").toLowerCase(),
      idToken: typeof payload.id_token === "string" ? payload.id_token : undefined,
      sessionId:
        typeof payload.session_id === "string" ? payload.session_id : undefined,
    };
  }, [appTokenEndpoint, fetchImpl]);

  const ensureFreshAccessToken = useCallback(
    async (force = false): Promise<TokenSet | null> => {
      return ensureFreshTokenWithDedupe({
        force,
        current: tokensRef.current,
        inFlight: tokenRefreshPromiseRef.current,
        fetchTokens: fetchAppTokens,
        setCurrent: (next) => {
          tokensRef.current = next;
        },
        setInFlight: (next) => {
          tokenRefreshPromiseRef.current = next;
        },
      });
    },
    [fetchAppTokens],
  );

  const getAccessToken = useCallback(
    async (forceRefresh: boolean = false): Promise<string | null> => {
      const tokens = await ensureFreshAccessToken(forceRefresh);
      return tokens?.accessToken ?? null;
    },
    [ensureFreshAccessToken],
  );

  const authApi = useMemo(
    () =>
      new APIClient({
        baseUrl: oauth.getBaseUrl(),
        fetch: fetchImpl,
        timeoutMs,
        attemptTimeoutMs,
        retry,
        telemetry,
        getAccessToken: async () =>
          (await ensureFreshAccessToken())?.accessToken ?? null,
        onUnauthorized: async () => {
          try {
            const next = await ensureFreshAccessToken(true);
            if (!next) {
              invalidateSession("unauthorized");
            }
            return next;
          } catch {
            invalidateSession("unauthorized");
            return null;
          }
        },
      }),
    [
      oauth,
      fetchImpl,
      timeoutMs,
      attemptTimeoutMs,
      retry,
      telemetry,
      ensureFreshAccessToken,
      invalidateSession,
    ],
  );

  const api = useMemo(
    () =>
      new APIClient({
        baseUrl: apiBaseUrlResolved,
        fetch: fetchImpl,
        timeoutMs,
        attemptTimeoutMs,
        retry,
        telemetry,
        getAccessToken: async () =>
          (await ensureFreshAccessToken())?.accessToken ?? null,
        onUnauthorized: async () => {
          try {
            const next = await ensureFreshAccessToken(true);
            if (!next) {
              invalidateSession("unauthorized");
            }
            return next;
          } catch {
            invalidateSession("unauthorized");
            return null;
          }
        },
      }),
    [
      apiBaseUrlResolved,
      fetchImpl,
      timeoutMs,
      attemptTimeoutMs,
      retry,
      telemetry,
      ensureFreshAccessToken,
      invalidateSession,
    ],
  );

  /**
   * Maintain the shared SDK realtime invalidation socket.
   *
   * @remarks
   * Event mapping contract (apps/api -> SDK resource):
   * - `transactions:invalidate` -> `transactions`
   * - `balances:invalidate` -> `balances`
   * - `payment-requests:invalidate` -> `payment-requests`
   * - `agent-installations:invalidate` -> `agent-installations`
   *
   * Extension rule:
   * - New realtime resources must be mapped here and documented in hook/resource JSDoc
   *   in the same change.
   */
  useEffect(() => {
    if (!enableRealtime) {
      if (realtimeSocketRef.current) {
        realtimeSocketRef.current.disconnect();
        realtimeSocketRef.current = null;
      }
      setRealtime((prev) => ({
        status: "disabled",
        lastConnectedAt: prev.lastConnectedAt,
        lastDisconnectedAt: prev.lastDisconnectedAt ?? Date.now(),
        lastError: null,
      }));
      return;
    }

    if (state.status !== "authenticated") {
      if (realtimeSocketRef.current) {
        realtimeSocketRef.current.disconnect();
        realtimeSocketRef.current = null;
      }
      setRealtime((prev) => ({
        status: "disconnected",
        lastConnectedAt: prev.lastConnectedAt,
        lastDisconnectedAt: prev.lastDisconnectedAt ?? Date.now(),
        lastError: null,
      }));
      return;
    }

    let cancelled = false;
    const connect = async () => {
      setRealtime((prev) => ({
        ...prev,
        status: "connecting",
        lastError: null,
      }));
      const token = await getAccessToken();
      if (cancelled) return;
      if (!token) {
        setRealtime((prev) => ({
          ...prev,
          status: "error",
          lastError: "missing_access_token",
        }));
        return;
      }

      if (realtimeSocketRef.current) {
        realtimeSocketRef.current.disconnect();
      }

      type RealtimeConnectVariantName =
        | "namespace_default_path"
        | "root_notifications_path"
        | "namespace_notifications_path";
      const socketAuth = {
        token,
        accessToken: token,
        authorization: `Bearer ${token}`,
      };
      const realtimeConnectVariants: Array<{
        name: RealtimeConnectVariantName;
        create: () => Socket;
      }> = [
        {
          name: "namespace_default_path",
          create: () =>
            io(`${apiHostResolved}/notifications`, {
              transports: ["websocket", "polling"],
              auth: socketAuth,
            }),
        },
        {
          name: "root_notifications_path",
          create: () =>
            io(apiHostResolved, {
              path: "/notifications/socket.io",
              transports: ["websocket", "polling"],
              auth: socketAuth,
            }),
        },
        {
          name: "namespace_notifications_path",
          create: () =>
            io(`${apiHostResolved}/notifications`, {
              path: "/notifications/socket.io",
              transports: ["websocket", "polling"],
              auth: socketAuth,
            }),
        },
      ];

      const toRemoteEventAt = (payload: any): number | null => {
        const raw = payload?.emittedAt;
        if (typeof raw !== "string" || raw.trim().length === 0) return null;
        const parsed = new Date(raw).getTime();
        return Number.isFinite(parsed) ? parsed : null;
      };

      const toHints = (payload: any): Record<string, unknown> | null => {
        if (!payload || typeof payload !== "object") return null;
        const hints =
          payload.hints && typeof payload.hints === "object" && !Array.isArray(payload.hints)
            ? (payload.hints as Record<string, unknown>)
            : null;
        return hints;
      };

      const bindInvalidation = (
        socket: Socket,
        eventName:
          | "transactions:invalidate"
          | "balances:invalidate"
          | "payment-requests:invalidate"
          | "agent-installations:invalidate",
        resource:
          | "transactions"
          | "balances"
          | "payment-requests"
          | "agent-installations",
      ) => {
        socket.on(eventName, (payload: any) => {
          invalidateSDKResource(resource, {
            source: "socket",
            remoteEventAt: toRemoteEventAt(payload),
            hints: toHints(payload),
          });
        });
      };
      const attachSocketHandlers = (
        socket: Socket,
        variantIndex: number,
      ) => {
        socket.on("connect", () => {
          if (cancelled) return;
          setRealtime((prev) => ({
            ...prev,
            status: "connected",
            lastConnectedAt: Date.now(),
            lastError: null,
          }));
        });

        socket.on("disconnect", (reason) => {
          if (cancelled) return;
          setRealtime((prev) => ({
            ...prev,
            status: "disconnected",
            lastDisconnectedAt: Date.now(),
            lastError:
              typeof reason === "string" && reason.trim().length > 0
                ? reason
                : prev.lastError,
          }));
        });

        socket.on("connect_error", (err) => {
          if (cancelled) return;
          const nextVariantIndex = variantIndex + 1;
          if (nextVariantIndex < realtimeConnectVariants.length) {
            setRealtime((prev) => ({
              ...prev,
              status: "connecting",
              lastError: null,
            }));
            socket.disconnect();
            const fallbackSocket = realtimeConnectVariants[nextVariantIndex].create();
            realtimeSocketRef.current = fallbackSocket;
            attachSocketHandlers(fallbackSocket, nextVariantIndex);
            return;
          }
          const variantName = realtimeConnectVariants[variantIndex]?.name ?? "unknown_variant";
          const errorMessage = err?.message ?? "socket_connect_error";
          setRealtime((prev) => ({
            ...prev,
            status: "error",
            lastError: `${variantName}:${errorMessage}`,
          }));
        });

        bindInvalidation(socket, "transactions:invalidate", "transactions");
        bindInvalidation(socket, "balances:invalidate", "balances");
        bindInvalidation(socket, "payment-requests:invalidate", "payment-requests");
        bindInvalidation(socket, "agent-installations:invalidate", "agent-installations");
      };

      const socket = realtimeConnectVariants[0].create();
      realtimeSocketRef.current = socket;
      attachSocketHandlers(socket, 0);
    };

    connect();

    return () => {
      cancelled = true;
      if (realtimeSocketRef.current) {
        realtimeSocketRef.current.disconnect();
        realtimeSocketRef.current = null;
      }
    };
  }, [apiHostResolved, enableRealtime, getAccessToken, state.status]);

  const tenantAuthDomain =
    (bootstrap?.tenant as any)?.authDomain ??
    (bootstrap?.tenant as any)?.auth_domain ??
    (state.tenant as any)?.authDomain ??
    (state.tenant as any)?.auth_domain ??
    null;

  const ieeBaseUrl = useMemo(() => {
    const tenantAuthBase = normalizeTenantAuthBaseUrl(tenantAuthDomain);
    if (tenantAuthBase) {
      try {
        return new URL(tenantAuthBase).origin;
      } catch {
        // Fall back to OAuth baseUrl when tenant auth domain is invalid.
      }
    }
    return oauth.getBaseUrl();
  }, [oauth, tenantAuthDomain]);

  const ieeUrl = useMemo(() => {
    const base = ieeBaseUrl.replace(/\/+$/, "");
    return `${base}/iee`;
  }, [ieeBaseUrl]);

  const expectedIeeOrigin = useMemo(() => {
    try {
      return new URL(ieeUrl).origin;
    } catch {
      return "";
    }
  }, [ieeUrl]);

  const ieeReceiptProvider = useMemo<IeeReceiptProvider | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    if (!ieeUrl || !expectedIeeOrigin) return undefined;

    const ieeService = new IeeService({ client: authApi });
    return {
      getReceipt: async (params) => {
        try {
          const ticket = await ieeService.createPrepTicket({
            actionType: params.serverActionType,
            payload: params.payload,
          });

          const result = await launchIee({
            ieeUrl,
            expectedIeeOrigin,
            receiptRequestId: params.receiptRequestId ?? "",
            ticketId: ticket.ticketId,
          });

          if (result.status === "approved") {
            return {
              status: "approved",
              receipt: result.receipt,
              actionType: result.actionType,
              actionHash: result.actionHash,
              jti: result.jti,
              contextHash: result.contextHash ?? null,
              transactionHash: result.transactionHash ?? null,
              userOpHash: result.userOpHash ?? null,
              preparationToken: result.preparationToken ?? null,
              installationId: result.installationId ?? null,
              resolvedPayload: result.resolvedPayload ?? null,
            };
          }

          if (result.status === "cancelled") {
            return { status: "cancelled" };
          }

          return {
            status: "error",
            error: {
              code: result.error?.code ?? "IEE_ERROR",
              message: result.error?.message ?? "SafeApprove returned an error.",
            },
          };
        } catch (error) {
          return {
            status: "error",
            error: {
              code: "IEE_PROVIDER_ERROR",
              message: error instanceof Error ? error.message : "SafeApprove receipt provider failed.",
            },
          };
        }
      },
    };
  }, [authApi, expectedIeeOrigin, ieeUrl]);

  const ieeContextProvider = useCallback(() => {
    const tenantId = state.user?.tenantId ?? state.tenant?.id ?? null;
    const clientId = oauth.getClientId() ?? null;
    const userId = state.user?.id ?? null;
    return { tenantId, clientId, userId };
  }, [oauth, state.tenant?.id, state.user?.id, state.user?.tenantId]);

  const iee = useMemo(
    () =>
      new IeeOrchestrator({
        receiptProvider: ieeReceiptProvider,
        requireExplicitReceipt,
        contextProvider: ieeContextProvider,
      }),
    [ieeReceiptProvider, requireExplicitReceipt, ieeContextProvider],
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    syncState({
      status: "loading",
      user: null,
      tokens: null,
      tenant: null,
      accountState: null,
    });

    try {
      const sessionState = await validateSession("bootstrap");
      if (sessionState === "invalid") {
        return;
      }

      const tokens = await ensureFreshAccessToken(false);
      if (!tokens) {
        setBootstrap(null);
        setSessionStatus("invalid");
        syncState({
          status: "unauthenticated",
          user: null,
          tokens: null,
          tenant: null,
          accountState: null,
        });
        return;
      }

      const payload = await oauth.fetchBootstrap(tokens, signal);
      setBootstrap(payload);
      syncState({
        status: "authenticated",
        user: payload.user,
        tenant: payload.tenant,
        accountState: payload.accountState ?? null,
        tokens,
      });
    } catch (err) {
      if (shouldInvalidateBootstrapSession(err)) {
        invalidateSession("bootstrap");
        return;
      }
      const e = err instanceof Error ? err : new Error("Authentication failed");
      setBootstrap(null);
      syncState({
        status: "error",
        user: null,
        tokens: null,
        tenant: null,
        accountState: null,
        error: e,
      });
      onError?.(e);
    }
  }, [
    ensureFreshAccessToken,
    invalidateSession,
    oauth,
    onError,
    syncState,
    validateSession,
  ]);

  useEffect(() => {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    void load(controller?.signal);
    return () => controller?.abort();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (state.status === "unauthenticated") return;

    const runCheck = (source: SessionCheckSource) => {
      void validateSession(source);
    };

    const interval = window.setInterval(() => {
      runCheck("interval");
    }, SESSION_CHECK_INTERVAL_MS);

    const handleFocus = () => runCheck("focus");
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        runCheck("visibility");
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [state.status, validateSession]);

  const refreshTokens = useCallback(async () => {
    const tokens = await ensureFreshAccessToken(true);
    if (!tokens) {
      setBootstrap(null);
      setSessionStatus("invalid");
      syncState({
        status: "unauthenticated",
        user: null,
        tokens: null,
        tenant: null,
        accountState: null,
      });
      return;
    }
    const payload = await oauth.fetchBootstrap(tokens);
    setBootstrap(payload);
    syncState({
      status: "authenticated",
      user: payload.user,
      tenant: payload.tenant,
      accountState: payload.accountState ?? null,
      tokens,
    });
  }, [ensureFreshAccessToken, oauth, syncState]);

  const reloadBootstrap = useCallback(async (): Promise<BootstrapPayload | null> => {
    if (state.status !== "authenticated") return null;
    const tokens = tokensRef.current ?? (await ensureFreshAccessToken(false));
    if (!tokens) {
      setSessionStatus("invalid");
      return null;
    }
    try {
      const payload = await oauth.fetchBootstrap(tokens);
      setBootstrap(payload);
      syncState({
        status: "authenticated",
        user: payload.user,
        tenant: payload.tenant,
        accountState: payload.accountState ?? null,
        tokens,
      });
      return payload;
    } catch (err) {
      if (shouldInvalidateBootstrapSession(err)) {
        invalidateSession("bootstrap");
        return null;
      }
      throw err;
    }
  }, [ensureFreshAccessToken, invalidateSession, oauth, state.status, syncState]);

  const logout = useCallback(async () => {
    if (typeof window !== "undefined") {
      const url = appLogoutEndpoint.startsWith("http")
        ? appLogoutEndpoint
        : `${window.location.origin}${appLogoutEndpoint.startsWith("/") ? "" : "/"}${appLogoutEndpoint}`;
      try {
        await fetchImpl(url, {
          method: "POST",
          headers: { Accept: "application/json" },
          credentials: "include",
        });
      } catch {
        // Ignore logout network errors; still clear local state.
      }
    }
    setBootstrap(null);
    tokensRef.current = null;
    setSessionStatus("invalid");
    setLastSessionCheck(null);
    syncState({
      status: "unauthenticated",
      user: null,
      tokens: null,
      tenant: null,
      accountState: null,
    });
  }, [appLogoutEndpoint, fetchImpl, setLastSessionCheck, syncState]);

  const value = useMemo<SDKContextValue>(
    () => ({
      state,
      bootstrap,
      oauth,
      apiClient: api,
      authClient: authApi,
      iee,
      apiBaseUrl: apiHostResolved,
      telemetry,
      getAccessToken,
      refreshTokens,
      reloadBootstrap,
      logout,
      appSession: {
        loginUrl: appLoginUrl,
        tokenEndpoint: appTokenEndpoint,
        logoutEndpoint: appLogoutEndpoint,
        sessionEndpoint: appSessionEndpoint,
      },
      sessionStatus,
      lastSessionCheck,
      realtime,
    }),
    [
      state,
      bootstrap,
      oauth,
      api,
      authApi,
      iee,
      apiHostResolved,
      telemetry,
      getAccessToken,
      refreshTokens,
      reloadBootstrap,
      logout,
      appLoginUrl,
      appTokenEndpoint,
      appLogoutEndpoint,
      appSessionEndpoint,
      sessionStatus,
      lastSessionCheck,
      realtime,
    ],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
};

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
export const useSDK = () => {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error(
      "XKOVAProvider is missing in the React tree. Wrap your app in <XKOVAProvider />.",
    );
  return ctx;
};

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
export const useIeeContext = () => {
  const { state, oauth } = useSDK();
  const tenantId = state.user?.tenantId ?? state.tenant?.id ?? null;
  const clientId = oauth.getClientId() ?? null;
  const userId = state.user?.id ?? null;
  const userEmail = state.user?.email ?? null;
  const scope = state.user?.scope ?? null;

  return { tenantId, clientId, userId, userEmail, scope };
};
