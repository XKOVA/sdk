"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAccountState } from "@xkova/sdk-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow, CardSectionLabel } from "./ui/card-layout.js";
import { Skeleton } from "./ui/skeleton.js";
import { useRefreshState } from "./use-refresh-state.js";
import { Copy, Check, RefreshCw, User } from "lucide-react";
/**
 * Account summary card.
 *
 * @remarks
 * Purpose:
 * - Display the authenticated primary account (no balances).
 *
 * When to use:
 * - Use to show primary account identifiers.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: AccountCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders fallback UI when account state cannot be fetched.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Loads account state and optionally polls when `refreshMs` is set.
 *
 * Invariants/assumptions:
 * - Uses `useAccountState` as the source of truth.
 *
 * Data/auth references:
 * - Uses sdk-react account hooks that call oauth-server `/account`.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <AccountCard refreshMs={15000} />
 */
export function AccountCard({ refreshMs, }) {
    const { accountState, isLoading, error, refresh } = useAccountState();
    const [actionLoading, setActionLoading] = useState(false);
    const [copied, setCopied] = useState(null);
    const hasAccount = Boolean(accountState?.account);
    const { isInitialLoading, isRefreshing } = useRefreshState(isLoading, hasAccount);
    const primary = accountState?.account ?? null;
    const truncateIdentifier = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`;
    const handleCopy = useCallback(async (value) => {
        const id = String(value ?? "").trim();
        if (!id)
            return;
        try {
            await navigator.clipboard.writeText(id);
            setCopied(id);
            setTimeout(() => setCopied(null), 2000);
        }
        catch {
            // Ignore clipboard errors
        }
    }, []);
    const handleRefresh = useCallback(async () => {
        setActionLoading(true);
        try {
            await refresh();
        }
        finally {
            setActionLoading(false);
        }
    }, [refresh]);
    useEffect(() => {
        if (!refreshMs || refreshMs <= 0)
            return;
        const id = setInterval(() => {
            void handleRefresh();
        }, refreshMs);
        return () => clearInterval(id);
    }, [handleRefresh, refreshMs]);
    if (isInitialLoading) {
        return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-32" }), _jsx(Skeleton, { className: "h-4 w-48 mt-2" })] }), _jsxs(CardContent, { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-8 w-full" }), _jsx(Skeleton, { className: "h-12 w-full" })] })] }));
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(User, { className: "h-5 w-5" }), "Account"] }), description: _jsx(CardDescription, { children: "Your primary account." }), actions: _jsx(Button, { variant: "outline", size: "sm", onClick: handleRefresh, disabled: actionLoading || isRefreshing, children: _jsx(RefreshCw, { className: `h-4 w-4 ${actionLoading || isRefreshing ? "animate-spin" : ""}` }) }) }) }), _jsxs(CardContent, { className: "space-y-4", children: [error && (_jsx("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive", children: error.message || "Failed to load accounts" })), primary ? (_jsx(_Fragment, { children: _jsxs("div", { className: "space-y-2", children: [_jsx(CardSectionLabel, { children: "Primary Account" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono", children: truncateIdentifier(primary.account) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy(primary.account), className: "shrink-0", "aria-label": "Copy primary account", children: copied === primary.account ? (_jsx(Check, { className: "h-4 w-4 text-emerald-500" })) : (_jsx(Copy, { className: "h-4 w-4" })) })] })] }) })) : (_jsx(CardEmptyState, { children: "No account available. Sign in to view your account." }))] })] }));
}
