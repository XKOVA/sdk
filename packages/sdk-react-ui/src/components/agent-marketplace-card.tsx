"use client";

import { useMarketplaceAgents, useMyAgentInstallations, useRealtimeStatus } from "@xkova/sdk-react";
import { MarketplaceAgent, SDKError } from "@xkova/sdk-core";
import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
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
const categoryIcons: Record<string, ReactNode> = {
  trading: <TrendingUp className="h-4 w-4" />,
  payments: <CreditCard className="h-4 w-4" />,
  ecommerce: <ShoppingCart className="h-4 w-4" />,
  defi: <Zap className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  notifications: <Bell className="h-4 w-4" />,
};

/** Category label mapping */
const categoryLabels: Record<string, string> = {
  trading: "Trading",
  payments: "Payments",
  ecommerce: "E-Commerce",
  defi: "DeFi",
  analytics: "Analytics",
  notifications: "Notifications",
};

const formatBps = (bps?: number | null) => {
  if (typeof bps !== "number" || !Number.isFinite(bps)) return "Not specified";
  return `${(bps / 100).toFixed(2)}%`;
};

type InstallState = "installed" | "uninstalling" | "provisioning" | "none";

const formatMarketplaceError = (err: Error | null): string => {
  if (!err) return "";
  if (err instanceof SDKError && err.code === "unauthorized") {
    return "Session expired. Please sign in again.";
  }
  const code = (err as any)?.code;
  if (code === "unauthorized") {
    return "Session expired. Please sign in again.";
  }
  const message =
    typeof err.message === "string" && err.message.trim()
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
function formatUnits(value: string, decimals: number): string {
  const v = BigInt(value || "0");
  if (decimals <= 0) return v.toString();
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

/**
 * Props for {@link AgentMarketplaceCard}.
 *
 * @remarks
 * Purpose:
 * - Configure filters and callbacks for marketplace catalog UI.
 *
 * When to use:
 * - Use when customizing catalog filters or install flows.
 *
 * When not to use:
 * - Do not pass sensitive data into callbacks.
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
 * - `limit` is applied after filtering when provided.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react marketplace hooks.
 */
export interface AgentMarketplaceCardProps {
  /** Filter by category */
  category?: string;
  /** Maximum number of agents to show */
  limit?: number;
  /** Polling fallback interval for installations in ms (<= 0 disables). Default: 30000 when realtime is unavailable. */
  autoRefreshMs?: number;
  /** Called when user clicks Install on an agent */
  onInstall?: (agent: MarketplaceAgent) => void;
  /** Called when user clicks View Details on an agent */
  onViewDetails?: (agent: MarketplaceAgent) => void;
  /** Show only featured agents */
  featuredOnly?: boolean;
  /** If true and onInstall is not provided, AgentMarketplaceCard will show the built-in install flow modal. */
  enableInstallFlow?: boolean;
  /** Title for the install modal (visually hidden, for a11y). */
  installDialogTitle?: string;
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
export function AgentMarketplaceCard({
  category,
  limit,
  autoRefreshMs,
  onInstall,
  onViewDetails,
  featuredOnly = false,
  enableInstallFlow = false,
  installDialogTitle = "Install Agent",
}: AgentMarketplaceCardProps) {
  const { agents, isLoading, error, refresh } = useMarketplaceAgents();
  const realtime = useRealtimeStatus();
  const installationsAutoRefreshMs =
    autoRefreshMs === undefined ? DEFAULT_AGENT_INSTALLATIONS_POLL_MS : autoRefreshMs;
  const resolvedAutoRefreshMs = useMemo(() => {
    if (!installationsAutoRefreshMs || installationsAutoRefreshMs <= 0) {
      return undefined;
    }
    return realtime.status === "connected" ? undefined : installationsAutoRefreshMs;
  }, [installationsAutoRefreshMs, realtime.status]);
  const {
    installations,
    refresh: refreshInstallations,
    freshness: installationsFreshness,
  } = useMyAgentInstallations({
    autoRefreshMs: resolvedAutoRefreshMs,
  });
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(category);
  const [detailsAgent, setDetailsAgent] = useState<MarketplaceAgent | null>(null);
  const [installingAgent, setInstallingAgent] = useState<MarketplaceAgent | null>(null);
  const detailsOverlayRef = useRef<HTMLDivElement | null>(null);
  const detailsPanelRef = useRef<HTMLDivElement | null>(null);
  const detailsCloseRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const detailsTitleIdRef = useRef(`xkova-agent-details-title-${Math.random().toString(36).slice(2)}`);
  const detailsDescriptionIdRef = useRef(`xkova-agent-details-desc-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!detailsAgent) return;
    if (typeof document === "undefined") return;

    lastActiveElementRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
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
    const map = new Map<string, InstallState>();
    const rank = (state: InstallState) => {
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
      const isPendingRevocation =
        installation.revocationPending === true ||
        installation.rawStatus === "pending_revocation";
      const isPendingWebhook = installation.rawStatus === "pending_webhook";
      const isRevoked = installation.status === "revoked" && !isPendingRevocation;
      if (isRevoked) {
        continue;
      }

      const nextState: InstallState = isPendingRevocation
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
      return { label: "Stale", variant: "destructive" as const };
    }
    if (realtime.status === "connected") {
      return { label: "Live", variant: "success" as const };
    }
    if (realtime.status === "connecting") {
      return { label: "Connecting", variant: "secondary" as const };
    }
    if (realtime.status === "disabled") {
      return { label: "Polling", variant: "secondary" as const };
    }
    return { label: "Reconnecting", variant: "secondary" as const };
  }, [installationsFreshness?.isStale, realtime.status]);
  const showRealtimeFallbackNotice =
    realtime.status !== "connected" && realtime.status !== "disabled";
  const realtimeFallbackReason =
    realtime.status === "error" && realtime.lastError
      ? ` (${realtime.lastError})`
      : "";

  const getInstallState = useCallback(
    (agent: MarketplaceAgent): InstallState => {
      return installationStateByServiceId.get(agent.agentServiceId) ?? "none";
    },
    [installationStateByServiceId],
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleInstallComplete = useCallback(() => {
    refreshInstallations();
    refresh();
    setInstallingAgent(null);
  }, [refresh, refreshInstallations]);

  const openDetails = useCallback(
    (agent: MarketplaceAgent) => {
      if (onViewDetails) {
        onViewDetails(agent);
        return;
      }
      setDetailsAgent(agent);
    },
    [onViewDetails]
  );

  const handleInstallClick = useCallback(
    (agent: MarketplaceAgent) => {
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
    },
    [onInstall, enableInstallFlow, getInstallState],
  );

  const { isInitialLoading, isRefreshing } = useRefreshState(
    isLoading,
    agents.length > 0,
  );

  const installingAgentState = useMemo(() => {
    if (!installingAgent) return "none";
    return getInstallState(installingAgent);
  }, [getInstallState, installingAgent]);

  useEffect(() => {
    if (!installingAgent) return;
    if (installingAgentState !== "none") {
      setInstallingAgent(null);
    }
  }, [installingAgent, installingAgentState]);

  if (isInitialLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardHeader>
          <CardHeaderRow
            title={
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Agent Marketplace
                <Badge variant={feedHealth.variant as any}>{feedHealth.label}</Badge>
              </CardTitle>
            }
            description={<CardDescription>Available agents for your account.</CardDescription>}
            actions={
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      aria-label="Refresh marketplace"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Refresh marketplace</TooltipContent>
              </Tooltip>
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {showRealtimeFallbackNotice ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Realtime connection is unavailable{realtimeFallbackReason}; polling fallback
              {resolvedAutoRefreshMs
                ? ` every ${Math.max(1, Math.round(resolvedAutoRefreshMs / 1000))}s`
                : " is disabled"}
              .
            </div>
          ) : null}

          {/* Category Filter */}
          {availableCategories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === undefined ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(undefined)}
              >
                All
              </Button>
              {availableCategories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {categoryIcons[cat]}
                  <span className="ml-1">{categoryLabels[cat] || cat}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-sm text-destructive py-4 text-center">
              Failed to load marketplace: {formatMarketplaceError(error)}
            </div>
          )}

          {/* Empty State */}
          {!error && filteredAgents.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No agents available in the marketplace.
            </div>
          )}

          {/* Agent List */}
          {!error && filteredAgents.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
              {filteredAgents.map((agent) => {
                const installState = getInstallState(agent);
                const isInstalled = installState === "installed";
                const isUninstalling = installState === "uninstalling";
                const isProvisioning = installState === "provisioning";
                const icon = agent.iconUrl ?? agent.avatarUrl;

                return (
                  <div
                    key={agent.id}
                    className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
                  >
                    {/* Banner */}
                    <div className="h-28 w-full overflow-hidden bg-muted">
                      {agent.bannerUrl ? (
                        <img
                          src={agent.bannerUrl}
                          alt={`${agent.displayName} banner`}
                          className="h-full w-full object-cover object-left"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted/60 to-muted/30">
                          <div className="rounded-full bg-background/60 p-2 text-muted-foreground/80">
                            {categoryIcons[agent.category] || <Zap className="h-6 w-6" />}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {icon ? (
                            <img
                              src={icon}
                              alt={agent.displayName}
                              className="h-11 w-11 object-cover"
                            />
                          ) : (
                            categoryIcons[agent.category] || <Zap className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium truncate max-w-[24ch]">
                              {agent.displayName}
                            </span>
                            {agent.featured && (
                              <Badge variant="secondary" className="text-xs">
                                Featured
                              </Badge>
                            )}
                            {isInstalled ? (
                              <Badge variant="success" className="text-xs">
                                Installed
                              </Badge>
                            ) : isUninstalling ? (
                              <Badge variant="warn" className="text-xs">
                                Uninstalling
                              </Badge>
                            ) : isProvisioning ? (
                              <Badge variant="secondary" className="text-xs">
                                Provisioning
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                            {agent.description || "No description available."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {categoryIcons[agent.category]}
                          {categoryLabels[agent.category] || agent.category}
                        </span>
                        <span>
                          {agent.feeSummary
                            ? `Platform ${formatBps(agent.feeSummary.platformFeeBps)} • Tenant ${formatBps(agent.feeSummary.tenantFeeBps)}`
                            : "Fees unavailable"}
                        </span>
                        <span>{agent.installCount.toLocaleString()} installs</span>
                      </div>

                      {/* Actions */}
                      <div className="mt-auto grid grid-cols-1 gap-2">
                        <Button
                          className="w-full"
                          variant="outline"
                          size="sm"
                          onClick={() => openDetails(agent)}
                        >
                          Details
                        </Button>
                        {isInstalled ? (
                          <Button className="w-full" variant="outline" size="sm" disabled>
                            Installed
                          </Button>
                        ) : isUninstalling ? (
                          <Button className="w-full" variant="outline" size="sm" disabled>
                            Uninstalling
                          </Button>
                        ) : isProvisioning ? (
                          <Button className="w-full" variant="outline" size="sm" disabled>
                            Provisioning
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            variant="default"
                            size="sm"
                            onClick={() => handleInstallClick(agent)}
                          >
                            Install
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Details Modal (keeps install flow lean) */}
        {detailsAgent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailsTitleIdRef.current}
            aria-describedby={detailsDescriptionIdRef.current}
            onMouseDown={(e) => {
              // close when clicking backdrop
              if (e.target === e.currentTarget) setDetailsAgent(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDetailsAgent(null);
              trapFocusWithin(e, detailsPanelRef.current);
            }}
            tabIndex={-1}
            ref={detailsOverlayRef}
          >
            <div
              ref={detailsPanelRef}
              className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden overflow-y-auto rounded-lg border bg-background shadow-lg"
            >
              {/* Banner */}
              {detailsAgent.bannerUrl ? (
                <div className="w-full bg-muted aspect-[1178/192]">
                  <img
                    src={detailsAgent.bannerUrl}
                    alt={`${detailsAgent.displayName} banner`}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-full bg-muted aspect-[1178/192]" />
              )}

              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="-mt-10 h-16 w-16 rounded-xl border bg-muted shrink-0 overflow-hidden">
                    {(detailsAgent.iconUrl ?? detailsAgent.avatarUrl) ? (
                      <img
                        src={detailsAgent.iconUrl ?? detailsAgent.avatarUrl ?? ""}
                        alt={detailsAgent.displayName}
                        className="h-16 w-16 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 flex items-center justify-center">
                        {categoryIcons[detailsAgent.category] || <Zap className="h-6 w-6 text-muted-foreground" />}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 id={detailsTitleIdRef.current} className="text-lg font-semibold truncate">
                            {detailsAgent.displayName}
                          </h3>
                          {detailsAgent.featured && (
                            <Badge variant="secondary" className="text-xs">
                              Featured
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            {categoryIcons[detailsAgent.category]}
                            {categoryLabels[detailsAgent.category] || detailsAgent.category}
                          </span>
                          <span>
                            {detailsAgent.feeSummary
                              ? `Platform ${formatBps(detailsAgent.feeSummary.platformFeeBps)} • Tenant ${formatBps(detailsAgent.feeSummary.tenantFeeBps)}`
                              : "Fees unavailable"}
                          </span>
                          <span>{detailsAgent.installCount.toLocaleString()} installs</span>
                        </div>
                      </div>
                      <Button
                        ref={detailsCloseRef}
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailsAgent(null)}
                        aria-label="Close agent details"
                      >
                        Close
                      </Button>
                    </div>

                    <p id={detailsDescriptionIdRef.current} className="mt-3 text-sm text-muted-foreground">
                      {detailsAgent.description || "No description available."}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Network</span>
                        <span className="font-medium text-right">
                          {detailsAgent.network?.name ?? "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Operating token</span>
                        <span className="font-medium text-right">
                          {detailsAgent.operatingToken?.symbol ?? "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Minimum budget</span>
                        <span className="font-mono text-right">
                          {(() => {
                            const min = detailsAgent.minimumBudget;
                            if (!min) return "Not specified";
                            const decimals = detailsAgent.operatingToken?.decimals;
                            const symbol = detailsAgent.operatingToken?.symbol;
                            if (decimals === undefined || decimals === null) return min;
                            try {
                              const formatted = formatUnits(min, decimals);
                              return symbol ? `${formatted} ${symbol}` : formatted;
                            } catch {
                              return min;
                            }
                          })()}
                        </span>
                      </div>
                      {detailsAgent.feeSummary ? (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Platform fee</span>
                            <span className="font-medium text-right">
                              {formatBps(detailsAgent.feeSummary.platformFeeBps)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Tenant fee</span>
                            <span className="font-medium text-right">
                              {formatBps(detailsAgent.feeSummary.tenantFeeBps)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Total fee</span>
                            <span className="font-medium text-right">
                              {formatBps(detailsAgent.feeSummary.totalFeeBps)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Fees</span>
                          <span className="font-medium text-right">Not specified</span>
                        </div>
                      )}
                    </div>

                    {detailsAgent.tags && detailsAgent.tags.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {detailsAgent.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    {(detailsAgent.publisherName ||
                      detailsAgent.publisherUrl ||
                      detailsAgent.contactEmail ||
                      detailsAgent.supportUrl ||
                      detailsAgent.privacyPolicyUrl ||
                      detailsAgent.termsUrl) ? (
                      <div className="mt-4 rounded-lg border p-3 text-sm">
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Publisher</span>
                            <span className="font-medium text-right">
                              {detailsAgent.publisherName ??
                                detailsAgent.publisherUrl ??
                                "Not specified"}
                            </span>
                          </div>
                          {detailsAgent.contactEmail ? (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Contact</span>
                              <span className="font-medium text-right">
                                {detailsAgent.contactEmail}
                              </span>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {detailsAgent.publisherUrl ? (
                              <a
                                href={detailsAgent.publisherUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                              >
                                Website
                              </a>
                            ) : null}
                            {detailsAgent.supportUrl ? (
                              <a
                                href={detailsAgent.supportUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                              >
                                Support
                              </a>
                            ) : null}
                            {detailsAgent.privacyPolicyUrl ? (
                              <a
                                href={detailsAgent.privacyPolicyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                              >
                                Privacy
                              </a>
                            ) : null}
                            {detailsAgent.termsUrl ? (
                              <a
                                href={detailsAgent.termsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                              >
                                Terms
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {detailsAgent.releaseNotes ? (
                      <div className="mt-4 rounded-lg border p-3 text-sm">
                        <div className="text-muted-foreground text-xs mb-1">Release notes</div>
                        <div className="whitespace-pre-wrap">{detailsAgent.releaseNotes}</div>
                      </div>
                    ) : null}

                    <div className="mt-5 flex justify-end gap-2">
                      {(() => {
                        const installState = getInstallState(detailsAgent);
                        const isInstalled = installState === "installed";
                        const isUninstalling = installState === "uninstalling";
                        const isProvisioning = installState === "provisioning";
                        const canInstall = Boolean(onInstall) || enableInstallFlow;
                        return (
                          <>
                            {!isInstalled && !isUninstalling && !isProvisioning ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!canInstall) return;
                                  const agentToInstall = detailsAgent;
                                  setDetailsAgent(null);
                                  handleInstallClick(agentToInstall);
                                }}
                                disabled={!canInstall}
                              >
                                Install
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled>
                                {isInstalled
                                  ? "Installed"
                                  : isUninstalling
                                    ? "Uninstalling"
                                    : "Provisioning"}
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => setDetailsAgent(null)}>
                              Done
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Install Flow Modal (optional) */}
        <Dialog
          open={Boolean(installingAgent)}
          onOpenChange={(open) => {
            if (!open) setInstallingAgent(null);
          }}
        >
          <DialogContent
            className="sm:max-w-md p-0 overflow-hidden overflow-y-auto"
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <DialogTitle className="sr-only">{installDialogTitle}</DialogTitle>
            {installingAgent && (
              <AgentInstallFlow
                agent={installingAgent}
                onComplete={handleInstallComplete}
                onCancel={() => setInstallingAgent(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  );
}
