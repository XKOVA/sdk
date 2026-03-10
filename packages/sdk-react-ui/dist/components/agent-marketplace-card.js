"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMarketplaceAgents, useMyAgentInstallations, useRealtimeStatus } from "@xkova/sdk-react";
import { SDKError } from "@xkova/sdk-core";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AgentInstallFlow } from "./agent-install-flow.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Badge } from "./ui/badge.js";
import { Skeleton } from "./ui/skeleton.js";
import { RefreshCw, Store, Zap, CreditCard, ShoppingCart, TrendingUp, BarChart3, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { useRefreshState } from "./use-refresh-state.js";
import { DEFAULT_AGENT_INSTALLATIONS_POLL_MS } from "./agent-polling.js";
import { trapFocusWithin } from "../utils.js";
/** Category icon mapping */
const categoryIcons = {
    trading: _jsx(TrendingUp, { className: "h-4 w-4" }),
    payments: _jsx(CreditCard, { className: "h-4 w-4" }),
    ecommerce: _jsx(ShoppingCart, { className: "h-4 w-4" }),
    defi: _jsx(Zap, { className: "h-4 w-4" }),
    analytics: _jsx(BarChart3, { className: "h-4 w-4" }),
    notifications: _jsx(Bell, { className: "h-4 w-4" }),
};
/** Category label mapping */
const categoryLabels = {
    trading: "Trading",
    payments: "Payments",
    ecommerce: "E-Commerce",
    defi: "DeFi",
    analytics: "Analytics",
    notifications: "Notifications",
};
const formatBps = (bps) => {
    if (typeof bps !== "number" || !Number.isFinite(bps))
        return "Not specified";
    return `${(bps / 100).toFixed(2)}%`;
};
const formatMarketplaceError = (err) => {
    if (!err)
        return "";
    if (err instanceof SDKError && err.code === "unauthorized") {
        return "Session expired. Please sign in again.";
    }
    const code = err?.code;
    if (code === "unauthorized") {
        return "Session expired. Please sign in again.";
    }
    const message = typeof err.message === "string" && err.message.trim()
        ? err.message
        : "Failed to load marketplace.";
    return message;
};
/**
 * Formats a base-unit integer string (BigInt-safe) into a human-readable decimal string.
 *
 * @param value - Base-unit integer encoded as a decimal string (e.g. `"1000000"`). Falsy values are treated as `"0"`.
 * @param decimals - Token decimals. Must be \(\ge 0\). If `0`, returns the integer string.
 * @returns The formatted decimal string with trailing zeros removed (e.g. `"1.5"`).
 *
 * @throws If `value` is not a valid integer string for `BigInt(...)`.
 *
 * @remarks
 * Side effects: None.
 *
 * Invariants/assumptions:
 * - `decimals` is a small integer (typical token decimals).
 */
function formatUnits(value, decimals) {
    const v = BigInt(value || "0");
    if (decimals <= 0)
        return v.toString();
    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = v % base;
    if (frac === 0n)
        return whole.toString();
    const fracStr = frac
        .toString()
        .padStart(decimals, "0")
        .replace(/0+$/, "");
    return `${whole.toString()}.${fracStr}`;
}
/**
 * Renders the tenant-scoped marketplace catalog and (optionally) the built-in install flow.
 *
 * @remarks
 * Purpose:
 * - Render the tenant-scoped marketplace catalog and optional install flow.
 *
 * When to use:
 * - Use when you want a ready-made marketplace catalog UI.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: AgentMarketplaceCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders an in-card error message and allows retry via refresh.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 * - Layout defaults to a single-column grid and expands to two columns at the `sm` breakpoint.
 *
 * Side effects:
 * - Calls marketplace hooks and opens modal dialogs.
 *
 * Invariants/assumptions:
 * - Marketplace catalog is tenant-scoped and requires authentication.
 * - Installed badges exclude revoked installs; pending revocations show as uninstalling.
 * - Pending webhook provisioning surfaces as provisioning status.
 * - Built-in install flow auto-closes on success and will not open when already installed.
 *
 * Data/auth references:
 * - Uses `/marketplace/tenant/catalog` via sdk-react hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <AgentMarketplaceCard enableInstallFlow installDialogTitle="Install Agent" />
 */
export function AgentMarketplaceCard({ category, limit, autoRefreshMs, onInstall, onViewDetails, featuredOnly = false, enableInstallFlow = false, installDialogTitle = "Install Agent", }) {
    const { agents, isLoading, error, refresh } = useMarketplaceAgents();
    const realtime = useRealtimeStatus();
    const installationsAutoRefreshMs = autoRefreshMs === undefined ? DEFAULT_AGENT_INSTALLATIONS_POLL_MS : autoRefreshMs;
    const resolvedAutoRefreshMs = useMemo(() => {
        if (!installationsAutoRefreshMs || installationsAutoRefreshMs <= 0) {
            return undefined;
        }
        return realtime.status === "connected" ? undefined : installationsAutoRefreshMs;
    }, [installationsAutoRefreshMs, realtime.status]);
    const { installations, refresh: refreshInstallations, freshness: installationsFreshness, } = useMyAgentInstallations({
        autoRefreshMs: resolvedAutoRefreshMs,
    });
    const [selectedCategory, setSelectedCategory] = useState(category);
    const [detailsAgent, setDetailsAgent] = useState(null);
    const [installingAgent, setInstallingAgent] = useState(null);
    const detailsOverlayRef = useRef(null);
    const detailsPanelRef = useRef(null);
    const detailsCloseRef = useRef(null);
    const lastActiveElementRef = useRef(null);
    const detailsTitleIdRef = useRef(`xkova-agent-details-title-${Math.random().toString(36).slice(2)}`);
    const detailsDescriptionIdRef = useRef(`xkova-agent-details-desc-${Math.random().toString(36).slice(2)}`);
    useEffect(() => {
        if (!detailsAgent)
            return;
        if (typeof document === "undefined")
            return;
        lastActiveElementRef.current =
            typeof document !== "undefined"
                ? document.activeElement
                : null;
        const t = window.setTimeout(() => {
            detailsCloseRef.current?.focus?.();
            if (document.activeElement === lastActiveElementRef.current) {
                detailsOverlayRef.current?.focus?.();
            }
        }, 0);
        return () => {
            window.clearTimeout(t);
            lastActiveElementRef.current?.focus?.();
            lastActiveElementRef.current = null;
        };
    }, [detailsAgent]);
    const installationStateByServiceId = useMemo(() => {
        const map = new Map();
        const rank = (state) => {
            switch (state) {
                case "uninstalling":
                    return 3;
                case "provisioning":
                    return 2;
                case "installed":
                    return 1;
                default:
                    return 0;
            }
        };
        for (const installation of installations) {
            const isPendingRevocation = installation.revocationPending === true ||
                installation.rawStatus === "pending_revocation";
            const isPendingWebhook = installation.rawStatus === "pending_webhook";
            const isRevoked = installation.status === "revoked" && !isPendingRevocation;
            if (isRevoked) {
                continue;
            }
            const nextState = isPendingRevocation
                ? "uninstalling"
                : isPendingWebhook
                    ? "provisioning"
                    : "installed";
            const existing = map.get(installation.agentServiceId) ?? "none";
            if (rank(nextState) <= rank(existing)) {
                continue;
            }
            map.set(installation.agentServiceId, nextState);
        }
        return map;
    }, [installations]);
    // Filter agents
    const filteredAgents = useMemo(() => {
        let result = agents;
        if (featuredOnly) {
            result = result.filter((a) => a.featured);
        }
        if (selectedCategory) {
            result = result.filter((a) => a.category === selectedCategory);
        }
        if (limit) {
            result = result.slice(0, limit);
        }
        return result;
    }, [agents, selectedCategory, featuredOnly, limit]);
    // Get unique categories from available agents
    const availableCategories = useMemo(() => {
        const cats = new Set(agents.map((a) => a.category));
        return Array.from(cats).sort();
    }, [agents]);
    const feedHealth = useMemo(() => {
        if (installationsFreshness?.isStale) {
            return { label: "Stale", variant: "destructive" };
        }
        if (realtime.status === "connected") {
            return { label: "Live", variant: "success" };
        }
        if (realtime.status === "connecting") {
            return { label: "Connecting", variant: "secondary" };
        }
        if (realtime.status === "disabled") {
            return { label: "Polling", variant: "secondary" };
        }
        return { label: "Reconnecting", variant: "secondary" };
    }, [installationsFreshness?.isStale, realtime.status]);
    const showRealtimeFallbackNotice = realtime.status !== "connected" && realtime.status !== "disabled";
    const realtimeFallbackReason = realtime.status === "error" && realtime.lastError
        ? ` (${realtime.lastError})`
        : "";
    const getInstallState = useCallback((agent) => {
        return installationStateByServiceId.get(agent.agentServiceId) ?? "none";
    }, [installationStateByServiceId]);
    const handleRefresh = useCallback(() => {
        refresh();
    }, [refresh]);
    const handleInstallComplete = useCallback(() => {
        refreshInstallations();
        refresh();
        setInstallingAgent(null);
    }, [refresh, refreshInstallations]);
    const openDetails = useCallback((agent) => {
        if (onViewDetails) {
            onViewDetails(agent);
            return;
        }
        setDetailsAgent(agent);
    }, [onViewDetails]);
    const handleInstallClick = useCallback((agent) => {
        if (onInstall) {
            onInstall(agent);
            return;
        }
        if (enableInstallFlow) {
            const installState = getInstallState(agent);
            if (installState !== "none") {
                return;
            }
            setInstallingAgent(agent);
        }
    }, [onInstall, enableInstallFlow, getInstallState]);
    const { isInitialLoading, isRefreshing } = useRefreshState(isLoading, agents.length > 0);
    const installingAgentState = useMemo(() => {
        if (!installingAgent)
            return "none";
        return getInstallState(installingAgent);
    }, [getInstallState, installingAgent]);
    useEffect(() => {
        if (!installingAgent)
            return;
        if (installingAgentState !== "none") {
            setInstallingAgent(null);
        }
    }, [installingAgent, installingAgentState]);
    if (isInitialLoading) {
        return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-32" }), _jsx(Skeleton, { className: "h-4 w-48 mt-2" })] }), _jsxs(CardContent, { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-20 w-full" }), _jsx(Skeleton, { className: "h-20 w-full" }), _jsx(Skeleton, { className: "h-20 w-full" })] })] }));
    }
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Store, { className: "h-5 w-5" }), "Agent Marketplace", _jsx(Badge, { variant: feedHealth.variant, children: feedHealth.label })] }), description: _jsx(CardDescription, { children: "Available agents for your account." }), actions: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { variant: "outline", size: "icon-sm", onClick: handleRefresh, disabled: isRefreshing, "aria-label": "Refresh marketplace", children: _jsx(RefreshCw, { className: `h-4 w-4 ${isRefreshing ? "animate-spin" : ""}` }) }) }) }), _jsx(TooltipContent, { children: "Refresh marketplace" })] }) }) }), _jsxs(CardContent, { className: "space-y-4", children: [showRealtimeFallbackNotice ? (_jsxs("div", { className: "rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900", children: ["Realtime connection is unavailable", realtimeFallbackReason, "; polling fallback", resolvedAutoRefreshMs
                                    ? ` every ${Math.max(1, Math.round(resolvedAutoRefreshMs / 1000))}s`
                                    : " is disabled", "."] })) : null, availableCategories.length > 1 && (_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: selectedCategory === undefined ? "default" : "outline", size: "sm", onClick: () => setSelectedCategory(undefined), children: "All" }), availableCategories.map((cat) => (_jsxs(Button, { variant: selectedCategory === cat ? "default" : "outline", size: "sm", onClick: () => setSelectedCategory(cat), children: [categoryIcons[cat], _jsx("span", { className: "ml-1", children: categoryLabels[cat] || cat })] }, cat)))] })), error && (_jsxs("div", { className: "text-sm text-destructive py-4 text-center", children: ["Failed to load marketplace: ", formatMarketplaceError(error)] })), !error && filteredAgents.length === 0 && (_jsx("div", { className: "text-sm text-muted-foreground py-8 text-center", children: "No agents available in the marketplace." })), !error && filteredAgents.length > 0 && (_jsx("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2", children: filteredAgents.map((agent) => {
                                const installState = getInstallState(agent);
                                const isInstalled = installState === "installed";
                                const isUninstalling = installState === "uninstalling";
                                const isProvisioning = installState === "provisioning";
                                const icon = agent.iconUrl ?? agent.avatarUrl;
                                return (_jsxs("div", { className: "flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm", children: [_jsx("div", { className: "h-28 w-full overflow-hidden bg-muted", children: agent.bannerUrl ? (_jsx("img", { src: agent.bannerUrl, alt: `${agent.displayName} banner`, className: "h-full w-full object-cover object-left" })) : (_jsx("div", { className: "flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted/60 to-muted/30", children: _jsx("div", { className: "rounded-full bg-background/60 p-2 text-muted-foreground/80", children: categoryIcons[agent.category] || _jsx(Zap, { className: "h-6 w-6" }) }) })) }), _jsxs("div", { className: "flex flex-1 flex-col gap-3 p-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden", children: icon ? (_jsx("img", { src: icon, alt: agent.displayName, className: "h-11 w-11 object-cover" })) : (categoryIcons[agent.category] || _jsx(Zap, { className: "h-5 w-5 text-muted-foreground" })) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium truncate max-w-[24ch]", children: agent.displayName }), agent.featured && (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Featured" })), isInstalled ? (_jsx(Badge, { variant: "success", className: "text-xs", children: "Installed" })) : isUninstalling ? (_jsx(Badge, { variant: "warn", className: "text-xs", children: "Uninstalling" })) : isProvisioning ? (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Provisioning" })) : null] }), _jsx("p", { className: "text-sm text-muted-foreground line-clamp-3 mt-1", children: agent.description || "No description available." })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1", children: [categoryIcons[agent.category], categoryLabels[agent.category] || agent.category] }), _jsx("span", { children: agent.feeSummary
                                                                ? `Platform ${formatBps(agent.feeSummary.platformFeeBps)} • Tenant ${formatBps(agent.feeSummary.tenantFeeBps)}`
                                                                : "Fees unavailable" }), _jsxs("span", { children: [agent.installCount.toLocaleString(), " installs"] })] }), _jsxs("div", { className: "mt-auto grid grid-cols-1 gap-2", children: [_jsx(Button, { className: "w-full", variant: "outline", size: "sm", onClick: () => openDetails(agent), children: "Details" }), isInstalled ? (_jsx(Button, { className: "w-full", variant: "outline", size: "sm", disabled: true, children: "Installed" })) : isUninstalling ? (_jsx(Button, { className: "w-full", variant: "outline", size: "sm", disabled: true, children: "Uninstalling" })) : isProvisioning ? (_jsx(Button, { className: "w-full", variant: "outline", size: "sm", disabled: true, children: "Provisioning" })) : (_jsx(Button, { className: "w-full", variant: "default", size: "sm", onClick: () => handleInstallClick(agent), children: "Install" }))] })] })] }, agent.id));
                            }) }))] }), detailsAgent && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4", role: "dialog", "aria-modal": "true", "aria-labelledby": detailsTitleIdRef.current, "aria-describedby": detailsDescriptionIdRef.current, onMouseDown: (e) => {
                        // close when clicking backdrop
                        if (e.target === e.currentTarget)
                            setDetailsAgent(null);
                    }, onKeyDown: (e) => {
                        if (e.key === "Escape")
                            setDetailsAgent(null);
                        trapFocusWithin(e, detailsPanelRef.current);
                    }, tabIndex: -1, ref: detailsOverlayRef, children: _jsxs("div", { ref: detailsPanelRef, className: "w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden overflow-y-auto rounded-lg border bg-background shadow-lg", children: [detailsAgent.bannerUrl ? (_jsx("div", { className: "w-full bg-muted aspect-[1178/192]", children: _jsx("img", { src: detailsAgent.bannerUrl, alt: `${detailsAgent.displayName} banner`, className: "h-full w-full object-contain" }) })) : (_jsx("div", { className: "w-full bg-muted aspect-[1178/192]" })), _jsx("div", { className: "p-4 sm:p-6", children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "-mt-10 h-16 w-16 rounded-xl border bg-muted shrink-0 overflow-hidden", children: (detailsAgent.iconUrl ?? detailsAgent.avatarUrl) ? (_jsx("img", { src: detailsAgent.iconUrl ?? detailsAgent.avatarUrl ?? "", alt: detailsAgent.displayName, className: "h-16 w-16 object-cover" })) : (_jsx("div", { className: "h-16 w-16 flex items-center justify-center", children: categoryIcons[detailsAgent.category] || _jsx(Zap, { className: "h-6 w-6 text-muted-foreground" }) })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { id: detailsTitleIdRef.current, className: "text-lg font-semibold truncate", children: detailsAgent.displayName }), detailsAgent.featured && (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Featured" }))] }), _jsxs("div", { className: "mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3", children: [_jsxs("span", { className: "flex items-center gap-1", children: [categoryIcons[detailsAgent.category], categoryLabels[detailsAgent.category] || detailsAgent.category] }), _jsx("span", { children: detailsAgent.feeSummary
                                                                                ? `Platform ${formatBps(detailsAgent.feeSummary.platformFeeBps)} • Tenant ${formatBps(detailsAgent.feeSummary.tenantFeeBps)}`
                                                                                : "Fees unavailable" }), _jsxs("span", { children: [detailsAgent.installCount.toLocaleString(), " installs"] })] })] }), _jsx(Button, { ref: detailsCloseRef, variant: "outline", size: "sm", onClick: () => setDetailsAgent(null), "aria-label": "Close agent details", children: "Close" })] }), _jsx("p", { id: detailsDescriptionIdRef.current, className: "mt-3 text-sm text-muted-foreground", children: detailsAgent.description || "No description available." }), _jsxs("div", { className: "mt-4 grid grid-cols-1 gap-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Network" }), _jsx("span", { className: "font-medium text-right", children: detailsAgent.network?.name ?? "Not specified" })] }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Operating token" }), _jsx("span", { className: "font-medium text-right", children: detailsAgent.operatingToken?.symbol ?? "Not specified" })] }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Minimum budget" }), _jsx("span", { className: "font-mono text-right", children: (() => {
                                                                        const min = detailsAgent.minimumBudget;
                                                                        if (!min)
                                                                            return "Not specified";
                                                                        const decimals = detailsAgent.operatingToken?.decimals;
                                                                        const symbol = detailsAgent.operatingToken?.symbol;
                                                                        if (decimals === undefined || decimals === null)
                                                                            return min;
                                                                        try {
                                                                            const formatted = formatUnits(min, decimals);
                                                                            return symbol ? `${formatted} ${symbol}` : formatted;
                                                                        }
                                                                        catch {
                                                                            return min;
                                                                        }
                                                                    })() })] }), detailsAgent.feeSummary ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Platform fee" }), _jsx("span", { className: "font-medium text-right", children: formatBps(detailsAgent.feeSummary.platformFeeBps) })] }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Tenant fee" }), _jsx("span", { className: "font-medium text-right", children: formatBps(detailsAgent.feeSummary.tenantFeeBps) })] }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Total fee" }), _jsx("span", { className: "font-medium text-right", children: formatBps(detailsAgent.feeSummary.totalFeeBps) })] })] })) : (_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Fees" }), _jsx("span", { className: "font-medium text-right", children: "Not specified" })] }))] }), detailsAgent.tags && detailsAgent.tags.length > 0 ? (_jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: detailsAgent.tags.map((t) => (_jsx(Badge, { variant: "secondary", className: "text-xs", children: t }, t))) })) : null, (detailsAgent.publisherName ||
                                                    detailsAgent.publisherUrl ||
                                                    detailsAgent.contactEmail ||
                                                    detailsAgent.supportUrl ||
                                                    detailsAgent.privacyPolicyUrl ||
                                                    detailsAgent.termsUrl) ? (_jsx("div", { className: "mt-4 rounded-lg border p-3 text-sm", children: _jsxs("div", { className: "grid grid-cols-1 gap-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Publisher" }), _jsx("span", { className: "font-medium text-right", children: detailsAgent.publisherName ??
                                                                            detailsAgent.publisherUrl ??
                                                                            "Not specified" })] }), detailsAgent.contactEmail ? (_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Contact" }), _jsx("span", { className: "font-medium text-right", children: detailsAgent.contactEmail })] })) : null, _jsxs("div", { className: "flex flex-wrap gap-x-4 gap-y-1", children: [detailsAgent.publisherUrl ? (_jsx("a", { href: detailsAgent.publisherUrl, target: "_blank", rel: "noreferrer", className: "underline underline-offset-4 text-muted-foreground hover:text-foreground", children: "Website" })) : null, detailsAgent.supportUrl ? (_jsx("a", { href: detailsAgent.supportUrl, target: "_blank", rel: "noreferrer", className: "underline underline-offset-4 text-muted-foreground hover:text-foreground", children: "Support" })) : null, detailsAgent.privacyPolicyUrl ? (_jsx("a", { href: detailsAgent.privacyPolicyUrl, target: "_blank", rel: "noreferrer", className: "underline underline-offset-4 text-muted-foreground hover:text-foreground", children: "Privacy" })) : null, detailsAgent.termsUrl ? (_jsx("a", { href: detailsAgent.termsUrl, target: "_blank", rel: "noreferrer", className: "underline underline-offset-4 text-muted-foreground hover:text-foreground", children: "Terms" })) : null] })] }) })) : null, detailsAgent.releaseNotes ? (_jsxs("div", { className: "mt-4 rounded-lg border p-3 text-sm", children: [_jsx("div", { className: "text-muted-foreground text-xs mb-1", children: "Release notes" }), _jsx("div", { className: "whitespace-pre-wrap", children: detailsAgent.releaseNotes })] })) : null, _jsx("div", { className: "mt-5 flex justify-end gap-2", children: (() => {
                                                        const installState = getInstallState(detailsAgent);
                                                        const isInstalled = installState === "installed";
                                                        const isUninstalling = installState === "uninstalling";
                                                        const isProvisioning = installState === "provisioning";
                                                        const canInstall = Boolean(onInstall) || enableInstallFlow;
                                                        return (_jsxs(_Fragment, { children: [!isInstalled && !isUninstalling && !isProvisioning ? (_jsx(Button, { size: "sm", onClick: () => {
                                                                        if (!canInstall)
                                                                            return;
                                                                        const agentToInstall = detailsAgent;
                                                                        setDetailsAgent(null);
                                                                        handleInstallClick(agentToInstall);
                                                                    }, disabled: !canInstall, children: "Install" })) : (_jsx(Button, { size: "sm", variant: "outline", disabled: true, children: isInstalled
                                                                        ? "Installed"
                                                                        : isUninstalling
                                                                            ? "Uninstalling"
                                                                            : "Provisioning" })), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setDetailsAgent(null), children: "Done" })] }));
                                                    })() })] })] }) })] }) })), _jsx(Dialog, { open: Boolean(installingAgent), onOpenChange: (open) => {
                        if (!open)
                            setInstallingAgent(null);
                    }, children: _jsxs(DialogContent, { className: "sm:max-w-md p-0 overflow-hidden overflow-y-auto", onInteractOutside: (event) => event.preventDefault(), onEscapeKeyDown: (event) => event.preventDefault(), children: [_jsx(DialogTitle, { className: "sr-only", children: installDialogTitle }), installingAgent && (_jsx(AgentInstallFlow, { agent: installingAgent, onComplete: handleInstallComplete, onCancel: () => setInstallingAgent(null) }))] }) })] }) }));
}
