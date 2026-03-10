"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth, useUserSessions, useIeeReceiptAction, useIeeContext } from "@xkova/sdk-react";
import { useCallback, useMemo, useState } from "react";
import { Monitor, Smartphone, Globe, LogOut, Shield, AlertTriangle, RefreshCw } from "lucide-react";
import { notify as notifyToast } from "../toast-utils.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Card, CardContent } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Skeleton } from "./ui/skeleton.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { useRefreshState } from "./use-refresh-state.js";
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
export function SessionManagerCard({ onToast, autoRefreshMs }) {
    const { status, logout } = useAuth();
    const { tenantId, clientId, userId } = useIeeContext();
    const iee = useIeeReceiptAction();
    const { sessions, total, currentSessionId, offset, pageSize, hasNextPage, hasPrevPage, nextPage, prevPage, isLoading, error, revokeSession, revokeOtherSessions, canManage, refetch, } = useUserSessions({ autoRefreshMs, pageSize: 10 });
    const { isInitialLoading, isRefreshing } = useRefreshState(isLoading, sessions.length > 0);
    const [actionLoading, setActionLoading] = useState(null);
    const notify = useCallback((type, message, err) => {
        notifyToast(type, message, {
            onToast,
            error: err,
            context: "SessionManagerCard",
            fallbackForError: message,
        });
    }, [onToast]);
    const hasOtherSessions = useMemo(() => {
        return total > 1;
    }, [total]);
    const pageRangeLabel = useMemo(() => {
        if (total <= 0)
            return "0";
        const start = offset + 1;
        const end = Math.min(offset + sessions.length, total);
        return `${start}–${end}`;
    }, [offset, sessions.length, total]);
    const getDeviceIcon = useCallback((type) => {
        const lower = String(type ?? "").toLowerCase();
        if (lower === "mobile")
            return Smartphone;
        if (lower === "tablet")
            return Smartphone;
        if (lower === "desktop")
            return Monitor;
        return Globe;
    }, []);
    /**
     * Human-friendly relative time formatter.
     */
    const formatRelativeTime = useCallback((iso) => {
        if (!iso)
            return "Unknown";
        const date = new Date(iso);
        if (Number.isNaN(date.getTime()))
            return "Unknown";
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return "Just now";
        if (diffMins < 60)
            return `${diffMins} minutes ago`;
        if (diffHours < 24)
            return `${diffHours} hours ago`;
        if (diffDays < 7)
            return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }, []);
    const handleSignOut = useCallback(async () => {
        setActionLoading("logout");
        try {
            await logout();
            notify("success", "Signed out");
        }
        catch (err) {
            notify("error", "Failed to sign out", err);
        }
        finally {
            setActionLoading(null);
        }
    }, [logout, notify]);
    const handleRefresh = useCallback(async () => {
        setActionLoading("refresh");
        try {
            await refetch({ skipLoading: true });
        }
        catch (err) {
            notify("error", "Failed to refresh sessions", err);
        }
        finally {
            setActionLoading(null);
        }
    }, [refetch, notify]);
    const handleRevokeOne = useCallback(async (sessionId) => {
        const targetSessionId = String(sessionId || "").trim();
        if (!targetSessionId)
            return;
        setActionLoading(targetSessionId);
        try {
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const receiptResult = await iee.run({
                actionType: "session_revoke_v1",
                payload: {
                    tenant_id: tenantId,
                    client_id: clientId,
                    user_id: userId,
                    session_id: targetSessionId,
                },
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            await revokeSession(targetSessionId, { receipt: receiptResult.receipt });
            notify("success", "Session revoked");
        }
        catch (err) {
            notify("error", "Failed to revoke session", err);
        }
        finally {
            setActionLoading(null);
        }
    }, [clientId, iee, notify, revokeSession, tenantId, userId]);
    const handleRevokeAllOthers = useCallback(async () => {
        setActionLoading("all");
        try {
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            if (!currentSessionId) {
                throw new Error("Current session id is unavailable");
            }
            const receiptResult = await iee.run({
                actionType: "session_revoke_others_v1",
                payload: {
                    tenant_id: tenantId,
                    client_id: clientId,
                    user_id: userId,
                    current_session_id: currentSessionId,
                },
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            const result = await revokeOtherSessions({ receipt: receiptResult.receipt });
            notify("success", `${result.revokedCount} sessions revoked`);
        }
        catch (err) {
            notify("error", "Failed to revoke sessions", err);
        }
        finally {
            setActionLoading(null);
        }
    }, [clientId, currentSessionId, iee, notify, revokeOtherSessions, tenantId, userId]);
    if (status !== "authenticated")
        return null;
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { children: [_jsx("div", { className: "p-6", children: _jsx(CardHeaderRow, { title: _jsxs("div", { className: "flex items-center gap-2 text-xl font-semibold", children: [_jsx(Shield, { className: "h-5 w-5" }), "Sessions"] }), description: _jsx("div", { className: "text-sm text-muted-foreground", children: "Review where you\u2019re signed in and revoke sessions you don\u2019t recognize." }), actions: _jsxs("div", { className: "flex flex-wrap items-center justify-end gap-2", children: [hasOtherSessions && (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsxs(Button, { type: "button", variant: "outline", onClick: handleRevokeAllOthers, disabled: !canManage || actionLoading === "all", className: "text-red-400 hover:text-red-300", "aria-label": "Revoke all other sessions", children: [_jsx(LogOut, { className: "mr-2 h-4 w-4" }), actionLoading === "all" ? "Revoking..." : "Revoke All Other Sessions"] }) }) }), _jsx(TooltipContent, { children: !canManage ? "Missing scope: account:manage" : "Revoke all other sessions" })] })), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { type: "button", variant: "outline", size: "icon-sm", onClick: handleRefresh, disabled: isRefreshing || actionLoading !== null, "aria-label": "Refresh sessions", children: _jsx(RefreshCw, { className: actionLoading === "refresh" || isRefreshing ? "animate-spin" : "" }) }) }) }), _jsx(TooltipContent, { children: "Refresh sessions" })] }), _jsxs(Button, { type: "button", variant: "outline", onClick: handleSignOut, disabled: actionLoading === "logout", "aria-label": "Sign out", children: [_jsx(LogOut, { className: "mr-2 h-4 w-4" }), actionLoading === "logout" ? "Signing out..." : "Sign out"] })] }) }) }), _jsxs(CardContent, { className: "space-y-4", children: [!canManage && (_jsxs("div", { className: "flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3", children: [_jsx("div", { className: "mt-0.5 rounded-full bg-amber-500/10 p-1.5", children: _jsx(AlertTriangle, { className: "h-4 w-4 text-amber-400" }) }), _jsxs("div", { className: "text-sm text-muted-foreground", children: ["Revocation is disabled because your token is missing ", _jsx("span", { className: "font-mono", children: "account:manage" }), "."] })] })), error && (_jsx("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive", children: error.message || "Failed to load sessions" })), isInitialLoading ? (_jsxs("div", { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-6 w-40" }), _jsx(Skeleton, { className: "h-16 w-full" }), _jsx(Skeleton, { className: "h-16 w-full" })] })) : (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "text-sm text-muted-foreground", children: [total, " active ", total === 1 ? "session" : "sessions"] }), sessions.map((session) => {
                                    const DeviceIcon = getDeviceIcon(session.device?.type);
                                    const isCurrent = session.activity?.isCurrentSession === true;
                                    const label = session.device?.description || session.device?.browser || "Unknown device";
                                    const lastActive = formatRelativeTime(session.activity?.lastActiveAt ?? "");
                                    return (_jsxs("div", { className: "flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-muted-foreground/40 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "flex gap-4 min-w-0", children: [_jsx("div", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted", children: _jsx(DeviceIcon, { className: "h-5 w-5 text-muted-foreground" }) }), _jsxs("div", { className: "space-y-2 min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium", children: label }), isCurrent && _jsx(Badge, { className: "bg-emerald-500", children: "Current Session" })] }), _jsxs("div", { className: "space-y-1 text-sm text-muted-foreground", children: [_jsxs("div", { children: [session.device?.browser || "Unknown", " on ", session.device?.os || "Unknown"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Globe, { className: "h-3 w-3" }), _jsx("span", { children: session.security?.ipAddress || "Unknown IP" }), session.location?.display && (_jsxs("span", { className: "truncate", children: ["\u2022 ", session.location.display] }))] }), _jsxs("div", { className: "text-xs", children: ["Last active: ", lastActive] })] })] })] }), !isCurrent ? (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => handleRevokeOne(session.sessionId), disabled: !canManage || actionLoading === session.sessionId, className: "w-full text-red-400 hover:text-red-300 sm:w-auto", "aria-label": "Revoke session", children: [_jsx(LogOut, { className: "mr-2 h-4 w-4" }), actionLoading === session.sessionId ? "Revoking..." : "Revoke"] }) }) }), _jsx(TooltipContent, { children: !canManage ? "Missing scope: account:manage" : "Revoke session" })] })) : (_jsx(Badge, { variant: "secondary", className: "self-start sm:self-auto", children: "Signed in" }))] }, session.sessionId));
                                }), total > pageSize && (_jsxs("div", { className: "flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "text-sm text-muted-foreground", children: ["Showing ", pageRangeLabel, " of ", total] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: prevPage, disabled: !hasPrevPage || isLoading, "aria-label": "Previous sessions page", children: "Previous" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: nextPage, disabled: !hasNextPage || isLoading, "aria-label": "Next sessions page", children: "Next" })] })] }))] }))] })] }) }));
}
