/**
 * Props for {@link SessionManagerCard}.
 *
 * @remarks
 * Purpose:
 * - Configure toast overrides and refresh behavior for the session manager UI.
 *
 * When to use:
 * - Use to provide a custom toast renderer or polling interval.
 *
 * When not to use:
 * - Do not pass sensitive data into toast messages.
 *
 * Return semantics:
 * - Props type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `autoRefreshMs` must be > 0 to enable polling.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react session hooks.
 */
export interface SessionManagerCardProps {
    /**
     * Optional toast/notification hook.
     * The playground passes `sonner` here; SDK UI stays dependency-free.
     */
    onToast?: (type: "success" | "error" | "info", message: string) => void;
    /**
     * Auto-refresh interval in ms (disabled when undefined or <= 0).
     *
     * @remarks
     * - Sessions change infrequently; a longer interval (e.g. 60s) is usually sufficient.
     */
    autoRefreshMs?: number;
}
/**
 * Session manager UI.
 *
 * @remarks
 * Purpose:
 * - Lists the user's active sessions/devices (paged) and allows revoking a specific session or all other sessions.
 *
 * When to use:
 * - Use when providing "devices and sessions" management UI.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `onToast` allows host apps to swap toast implementations.
 *
 * Return semantics:
 * - Renders a card (or `null` when unauthenticated).
 *
 * Errors/failure modes:
 * - Displays an inline error message on fetch/revoke failures.
 * - Disables revocation actions when the token lacks `account:manage`.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Calls oauth-server session endpoints via `@xkova/sdk-react` hooks.
 * - May log the user out when they click "Sign out".
 *
 * Invariants/assumptions:
 * - Current session cannot be revoked (server-enforced); use sign out.
 * - Action tooltips are rendered in a portal to avoid overflow clipping.
 * - Revocations go straight to the IEE (SafeApprove) approval flow (no extra in-app confirmation).
 *
 * Data/auth references:
 * - Uses `/tenant/sessions` bearer endpoints (requires `account:read` / `account:manage`).
 *
 * Pagination:
 * - Uses `limit/offset` paging via `useUserSessions` (defaults to 10 sessions per page).
 *
 * @example
 * <SessionManagerCard autoRefreshMs={60000} />
 */
export declare function SessionManagerCard({ onToast, autoRefreshMs }: SessionManagerCardProps): import("react/jsx-runtime.js").JSX.Element | null;
