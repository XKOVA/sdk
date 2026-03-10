"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTenantConfig } from "@xkova/sdk-react";
import { selectTenantNetwork } from "@xkova/sdk-core";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow, CardSectionLabel } from "./ui/card-layout.js";
import { Skeleton } from "./ui/skeleton.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { Building2, Check, Copy, Globe, RefreshCw, TestTube } from "lucide-react";
import { useRefreshState } from "./use-refresh-state.js";
/**
 * Tenant summary card.
 *
 * @remarks
 * Purpose:
 * - Displays tenant identity (name/slug/id), environment (test/live), primary network name,
 *   and the tenant's ERC-20 tokens with icons.
 * - Copy actions and token chips use portaled tooltips for hover hints.
 * - Layout defaults to a single-column grid and expands to two columns at the `sm` breakpoint.
 *
 * When to use:
 * - Use to display tenant identity and configuration in UI.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Renders a card showing the tenant fields listed above when available.
 * - Renders an empty state when tenant context is missing.
 *
 * Errors/failure modes:
 * - Does not throw. Falls back to "-" for missing tenant fields.
 * - Loading: shows skeleton only on the first load; refresh keeps content and shows a header spinner.
 *
 * Side effects:
 * - Uses the clipboard API when the user clicks copy.
 *
 * Invariants/assumptions:
 * - `useTenantConfig()` is the source of truth for tenant + bootstrap metadata.
 * - Environment is read from `tenant.environment` when present; falls back to primary network `isTestnet`.
 * - Tokens list is filtered to ERC-20 tokens (`contract` is present).
 *
 * Data/auth references:
 * - Uses bootstrap tenant config (`GET /oauth/tenant`) and tenant networks/tokens.
 *
 * @example
 * <TenantCard />
 */
export function TenantCard() {
    const { tenant, networks, tokens, isLoading } = useTenantConfig();
    const [copied, setCopied] = useState(false);
    const { isInitialLoading, isRefreshing } = useRefreshState(isLoading, Boolean(tenant));
    const primaryNetwork = useMemo(() => {
        try {
            return selectTenantNetwork(networks);
        }
        catch {
            return null;
        }
    }, [networks]);
    const environment = useMemo(() => {
        if (tenant?.environment === "test" || tenant?.environment === "live") {
            return tenant.environment;
        }
        if (primaryNetwork?.isTestnet === true)
            return "test";
        if (primaryNetwork)
            return "live";
        return null;
    }, [primaryNetwork, tenant?.environment]);
    const erc20Tokens = useMemo(() => {
        return (tokens ?? []).filter((t) => Boolean(t?.contract));
    }, [tokens]);
    const handleCopyTenantId = useCallback(async () => {
        const id = tenant?.id;
        if (!id)
            return;
        try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            // Ignore clipboard errors
        }
    }, [tenant?.id]);
    if (isInitialLoading) {
        return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-32" }), _jsx(Skeleton, { className: "h-4 w-48 mt-2" })] }), _jsxs(CardContent, { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-16 w-full" })] })] }));
    }
    if (!tenant) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Building2, { className: "h-5 w-5" }), "Tenant"] }), description: _jsx(CardDescription, { children: "Tenant configuration." }) }) }), _jsx(CardContent, { children: _jsx(CardEmptyState, { children: "Sign in to view your tenant configuration." }) })] }));
    }
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Building2, { className: "h-5 w-5" }), "Tenant"] }), description: _jsx(CardDescription, { children: "Tenant identity and configuration." }), actions: _jsxs("div", { className: "flex items-center gap-2", children: [isRefreshing ? (_jsx(RefreshCw, { className: "h-4 w-4 animate-spin text-muted-foreground", "aria-label": "Refreshing" })) : null, environment ? (_jsxs(Badge, { variant: environment === "test" ? "warn" : "success", className: "flex items-center gap-1", children: [environment === "test" ? _jsx(TestTube, { className: "h-3 w-3" }) : _jsx(Globe, { className: "h-3 w-3" }), environment === "test" ? "Test" : "Live"] })) : null] }) }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(CardSectionLabel, { children: "Tenant Name" }), _jsx("div", { className: "text-sm font-medium", children: tenant.name ?? "-" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx(CardSectionLabel, { children: "Tenant Slug" }), _jsx("div", { className: "text-sm font-medium", children: tenant.slug ?? "-" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardSectionLabel, { children: "Tenant ID" }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: handleCopyTenantId, className: "h-7 w-7 p-0", "aria-label": "Copy tenant ID", children: copied ? _jsx(Check, { className: "h-4 w-4 text-emerald-500" }) : _jsx(Copy, { className: "h-4 w-4" }) }) }), _jsx(TooltipContent, { children: copied ? "Copied" : "Copy tenant ID" })] })] }), _jsx("code", { className: "block w-full rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all", children: tenant.id })] }), _jsxs("div", { className: "space-y-1", children: [_jsx(CardSectionLabel, { children: "Network Name" }), _jsx("div", { className: "text-sm font-medium", children: primaryNetwork?.name ?? "-" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(CardSectionLabel, { children: "Tenant Tokens" }), erc20Tokens.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No ERC-20 tokens configured." })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: erc20Tokens.map((token) => (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("div", { className: "flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm cursor-help", children: [_jsx("div", { className: "h-6 w-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0", children: token.logoUrl ? (_jsx("img", { src: token.logoUrl, alt: `${token.symbol} logo`, className: "h-6 w-6 object-contain" })) : (_jsx("span", { className: "text-[10px] font-semibold", children: token.symbol?.slice(0, 2) ?? "??" })) }), _jsx("span", { className: "font-medium", children: token.symbol })] }) }), _jsx(TooltipContent, { className: "max-w-[260px] break-all font-mono", children: token.contract ?? token.symbol })] }, `${token.networkId}:${token.contract}:${token.symbol}`))) }))] })] })] }) }));
}
