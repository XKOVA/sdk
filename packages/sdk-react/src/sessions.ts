import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SessionManagementService,
  type UserSessionListResult,
  type UserSession,
  type RevokeUserSessionResult,
  type RevokeOtherSessionsResult,
} from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { emitResourceUpdate, subscribeResourceUpdate } from "./resources.js";
import { resolvePollingFallbackMs } from "./realtime.js";

/**
 * Session management hook for listing and revoking user sessions.
 *
 * @remarks
 * Purpose:
 * - List and revoke active sessions for the authenticated user.
 * - Provide pagination and revoke helpers for session management UI.
 *
 * When to use:
 * - Use when building session management UI (for example, "sign out other devices").
 *
 * When not to use:
 * - Do not use when unauthenticated or without required account scopes.
 *
 * Parameters:
 * - `options`: Optional configuration. Nullable: yes.
 * - `options.autoRefreshMs`: Refresh interval in ms (polling fallback only when realtime is unavailable). Nullable: yes.
 * - `options.pageSize`: Page size (1-200). Nullable: yes.
 * - `options.initialOffset`: Initial pagination offset (>= 0). Nullable: yes.
 *
 * Return semantics:
 * - Returns session list state, pagination helpers, and revoke actions.
 *
 * Errors/failure modes:
 * - `refetch`, `revokeSession`, and `revokeOtherSessions` throw when unauthenticated or unauthorized.
 * - Network errors are surfaced via `error`.
 *
 * Side effects:
 * - Issues OAuth requests to load or revoke sessions.
 * - Emits `sessions` invalidation on revokes.
 *
 * Invariants/assumptions:
 * - `sessions` is always an array; `currentSessionId` may be null.
 * - Requires `account:read` (or `account:manage`) to list and `account:manage` to revoke.
 * - The server forbids revoking the current session; use `logout()` for that.
 * - Revocations require IEE (SafeApprove) receipts for `session_revoke_v1` and `session_revoke_others_v1` (auto-collected when possible).
 *
 * Data/auth references:
 * - `/tenant/sessions` and `/tenant/sessions/others` (oauth-server, bearer token).
 *
 * @example
 * const { sessions, revokeOtherSessions } = useUserSessions();
 *
 * @see SessionManagementService
 */
export const useUserSessions = (options?: {
  autoRefreshMs?: number;
  pageSize?: number;
  initialOffset?: number;
}) => {
  const { state, authClient, iee, realtime } = useSDK();
  const autoRefreshMs = resolvePollingFallbackMs(options?.autoRefreshMs, realtime);
  const pageSize =
    typeof options?.pageSize === "number" && options.pageSize > 0
      ? Math.min(Math.floor(options.pageSize), 200)
      : 10;
  const [offset, setOffset] = useState(() => {
    const initial = options?.initialOffset;
    if (typeof initial !== "number" || !Number.isFinite(initial) || initial < 0) return 0;
    return Math.floor(initial);
  });
  const [data, setData] = useState<UserSessionListResult>({
    sessions: [],
    total: 0,
    currentSessionId: null,
    limit: pageSize,
    offset: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const latestFetchRef = useRef<symbol | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const service = useMemo(
    () => new SessionManagementService({ client: authClient, iee }),
    [authClient, iee],
  );

  const scopes = state.tokens?.scope ?? [];
  const canRead =
    scopes.includes("all") ||
    scopes.includes("account:read") ||
    scopes.includes("account:manage");
  const canManage =
    scopes.includes("all") ||
    scopes.includes("account:manage");

  const refetch = useCallback(
    async (params?: { skipLoading?: boolean }) => {
      if (state.status !== "authenticated") return;
      if (!canRead) {
        throw new Error(
          "Insufficient scope. Required: account:read or account:manage (any)",
        );
      }

      const isBackground = params?.skipLoading === true;
      const inFlight = abortRef.current && abortRef.current.signal.aborted === false;
      if (isBackground && inFlight) return;

      const token = Symbol("user-sessions");
      latestFetchRef.current = token;
      if (!isBackground && inFlight) {
        abortRef.current?.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      if (!isBackground) setIsLoading(true);
      setError(null);

      try {
        const result = await service.listSessions({ limit: pageSize, offset });
        if (latestFetchRef.current !== token) return;
        setData(result);
        // Clamp the offset to the last valid page when the total shrinks.
        if (typeof result.total === "number" && result.total >= 0) {
          const maxOffset =
            result.total === 0 ? 0 : Math.floor((result.total - 1) / pageSize) * pageSize;
          if (offset > maxOffset) {
            setOffset(maxOffset);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (latestFetchRef.current !== token) return;
        setError(err as Error);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (!isBackground) setIsLoading(false);
      }
    },
    [state.status, canRead, service, pageSize, offset],
  );

  useEffect(() => {
    if (state.status !== "authenticated") {
      setData({ sessions: [], total: 0, currentSessionId: null, limit: pageSize, offset: 0 });
      setIsLoading(false);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [state.status, refetch, pageSize]);

  useEffect(() => {
    const intervalMs = autoRefreshMs;
    if (state.status !== "authenticated") return;
    if (!intervalMs || intervalMs <= 0) return;
    const id = setInterval(() => {
      void refetch({ skipLoading: true });
    }, intervalMs);
    return () => clearInterval(id);
  }, [autoRefreshMs, refetch, state.status]);

  useEffect(() => {
    return subscribeResourceUpdate("sessions", () => {
      void refetch({ skipLoading: true });
    });
  }, [refetch]);

  const revokeSession = useCallback(
    async (
      sessionId: string,
      options?: { receipt?: string | null },
    ): Promise<RevokeUserSessionResult> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      if (!canManage) {
        throw new Error("Insufficient scope. Required: account:manage (any)");
      }

      const result = await service.revokeSession(sessionId, options);
      emitResourceUpdate("sessions");
      await refetch({ skipLoading: true });
      return result;
    },
    [state.status, canManage, service, refetch],
  );

  const revokeOtherSessions = useCallback(
    async (options?: { receipt?: string | null }): Promise<RevokeOtherSessionsResult> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      if (!canManage) {
        throw new Error("Insufficient scope. Required: account:manage (any)");
      }

      const result = await service.revokeOtherSessions(options);
      emitResourceUpdate("sessions");
      await refetch({ skipLoading: true });
      return result;
    },
    [state.status, canManage, service, refetch],
  );

  return {
    sessions: (data.sessions ?? []) as UserSession[],
    total: data.total ?? (data.sessions?.length ?? 0),
    currentSessionId: data.currentSessionId ?? null,
    limit: data.limit ?? pageSize,
    offset: data.offset ?? offset,
    pageSize,
    setOffset,
    nextPage: () => setOffset((o) => o + pageSize),
    prevPage: () => setOffset((o) => Math.max(0, o - pageSize)),
    hasNextPage:
      typeof data.total === "number" ? offset + pageSize < data.total : false,
    hasPrevPage: offset > 0,
    isLoading,
    error,
    refetch,
    revokeSession,
    revokeOtherSessions,
    canRead,
    canManage,
  };
};
