"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useTenantConfig, useTransferTransactions } from "@xkova/sdk-react";
import { ExternalLink, RefreshCw, ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Badge } from "./ui/badge.js";
import { Skeleton } from "./ui/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";
import { SelectMenu, SelectMenuContent, SelectMenuItem, SelectMenuTrigger, SelectMenuValue } from "./ui/select-menu.js";
import { BalanceText } from "./ui/balance-text.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { useRefreshState } from "./use-refresh-state.js";
const toBigIntSafe = (value) => {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (!/^\d+$/.test(trimmed))
        return null;
    try {
        return BigInt(trimmed);
    }
    catch {
        return null;
    }
};
const formatDate = (timestamp) => {
    if (!timestamp)
        return "-";
    try {
        const d = new Date(timestamp);
        if (isNaN(d.getTime()))
            return "-";
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1)
            return "just now";
        if (diffMins < 60)
            return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24)
            return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7)
            return `${diffDays}d ago`;
        return d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
    }
    catch {
        return "-";
    }
};
const getStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "pending")
        return _jsx(Badge, { variant: "secondary", children: "Pending" });
    if (s === "processing")
        return _jsx(Badge, { variant: "secondary", children: "Processing" });
    if (s === "completed")
        return (_jsx(Badge, { className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200", children: "Completed" }));
    if (s === "failed")
        return (_jsx(Badge, { variant: "secondary", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200", children: "Failed" }));
    if (s === "cancelled")
        return _jsx(Badge, { variant: "outline", children: "Cancelled" });
    if (s === "expired")
        return _jsx(Badge, { variant: "outline", children: "Expired" });
    return _jsx(Badge, { variant: "outline", children: status });
};
const getTypeBadge = (type) => {
    const t = String(type || "").toLowerCase();
    if (t === "deposit")
        return (_jsxs(Badge, { variant: "secondary", className: "gap-1", children: [_jsx(ArrowDownLeft, { className: "size-3" }), "Deposit"] }));
    if (t === "withdraw")
        return (_jsxs(Badge, { variant: "secondary", className: "gap-1", children: [_jsx(ArrowUpRight, { className: "size-3" }), "Withdraw"] }));
    return _jsx(Badge, { variant: "outline", children: type });
};
/**
 * Transfer activity card.
 *
 * @remarks
 * Purpose:
 * - List deposit/withdraw activity (provider transactions).
 * - Provide refresh and pagination controls for transfer history.
 * - On small screens, rows render as stacked cards instead of a table.
 *
 * When to use:
 * - Use when showing transfer-provider deposit/withdraw activity.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: TransferActivityCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Displays an error message when fetch fails (including insufficient scope).
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Issues API calls via sdk-react hooks and opens external links.
 *
 * Invariants/assumptions:
 * - Uses authenticated SDK session state for data access.
 *
 * Data/auth references:
 * - Uses `/api/v1/transfers/transactions` via sdk-react transfer hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <TransferActivityCard autoRefreshMs={60000} />
 */
export function TransferActivityCard({ autoRefreshMs = 60000 }) {
    const { transferProviders, networks } = useTenantConfig();
    const [pageSize, setPageSize] = useState(10);
    const [pageIndex, setPageIndex] = useState(0);
    const offset = pageIndex * pageSize;
    // Fetch 1 extra row so we can enable/disable "Next" without needing an exact total.
    const { transactions, isLoading, error, refetch } = useTransferTransactions({
        limit: pageSize + 1,
        offset,
        autoRefreshMs,
    });
    const { isInitialLoading, isRefreshing } = useRefreshState(isLoading, (transactions?.length ?? 0) > 0);
    // Allow sibling components (like TransfersCard) to trigger a refresh without direct coupling.
    useEffect(() => {
        const handler = () => {
            refetch();
        };
        window.addEventListener("xkova:transfer-activity-updated", handler);
        return () => window.removeEventListener("xkova:transfer-activity-updated", handler);
    }, [refetch]);
    const hasNext = (transactions?.length ?? 0) > pageSize;
    const canPrev = pageIndex > 0;
    const pageTransactions = (transactions ?? []).slice(0, pageSize);
    const providerById = useMemo(() => {
        const map = new Map();
        for (const p of transferProviders ?? []) {
            const id = String(p?.providerId ?? p?.id ?? "").trim();
            if (!id)
                continue;
            map.set(id, { name: p?.name, logoUrl: p?.logoUrl ?? null });
        }
        return map;
    }, [transferProviders]);
    const getExplorerTxUrl = (networkId, transactionHash) => {
        if (!transactionHash)
            return null;
        const netId = networkId ? String(networkId) : null;
        const net = (networks ?? []).find((n) => String(n.networkId) === netId);
        const explorerBase = net?.explorerUrl ?? net?.explorer_url ?? null;
        if (!explorerBase)
            return null;
        return `${String(explorerBase).replace(/\/+$/, "")}/tx/${transactionHash}`;
    };
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { className: "h-full flex flex-col", children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(History, { className: "size-5" }), "Transfer Activity"] }), description: _jsx(CardDescription, { children: "Recent deposits and withdrawals through your configured providers." }), actions: _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { variant: "outline", size: "icon-sm", onClick: () => refetch(), disabled: isRefreshing, "aria-label": "Refresh transfer activity", children: _jsx(RefreshCw, { className: `size-4 ${isRefreshing ? "animate-spin" : ""}` }) }) }) }), _jsx(TooltipContent, { children: "Refresh" })] }) }) }) }), _jsx(CardContent, { className: "flex flex-col gap-4 flex-1 min-h-0", children: isInitialLoading ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" })] })) : error ? (_jsx("div", { className: "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive", children: error.message || "Failed to load transfer activity" })) : pageTransactions.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "space-y-3 sm:hidden", children: pageTransactions.map((tx) => {
                                    const providerInfo = providerById.get(tx.providerId);
                                    const providerName = providerInfo?.name ??
                                        (tx.providerName && tx.providerName !== "Provider" ? tx.providerName : null) ??
                                        tx.providerId;
                                    const providerLogoUrl = providerInfo?.logoUrl ?? null;
                                    const txUrl = getExplorerTxUrl(tx.networkId, tx.transactionHash ?? null);
                                    const providerUrl = tx.providerUrl ? String(tx.providerUrl) : null;
                                    const cryptoAmount = toBigIntSafe(tx.cryptoAmountWei);
                                    return (_jsxs("div", { className: "rounded-lg border border-border/60 p-3 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [getTypeBadge(tx.type), getStatusBadge(tx.status)] }), _jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [providerLogoUrl ? (_jsx("img", { src: providerLogoUrl, alt: `${providerName} logo`, className: "h-7 w-7 rounded-full object-cover" })) : (_jsx("div", { className: "h-7 w-7 rounded-full bg-muted" })), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium truncate", children: providerName }), _jsx("div", { className: "text-xs text-muted-foreground", children: tx.paymentMethod ? `Method: ${tx.paymentMethod}` : "" })] })] }), _jsxs("div", { className: "flex items-center justify-between gap-2 text-sm", children: [_jsxs("div", { className: "font-medium tabular-nums", children: [tx.fiatAmount, " ", tx.fiatCurrency] }), _jsx("div", { className: "text-xs text-muted-foreground", children: formatDate(tx.completedAt ?? tx.updatedAt ?? tx.createdAt) })] }), _jsx("div", { className: "text-xs text-muted-foreground", children: cryptoAmount !== null ? (_jsx(BalanceText, { value: cryptoAmount, decimals: Number(tx.tokenDecimals ?? 18), symbol: tx.cryptoSymbol, showLogo: false, showSymbol: true })) : ("-") }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 text-sm", children: [txUrl ? (_jsxs("a", { href: txUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-primary hover:underline", "aria-label": "View on explorer", children: ["TX", _jsx(ExternalLink, { className: "size-3" })] })) : (_jsx("span", { className: "text-muted-foreground", children: "No tx link" })), providerUrl ? (_jsxs("a", { href: providerUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-primary hover:underline", "aria-label": "Open provider", children: ["Provider", _jsx(ExternalLink, { className: "size-3" })] })) : null] })] }, tx.id));
                                }) }), _jsx("div", { className: "hidden sm:block rounded-md border flex-1 min-h-0 overflow-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Type" }), _jsx(TableHead, { children: "Provider" }), _jsx(TableHead, { children: "Amount" }), _jsx(TableHead, { children: "Status" }), _jsx(TableHead, { children: "Time" }), _jsx(TableHead, { className: "text-right", children: "Links" })] }) }), _jsx(TableBody, { children: pageTransactions.map((tx) => {
                                                const providerInfo = providerById.get(tx.providerId);
                                                const providerName = providerInfo?.name ??
                                                    (tx.providerName && tx.providerName !== "Provider" ? tx.providerName : null) ??
                                                    tx.providerId;
                                                const providerLogoUrl = providerInfo?.logoUrl ?? null;
                                                const txUrl = getExplorerTxUrl(tx.networkId, tx.transactionHash ?? null);
                                                const providerUrl = tx.providerUrl ? String(tx.providerUrl) : null;
                                                const cryptoAmount = toBigIntSafe(tx.cryptoAmountWei);
                                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "sm:whitespace-nowrap", children: getTypeBadge(tx.type) }), _jsx(TableCell, { className: "min-w-0 sm:min-w-[220px]", children: _jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [providerLogoUrl ? (_jsx("img", { src: providerLogoUrl, alt: `${providerName} logo`, className: "h-6 w-6 rounded-full object-cover" })) : (_jsx("div", { className: "h-6 w-6 rounded-full bg-muted" })), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium truncate", children: providerName }), _jsx("div", { className: "text-xs text-muted-foreground", children: tx.paymentMethod ? `Method: ${tx.paymentMethod}` : "" })] })] }) }), _jsxs(TableCell, { className: "sm:whitespace-nowrap", children: [_jsxs("div", { className: "font-medium tabular-nums", children: [tx.fiatAmount, " ", tx.fiatCurrency] }), _jsx("div", { className: "text-xs text-muted-foreground", children: cryptoAmount !== null ? (_jsx(BalanceText, { value: cryptoAmount, decimals: Number(tx.tokenDecimals ?? 18), symbol: tx.cryptoSymbol, showLogo: false, showSymbol: true })) : ("-") })] }), _jsx(TableCell, { className: "sm:whitespace-nowrap", children: getStatusBadge(tx.status) }), _jsx(TableCell, { className: "sm:whitespace-nowrap text-muted-foreground", children: formatDate(tx.completedAt ?? tx.updatedAt ?? tx.createdAt) }), _jsx(TableCell, { className: "text-right sm:whitespace-nowrap", children: _jsxs("div", { className: "flex justify-end gap-2", children: [txUrl ? (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("a", { href: txUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-primary hover:underline", "aria-label": "View on explorer", children: ["TX", _jsx(ExternalLink, { className: "size-3" })] }) }), _jsx(TooltipContent, { children: "View on explorer" })] })) : (_jsx("span", { className: "text-muted-foreground", children: "-" })), providerUrl ? (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("a", { href: providerUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-primary hover:underline", "aria-label": "Open provider", children: ["Provider", _jsx(ExternalLink, { className: "size-3" })] }) }), _jsx(TooltipContent, { children: "Open provider" })] })) : null] }) })] }, tx.id));
                                            }) })] }) }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Page ", pageIndex + 1] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(SelectMenu, { value: String(pageSize), onValueChange: (v) => {
                                                    setPageSize(Number(v));
                                                    setPageIndex(0);
                                                }, children: [_jsx(SelectMenuTrigger, { className: "h-8 w-[120px]", children: _jsx(SelectMenuValue, { placeholder: "Rows" }) }), _jsxs(SelectMenuContent, { children: [_jsx(SelectMenuItem, { value: "10", children: "10 / page" }), _jsx(SelectMenuItem, { value: "20", children: "20 / page" }), _jsx(SelectMenuItem, { value: "50", children: "50 / page" })] })] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPageIndex((p) => Math.max(0, p - 1)), disabled: !canPrev, children: "Previous" }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPageIndex((p) => p + 1), disabled: !hasNext, children: "Next" })] })] })] })) : (_jsxs("div", { className: "text-center py-10 space-y-2", children: [_jsx(History, { className: "size-8 mx-auto text-muted-foreground" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "No transfer activity found" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Complete a deposit or withdraw to see it here." })] })) })] }) }));
}
