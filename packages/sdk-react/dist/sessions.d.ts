import { type UserSession, type RevokeUserSessionResult, type RevokeOtherSessionsResult } from "@xkova/sdk-core";
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
export declare const useUserSessions: (options?: {
    autoRefreshMs?: number;
    pageSize?: number;
    initialOffset?: number;
}) => {
    sessions: UserSession[];
    total: number;
    currentSessionId: string | null;
    limit: number;
    offset: number;
    pageSize: number;
    setOffset: import("react").Dispatch<import("react").SetStateAction<number>>;
    nextPage: () => void;
    prevPage: () => void;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    isLoading: boolean;
    error: Error | null;
    refetch: (params?: {
        skipLoading?: boolean;
    }) => Promise<void>;
    revokeSession: (sessionId: string, options?: {
        receipt?: string | null;
    }) => Promise<RevokeUserSessionResult>;
    revokeOtherSessions: (options?: {
        receipt?: string | null;
    }) => Promise<RevokeOtherSessionsResult>;
    canRead: boolean;
    canManage: boolean;
};
