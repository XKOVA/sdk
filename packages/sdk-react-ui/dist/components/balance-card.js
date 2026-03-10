"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTokenBalances } from "@xkova/sdk-react";
import { Button } from "./ui/button.js";
import { BalanceText } from "./ui/balance-text.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow } from "./ui/card-layout.js";
import { Skeleton } from "./ui/skeleton.js";
import { useRefreshState } from "./use-refresh-state.js";
import { RefreshCw, Wallet } from "lucide-react";
/**
 * Balance card (token balances).
 *
 * @remarks
 * Purpose:
 * - Display token balances for the authenticated account.
 *
 * When to use:
 * - Use when rendering a balance overview for the current user.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: BalanceCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Falls back to empty state when balances cannot be fetched.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Polls balances when `refreshMs` is set.
 *
 * Invariants/assumptions:
 * - Uses tenant-scoped networks/tokens.
 *
 * Data/auth references:
 * - Uses sdk-react hooks that call balance endpoints.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <BalanceCard refreshMs={30000} />
 */
export function BalanceCard({ showNative = false, refreshMs, showTokenSymbol = false, showTokenLogo = true, }) {
    const { balances, isLoading: balancesLoading, account, accountLoading, configLoading, refresh } = useTokenBalances({ showNative, refreshMs });
    const combinedLoading = accountLoading || configLoading || balancesLoading;
    const hasBalanceData = Boolean(account) || balances.length > 0;
    const { isInitialLoading, isRefreshing } = useRefreshState(combinedLoading, hasBalanceData);
    if (isInitialLoading) {
        return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-32" }), _jsx(Skeleton, { className: "h-4 w-48 mt-2" })] }), _jsxs(CardContent, { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-12 w-full" }), _jsx(Skeleton, { className: "h-12 w-full" })] })] }));
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Wallet, { className: "h-5 w-5" }), "Balance"] }), description: _jsx(CardDescription, { children: "Your token balances." }), actions: _jsx(Button, { variant: "outline", size: "sm", onClick: refresh, disabled: isRefreshing, children: _jsx(RefreshCw, { className: `h-4 w-4 ${isRefreshing ? "animate-spin" : ""}` }) }) }) }), _jsx(CardContent, { children: !account ? (_jsx(CardEmptyState, { children: "Sign in to view your token balances." })) : balances.length === 0 ? (_jsx(CardEmptyState, { children: "No tokens found." })) : (_jsx("div", { className: "divide-y divide-border/50", children: balances.map((item, idx) => (_jsxs("div", { className: "flex items-center justify-between py-3 first:pt-0 last:pb-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden", children: showTokenLogo && item.token?.logoUrl ? (_jsx("img", { src: item.token.logoUrl, alt: `${item.token.symbol} logo`, className: "h-8 w-8 object-contain" })) : (_jsx("span", { className: "text-xs font-medium", children: item.token.symbol?.slice(0, 2) ?? "??" })) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: item.token.symbol }), item.isNative && (_jsx("div", { className: "text-xs text-muted-foreground", children: "Native" }))] })] }), _jsx("div", { className: "text-right", children: _jsx("div", { className: "font-medium", children: _jsx(BalanceText, { value: item.value, decimals: item.token.decimals, symbol: item.token.symbol, isStable: item.token?.isStable, logoUrl: item.token?.logoUrl, showSymbol: showTokenSymbol, showLogo: false }) }) })] }, idx))) })) })] }));
}
