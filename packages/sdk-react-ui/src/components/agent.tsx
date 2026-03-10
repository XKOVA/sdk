"use client";

import {
  useAgentInstallationActions,
  useIeeContext,
  useIeeReceiptAction,
  useMarketplaceAgents,
  useMyAgentInstallations,
  useRealtimeStatus,
  useTenantConfig,
} from "@xkova/sdk-react";
import { SDKError, type AgentInstallationDetails, type MarketplaceAgent } from "@xkova/sdk-core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  DollarSign,
  Info,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import { AgentInstallFlow } from "./agent-install-flow.js";
import { AgentActionsMenu } from "./agent-actions-menu.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow } from "./ui/card-layout.js";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.js";
import { Input } from "./ui/input.js";
import { Skeleton } from "./ui/skeleton.js";
import { useRefreshState } from "./use-refresh-state.js";
import { toastError } from "../toast-utils.js";
import { DEFAULT_AGENT_INSTALLATIONS_POLL_MS } from "./agent-polling.js";

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

const formatAgentLoadError = (err: Error | null): string => {
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
      : "Failed to load agent.";
  return message;
};

type BudgetAction = "none" | "increase" | "decrease";
type InstallationOperatingTokenSnapshot = {
  tokenPoolId: string;
  symbol: string | null;
  name: string | null;
  contract: string | null;
  decimals: number | null;
  isStable?: boolean | null;
  networkPoolId?: string | null;
  logoUrl?: string | null;
  minimumBudget?: string | null;
};
type InstallationWithTokenBudgets = AgentInstallationDetails & {
  availableOperatingTokens?: InstallationOperatingTokenSnapshot[] | null;
  tokenSymbolsByTokenPoolId?: Record<string, string> | null;
  tokenBudgetsByTokenPoolId?: Record<string, string> | null;
  tokenBudgetUsedByTokenPoolId?: Record<string, string> | null;
  transactionCountByTokenPoolId?: Record<string, number> | null;
};

const safeBigInt = (v: string): bigint => {
  const raw = (v ?? "0").toString();
  const normalized = raw.includes(".") ? raw.split(".")[0] : raw;
  try {
    return BigInt(normalized || "0");
  } catch {
    return 0n;
  }
};

const parseTokenAmountToBaseUnits = (value: string, decimals: number): bigint => {
  const raw = (value ?? "").trim();
  if (!raw) return 0n;
  if (raw.startsWith("-")) throw new Error("Amount must be positive");
  if (!decimals || decimals <= 0) return BigInt(raw);

  const [wholeRaw, fracRaw = ""] = raw.split(".");
  const whole = wholeRaw === "" ? 0n : BigInt(wholeRaw);
  const fracTrimmed = fracRaw.slice(0, decimals);
  const fracPadded = fracTrimmed.padEnd(decimals, "0");
  const frac = fracPadded === "" ? 0n : BigInt(fracPadded);
  const base = 10n ** BigInt(decimals);
  return whole * base + frac;
};

const formatUnits = (value: string, decimals: number): string => {
  const v = safeBigInt(value);
  if (!decimals || decimals <= 0) return v.toString();
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
};

const toFixedDisplay = (value: string, decimals: number, maxFractionDigits = 2): string => {
  const formatted = formatUnits(value, decimals);
  const [w, f = ""] = formatted.split(".");
  if (maxFractionDigits <= 0) return w;
  if (!f) return `${w}.00`.slice(0, w.length + 1 + maxFractionDigits);
  const trimmed = f.slice(0, maxFractionDigits).padEnd(maxFractionDigits, "0");
  return `${w}.${trimmed}`;
};

const toUsageDisplay = (value: string, decimals: number): string => {
  const fixed2 = toFixedDisplay(value, decimals, 2);
  if (safeBigInt(value) <= 0n) return fixed2;
  if (fixed2 !== "0.00") return fixed2;
  const formatted = formatUnits(value, decimals);
  const [w, f = ""] = formatted.split(".");
  if (!f) return fixed2;
  const maxFractionDigits = Math.max(2, Math.min(decimals, 8));
  const clipped = f.slice(0, maxFractionDigits).replace(/0+$/, "");
  return clipped ? `${w}.${clipped}` : fixed2;
};

const getBudgetColor = (percentage: number) => {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 80) return "bg-orange-500";
  if (percentage >= 70) return "bg-yellow-500";
  return "bg-emerald-500";
};

const isValidTxHash = (value: string) => /^0x[a-fA-F0-9]{64}$/.test(value);

/**
 * Props for {@link Agent}.
 *
 * @remarks
 * Purpose:
 * - Render a single marketplace agent card by ID with installed/uninstalled layouts.
 *
 * When to use:
 * - Use when you want to spotlight one agent rather than the full marketplace grid.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 * - Use {@link InstalledAgentsCard} when you need a full multi-agent management view.
 *
 * Parameters:
 * - `agentid`: Optional legacy alias for `agentId` (matches `agentServiceId` or `id`). Nullable: yes.
 * - `agentId`: Preferred agent identifier prop. Nullable: yes.
 * - `enableInstallFlow`: Enable built-in install flow modal (default: true). Nullable: yes.
 * - `installDialogTitle`: Optional install modal title (default: "Install Agent"). Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element that shows agent details, install status,
 *   and action controls (pause/resume, budget adjustments, uninstall).
 *
 * Errors/failure modes:
 * - Shows inline error state when the marketplace request fails.
 * - Action failures surface toast notifications or inline budget errors.
 * - Loading: shows skeleton only on the first load; refresh keeps content and shows a header spinner.
 *
 * Side effects:
 * - Triggers OAuth marketplace fetches; may open AgentInstallFlow when installing.
 * - Uses IEE (SafeApprove) approval flows for pause/resume/budget/uninstall actions.
 *
 * Invariants/assumptions:
 * - Agent catalog is tenant-scoped; only agents enabled for the tenant can be shown/installed.
 * - Installed badges exclude revoked installs; pending revocations show as uninstalling.
 * - Pending webhook provisioning surfaces as provisioning status.
 * - Built-in install flow auto-closes on success and will not open when already installed.
 *
 * Data/auth references:
 * - Uses `useMarketplaceAgents` (OAuth marketplace catalog).
 * - Uses `useMyAgentInstallations` for installation status and failure counts.
 * - Uses `useAgentInstallationActions` + IEE (SafeApprove) receipts for protected actions.
 *
 * Runtime constraints:
 * - Client component (uses React hooks and DOM APIs).
 *
 * @example
 * <Agent agentId="4955f67c-a609-49fd-b7b6-2b3c1e000b5e" />
 */
export interface AgentProps {
  agentid?: string;
  agentId?: string;
  enableInstallFlow?: boolean;
  installDialogTitle?: string;
  /** Polling fallback interval for installations in ms (<= 0 disables). Default: 30000 when realtime is unavailable. */
  autoRefreshMs?: number;
  /** Show developer-facing diagnostics (failure breakdowns). */
  showDeveloperDiagnostics?: boolean;
}

/**
 * Render a single marketplace agent card with install support.
 */
export function Agent({
  agentid,
  agentId,
  enableInstallFlow = true,
  installDialogTitle = "Install Agent",
  autoRefreshMs,
  showDeveloperDiagnostics = false,
}: AgentProps) {
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
  const installationsState = useMyAgentInstallations({
    autoRefreshMs: resolvedAutoRefreshMs,
  });
  const {
    installations,
    isLoading: installsLoading,
    refresh: refreshInstalls,
    failureCounts,
    failuresLoading,
    freshness: installationsFreshness,
  } = installationsState;
  const { isInitialLoading, isRefreshing } = useRefreshState(
    isLoading || installsLoading,
    agents.length > 0 || installations.length > 0,
  );
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
  const pollingFallbackLabel = resolvedAutoRefreshMs
    ? `every ${Math.max(1, Math.round(resolvedAutoRefreshMs / 1000))}s`
    : "disabled";
  const failureBreakdowns =
    (installationsState as {
      failureBreakdowns?: Record<
        string,
        { total: number; onChainFailures: number; preSubmissionFailures: number }
      >;
    }).failureBreakdowns ?? {};
  const { networks, tokens } = useTenantConfig();
  const agentActions = useAgentInstallationActions();
  const {
    confirmIncreaseBudget,
    confirmDecreaseBudget,
    resumeInstallation,
    pauseInstallation,
    confirmRevocation,
    retryProvisioningWebhook,
    isLoading: isMutating,
  } = agentActions;
  const { tenantId, clientId, userId } = useIeeContext();
  const iee = useIeeReceiptAction();
  const [installingAgent, setInstallingAgent] = useState<MarketplaceAgent | null>(null);
  const [budgetAction, setBudgetAction] = useState<BudgetAction>("none");
  const [budgetInputsByTokenPoolId, setBudgetInputsByTokenPoolId] = useState<
    Record<string, string>
  >({});
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [uninstallLoading, setUninstallLoading] = useState(false);
  const [retryingProvisioning, setRetryingProvisioning] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const agent = useMemo(() => {
    const inputId = (agentId ?? agentid ?? "").trim();
    if (!inputId) return undefined;
    const normalized = inputId.toLowerCase();
    return agents.find(
      (a) =>
        a.agentServiceId.toLowerCase() === normalized ||
        a.id.toLowerCase() === normalized,
    ) as MarketplaceAgent | undefined;
  }, [agentId, agentid, agents]);

  const installation = useMemo(() => {
    if (!agent) return null;
    return installations.find((i) => i.agentServiceId === agent.agentServiceId) ?? null;
  }, [agent, installations]);

  const isPendingRevocation =
    installation?.revocationPending === true ||
    installation?.rawStatus === "pending_revocation";
  const isPendingWebhook = installation?.rawStatus === "pending_webhook";
  const isRevoked = installation?.status === "revoked" && !isPendingRevocation;
  const hasInstallation = Boolean(installation) && !isRevoked;
  const installed =
    Boolean(installation) &&
    !isRevoked &&
    !isPendingRevocation &&
    !isPendingWebhook;
  const isProvisioning = Boolean(installation) && isPendingWebhook && !isPendingRevocation;
  const isPaused = installation?.status === "paused";
  const pauseCode = installation?.pauseCode ?? null;
  const canResume =
    Boolean(installation) &&
    installation?.status === "paused" &&
    !isPendingRevocation &&
    ["developer_failure_threshold", "user_insufficient_balance", "user_paused"].includes(
      pauseCode ?? "",
    );
  const canPause =
    Boolean(installation) &&
    installation?.status === "active" &&
    !isPendingRevocation &&
    !isPendingWebhook;
  const canManageBudget =
    Boolean(installation) &&
    !isPendingRevocation &&
    !isPendingWebhook &&
    (installation?.status === "active" || installation?.status === "paused");

  const network = useMemo(() => {
    if (!installation) return null;
    return (
      networks.find(
        (n) => String(n.networkId) === String(installation.networkId),
      ) ?? null
    );
  }, [installation, networks]);
  const installationWithTokenBudgets =
    installation as InstallationWithTokenBudgets | null;
  const selectedInstallationToken = installation?.operatingToken ?? null;
  const selectedTenantToken = useMemo(() => {
    if (!selectedInstallationToken?.tokenPoolId) return null;
    return (
      tokens.find(
        (token) => token.id === selectedInstallationToken.tokenPoolId,
      ) ?? null
    );
  }, [selectedInstallationToken?.tokenPoolId, tokens]);
  const installationOperatingTokens = Array.isArray(
    installationWithTokenBudgets?.availableOperatingTokens,
  )
    ? installationWithTokenBudgets.availableOperatingTokens
    : [];
  const marketplaceOperatingTokens = Array.isArray(agent?.availableOperatingTokens)
    ? agent.availableOperatingTokens
    : [];
  const fallbackOperatingTokens: Array<{
    tokenPoolId: string;
    symbol: string;
    name: string | null;
    contract: string | null;
    decimals: number | null;
    logoUrl: string | null;
  }> = [];
  if (selectedInstallationToken?.tokenPoolId) {
    fallbackOperatingTokens.push({
      tokenPoolId: selectedInstallationToken.tokenPoolId,
      symbol: selectedInstallationToken.symbol,
      name: selectedInstallationToken.name,
      contract: selectedInstallationToken.contract,
      decimals: selectedInstallationToken.decimals,
      logoUrl: selectedInstallationToken.logoUrl ?? null,
    });
  }
  if (agent?.operatingToken?.tokenPoolId) {
    fallbackOperatingTokens.push({
      tokenPoolId: agent.operatingToken.tokenPoolId,
      symbol: agent.operatingToken.symbol,
      name: agent.operatingToken.name,
      contract: agent.operatingToken.contract,
      decimals: agent.operatingToken.decimals,
      logoUrl: agent.operatingToken.logoUrl ?? null,
    });
  }
  const operatingTokenMap = new Map<
    string,
    {
      tokenPoolId: string;
      symbol: string;
      name: string | null;
      contract: string | null;
      decimals: number | null;
      logoUrl: string | null;
    }
  >();
  const combinedOperatingTokens = [
    ...installationOperatingTokens.map((token) => ({
      tokenPoolId: token.tokenPoolId,
      symbol: token.symbol ?? "",
      name: token.name ?? null,
      contract: token.contract ?? null,
      decimals: token.decimals ?? null,
      logoUrl: token.logoUrl ?? null,
    })),
    ...marketplaceOperatingTokens.map((token) => ({
      tokenPoolId: token.tokenPoolId,
      symbol: token.symbol,
      name: token.name,
      contract: token.contract,
      decimals: token.decimals,
      logoUrl: token.logoUrl ?? null,
    })),
    ...fallbackOperatingTokens,
  ];
  for (const token of combinedOperatingTokens) {
    const tokenPoolId =
      typeof token.tokenPoolId === "string"
        ? token.tokenPoolId.trim()
        : "";
    if (!tokenPoolId) continue;
    const symbol =
      typeof token.symbol === "string" ? token.symbol.trim() : "";
    const name =
      typeof token.name === "string" ? token.name.trim() : "";
    const contract =
      typeof token.contract === "string" ? token.contract.trim() : "";
    const logoUrl =
      typeof token.logoUrl === "string" ? token.logoUrl.trim() : "";
    const decimals =
      typeof token.decimals === "number" && Number.isFinite(token.decimals)
        ? token.decimals
        : null;
    const existing = operatingTokenMap.get(tokenPoolId);
    if (!existing) {
      operatingTokenMap.set(tokenPoolId, {
        tokenPoolId,
        symbol: symbol || "TOKEN",
        name: name || null,
        contract: contract || null,
        decimals,
        logoUrl: logoUrl || null,
      });
      continue;
    }
    operatingTokenMap.set(tokenPoolId, {
      tokenPoolId,
      symbol: existing.symbol || symbol || "TOKEN",
      name: existing.name ?? (name || null),
      contract: existing.contract ?? (contract || null),
      decimals: existing.decimals ?? decimals,
      logoUrl: existing.logoUrl ?? (logoUrl || null),
    });
  }
  const resolvedOperatingTokens = Array.from(operatingTokenMap.values());
  const tokenSymbolsForStats = resolvedOperatingTokens
    .map((token) => token.symbol.trim())
    .filter((symbol, index, items) => {
      if (!symbol) return false;
      return items.indexOf(symbol) === index;
    });
  const effectiveTokenSymbol =
    selectedTenantToken?.symbol ??
    selectedInstallationToken?.symbol ??
    resolvedOperatingTokens[0]?.symbol ??
    agent?.operatingToken?.symbol ??
    "";
  const tokenLabel =
    tokenSymbolsForStats.join(" + ") ||
    effectiveTokenSymbol ||
    agent?.operatingToken?.symbol ||
    "";
  const effectiveTokenDecimals =
    selectedTenantToken?.decimals ??
    (typeof selectedInstallationToken?.decimals === "number"
      ? selectedInstallationToken.decimals
      : null) ??
    (typeof resolvedOperatingTokens[0]?.decimals === "number"
      ? resolvedOperatingTokens[0].decimals
      : null) ??
    agent?.operatingToken?.decimals ??
    6;
  const tokenDecimals = effectiveTokenDecimals;
  const networkName =
    network?.name ??
    agent?.network?.name ??
    (installation ? String(installation.networkId) : "Not specified");
  const isTenantPolicyPaused =
    installation?.status === "paused" && pauseCode === "tenant_blacklisted";
  const tenantPolicyReason =
    installation?.blacklistReason?.trim() ||
    "Disabled by tenant owner or tenant policy.";

  const tokenBudgetsByTokenPoolId =
    installationWithTokenBudgets?.tokenBudgetsByTokenPoolId &&
    typeof installationWithTokenBudgets.tokenBudgetsByTokenPoolId === "object"
      ? installationWithTokenBudgets.tokenBudgetsByTokenPoolId
      : null;
  const tokenSymbolsByTokenPoolId =
    installationWithTokenBudgets?.tokenSymbolsByTokenPoolId &&
    typeof installationWithTokenBudgets.tokenSymbolsByTokenPoolId === "object"
      ? installationWithTokenBudgets.tokenSymbolsByTokenPoolId
      : null;
  const tokenBudgetUsedByTokenPoolId =
    installationWithTokenBudgets?.tokenBudgetUsedByTokenPoolId &&
    typeof installationWithTokenBudgets.tokenBudgetUsedByTokenPoolId ===
      "object"
      ? installationWithTokenBudgets.tokenBudgetUsedByTokenPoolId
      : null;
  const transactionCountByTokenPoolId =
    installationWithTokenBudgets?.transactionCountByTokenPoolId &&
    typeof installationWithTokenBudgets.transactionCountByTokenPoolId ===
      "object"
      ? installationWithTokenBudgets.transactionCountByTokenPoolId
      : null;
  const perTokenBudgetRows = resolvedOperatingTokens
    .map((token) => {
      const rawBudget =
        tokenBudgetsByTokenPoolId &&
        typeof tokenBudgetsByTokenPoolId[token.tokenPoolId] === "string"
          ? tokenBudgetsByTokenPoolId[token.tokenPoolId].trim()
          : "";
      const normalizedBudgetRaw = /^\d+$/.test(rawBudget) ? rawBudget : "";
      const rawUsed =
        tokenBudgetUsedByTokenPoolId &&
        typeof tokenBudgetUsedByTokenPoolId[token.tokenPoolId] === "string"
          ? tokenBudgetUsedByTokenPoolId[token.tokenPoolId].trim()
          : "0";
      const normalizedUsedRaw = /^\d+$/.test(rawUsed) ? rawUsed : "0";
      const tenantToken =
        tokens.find((tenantToken) => tenantToken.id === token.tokenPoolId) ??
        null;
      const decimals =
        (typeof tenantToken?.decimals === "number"
          ? tenantToken.decimals
          : token.decimals) ?? tokenDecimals;
      const symbol =
        token.symbol ||
        (tokenSymbolsByTokenPoolId &&
        typeof tokenSymbolsByTokenPoolId[token.tokenPoolId] === "string"
          ? tokenSymbolsByTokenPoolId[token.tokenPoolId].trim()
          : "") ||
        (typeof tenantToken?.symbol === "string" && tenantToken.symbol.trim()) ||
        "TOKEN";
      const logoUrl =
        (typeof token.logoUrl === "string" && token.logoUrl.trim()) ||
        (typeof tenantToken?.logoUrl === "string" &&
        tenantToken.logoUrl.trim()
          ? tenantToken.logoUrl.trim()
          : "") ||
        null;
      const rawTxCount =
        transactionCountByTokenPoolId &&
        typeof transactionCountByTokenPoolId[token.tokenPoolId] === "number"
          ? transactionCountByTokenPoolId[token.tokenPoolId]
          : Number(
              String(
                transactionCountByTokenPoolId?.[token.tokenPoolId] ?? 0,
              ).trim(),
            );
      const txCount = Number.isFinite(rawTxCount)
        ? Math.max(0, Math.floor(rawTxCount))
        : 0;
      const budgetUsedBigInt = safeBigInt(normalizedUsedRaw);
      const budgetTotalBigInt = safeBigInt(normalizedBudgetRaw);
      const budgetPercentage =
        budgetTotalBigInt > 0n
          ? Number((budgetUsedBigInt * 10000n) / budgetTotalBigInt) / 100
          : 0;
      return {
        tokenPoolId: token.tokenPoolId,
        symbol,
        logoUrl,
        decimals,
        budgetRaw: normalizedBudgetRaw || "0",
        usageDisplay:
          normalizedBudgetRaw && /^\d+$/.test(normalizedBudgetRaw)
            ? `${toUsageDisplay(normalizedUsedRaw, decimals)} / ${toUsageDisplay(
                normalizedBudgetRaw,
                decimals,
              )} ${symbol}`
            : "Not set",
        txCount,
        budgetPercentage,
        budgetBarWidth: Math.min(budgetPercentage, 100),
        budgetPercentText: Number.isFinite(budgetPercentage)
          ? budgetPercentage.toFixed(1)
          : "0.0",
      };
    })
    .filter(
      (
        row,
      ): row is {
        tokenPoolId: string;
        symbol: string;
        logoUrl: string | null;
        decimals: number;
        budgetRaw: string;
        usageDisplay: string;
        txCount: number;
        budgetPercentage: number;
        budgetBarWidth: number;
        budgetPercentText: string;
      } => Boolean(row),
    );

  const failureCount = installation
    ? failureCounts?.[installation.installationId] ?? 0
    : 0;
  const failureBreakdown = installation
    ? failureBreakdowns?.[installation.installationId] ?? null
    : null;
  const onChainFailures = failureBreakdown?.onChainFailures ?? failureCount;
  const preSubmissionFailures = failureBreakdown?.preSubmissionFailures ?? 0;

  useEffect(() => {
    if (!canManageBudget && budgetAction !== "none") {
      setBudgetAction("none");
      setBudgetInputsByTokenPoolId({});
      setBudgetError(null);
    }
  }, [budgetAction, canManageBudget]);

  useEffect(() => {
    if (!agent) {
      setDetailsOpen(false);
    }
  }, [agent]);

  useEffect(() => {
    if (!installingAgent) return;
    if (hasInstallation || isPendingRevocation || isProvisioning) {
      setInstallingAgent(null);
    }
  }, [hasInstallation, installingAgent, isPendingRevocation, isProvisioning]);

  const handleInstall = useCallback(() => {
    if (!agent || !enableInstallFlow) return;
    if (hasInstallation || isPendingRevocation || isProvisioning) return;
    setInstallingAgent(agent);
  }, [agent, enableInstallFlow, hasInstallation, isPendingRevocation, isProvisioning]);

  const handleInstallComplete = useCallback(() => {
    refresh();
    refreshInstalls();
    setInstallingAgent(null);
  }, [refresh, refreshInstalls]);

  const handleBudgetChange = useCallback(
    (action: BudgetAction) => {
      if (!canManageBudget) return;
      const nextInputs = perTokenBudgetRows.reduce<Record<string, string>>(
        (acc, row) => {
          acc[row.tokenPoolId] = formatUnits(row.budgetRaw, row.decimals);
          return acc;
        },
        {},
      );
      setBudgetError(null);
      setBudgetAction(action);
      setBudgetInputsByTokenPoolId(nextInputs);
    },
    [canManageBudget, perTokenBudgetRows],
  );

  const handleCancelBudget = useCallback(() => {
    setBudgetError(null);
    setBudgetAction("none");
    setBudgetInputsByTokenPoolId({});
  }, []);

  const handleConfirmBudget = useCallback(async () => {
    if (!installation || budgetAction === "none") return;
    setBudgetError(null);
    setBudgetLoading(true);
    try {
      if (!tenantId || !clientId || !userId) {
        throw new Error("Missing tenant/client/user context");
      }
      if (!perTokenBudgetRows.length) {
        throw new Error("No operating tokens available for budget update");
      }
      let currentTotal = 0n;
      let nextTotal = 0n;
      let changedCount = 0;
      const normalizedTokenBudgets = perTokenBudgetRows.reduce<
        Record<string, string>
      >((acc, row) => {
        const currentBudget = safeBigInt(row.budgetRaw);
        currentTotal += currentBudget;
        const inputValue =
          budgetInputsByTokenPoolId[row.tokenPoolId] ??
          formatUnits(row.budgetRaw, row.decimals);
        const nextBudget = parseTokenAmountToBaseUnits(inputValue, row.decimals);
        if (nextBudget <= 0n) {
          throw new Error(
            `Enter a budget greater than 0 for ${row.symbol || "token"}`,
          );
        }
        if (budgetAction === "increase" && nextBudget < currentBudget) {
          throw new Error(
            `Increase mode cannot reduce ${row.symbol || "token"} budget`,
          );
        }
        if (budgetAction === "decrease" && nextBudget > currentBudget) {
          throw new Error(
            `Decrease mode cannot increase ${row.symbol || "token"} budget`,
          );
        }
        if (nextBudget !== currentBudget) {
          changedCount += 1;
        }
        nextTotal += nextBudget;
        acc[row.tokenPoolId] = nextBudget.toString();
        return acc;
      }, {});
      if (changedCount === 0) {
        throw new Error("No budget changes detected");
      }
      const delta =
        budgetAction === "increase"
          ? nextTotal - currentTotal
          : currentTotal - nextTotal;
      if (delta <= 0n) {
        throw new Error("No valid budget delta detected");
      }

      const actionType =
        budgetAction === "increase"
          ? "agent_budget_increase_v1"
          : "agent_budget_decrease_v1";
      const payload =
        budgetAction === "increase"
          ? {
            tenant_id: tenantId,
            client_id: clientId,
            user_id: userId,
            installation_id: installation.installationId,
            additional_budget: delta.toString(),
          }
          : {
            tenant_id: tenantId,
            client_id: clientId,
            user_id: userId,
            installation_id: installation.installationId,
            decrease_amount: delta.toString(),
          };

      const receipt = await iee.run({ actionType, payload });
      if (receipt.status !== "approved" || !receipt.receipt) {
        throw new Error(
          receipt.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receipt.error?.message ?? "SafeApprove approval failed",
        );
      }

      const preparationToken = receipt.preparationToken ?? null;
      if (!preparationToken) {
        throw new Error("SafeApprove approval missing preparation token");
      }
      const txHashRaw = receipt.transactionHash ?? null;
      const txHash = typeof txHashRaw === "string" ? txHashRaw.trim() : "";
      if (!isValidTxHash(txHash)) {
        throw new Error(
          "SafeApprove approval did not return a valid transaction hash",
        );
      }

      if (budgetAction === "increase") {
        await confirmIncreaseBudget(
          installation.installationId,
          preparationToken,
          txHash,
          {
            receipt: receipt.receipt,
            tokenBudgetsByTokenPoolId: normalizedTokenBudgets,
            tokenBudgetMode:
              Object.keys(normalizedTokenBudgets).length > 1 ? "all" : "single",
          },
        );
      } else {
        await confirmDecreaseBudget(
          installation.installationId,
          preparationToken,
          txHash,
          {
            receipt: receipt.receipt,
            tokenBudgetsByTokenPoolId: normalizedTokenBudgets,
            tokenBudgetMode:
              Object.keys(normalizedTokenBudgets).length > 1 ? "all" : "single",
          },
        );
      }

      setBudgetAction("none");
      setBudgetInputsByTokenPoolId({});
      refreshInstalls();
    } catch (e) {
      setBudgetError(
        e instanceof Error ? e.message : "Failed to update budget",
      );
    } finally {
      setBudgetLoading(false);
    }
  }, [
    budgetAction,
    budgetInputsByTokenPoolId,
    clientId,
    confirmDecreaseBudget,
    confirmIncreaseBudget,
    installation,
    iee,
    perTokenBudgetRows,
    refreshInstalls,
    tenantId,
    userId,
  ]);

  const handlePauseToggle = useCallback(async () => {
    if (!installation) return;
    if (!tenantId || !clientId || !userId) {
      toastError(
        "Agent pause/resume failed",
        new Error("Missing tenant/client/user context"),
        "Missing tenant/client/user context",
      );
      return;
    }

    if (installation.status === "paused") {
      if (!canResume) return;
      setResumeLoading(true);
      try {
        const receipt = await iee.run({
          actionType: "agent_installation_resume_v1",
          payload: {
            tenant_id: tenantId,
            client_id: clientId,
            user_id: userId,
            installation_id: installation.installationId,
          },
        });
        if (receipt.status !== "approved" || !receipt.receipt) {
          throw new Error(
            receipt.status === "cancelled"
              ? "SafeApprove approval cancelled"
              : receipt.error?.message ?? "SafeApprove approval failed",
          );
        }
        await resumeInstallation(installation.installationId, receipt.receipt);
        refreshInstalls();
      } catch (e) {
        toastError(
          "Agent resume failed",
          e,
          "Failed to resume agent. Please try again.",
        );
      } finally {
        setResumeLoading(false);
      }
      return;
    }

    if (!canPause) return;
    setPauseLoading(true);
    try {
      const receipt = await iee.run({
        actionType: "agent_installation_pause_v1",
        payload: {
          tenant_id: tenantId,
          client_id: clientId,
          user_id: userId,
          installation_id: installation.installationId,
        },
      });
      if (receipt.status !== "approved" || !receipt.receipt) {
        throw new Error(
          receipt.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receipt.error?.message ?? "SafeApprove approval failed",
        );
      }
      await pauseInstallation(installation.installationId, undefined, {
        receipt: receipt.receipt,
      });
      refreshInstalls();
    } catch (e) {
      toastError(
        "Agent pause failed",
        e,
        "Failed to pause agent. Please try again.",
      );
    } finally {
      setPauseLoading(false);
    }
  }, [
    canPause,
    canResume,
    clientId,
    installation,
    iee,
    pauseInstallation,
    refreshInstalls,
    resumeInstallation,
    tenantId,
    userId,
  ]);

  const handleUninstall = useCallback(async () => {
    if (!installation) return;
    if (!tenantId || !clientId || !userId) {
      toastError(
        "Agent uninstall failed",
        new Error("Missing tenant/client/user context"),
        "Missing tenant/client/user context",
      );
      return;
    }

    setUninstallLoading(true);
    try {
      const receipt = await iee.run({
        actionType: "agent_uninstall_initiate_v1",
        payload: {
          tenant_id: tenantId,
          client_id: clientId,
          user_id: userId,
          installation_id: installation.installationId,
        },
      });

      if (receipt.status !== "approved" || !receipt.receipt) {
        throw new Error(
          receipt.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receipt.error?.message ?? "SafeApprove approval failed",
        );
      }

      const txHashRaw = receipt.transactionHash ?? null;
      const txHash = typeof txHashRaw === "string" ? txHashRaw.trim() : "";

      if (txHash) {
        const confirmReceipt = await iee.run({
          actionType: "agent_uninstall_confirm_v1",
          payload: {
            tenant_id: tenantId,
            client_id: clientId,
            user_id: userId,
            installation_id: installation.installationId,
            transaction_hash: txHash,
          },
        });

        if (confirmReceipt.status !== "approved" || !confirmReceipt.receipt) {
          throw new Error(
            confirmReceipt.status === "cancelled"
              ? "SafeApprove approval cancelled"
              : confirmReceipt.error?.message ?? "SafeApprove approval failed",
          );
        }

        if (!isValidTxHash(txHash)) {
          throw new Error(
            "SafeApprove approval did not return a valid transaction hash",
          );
        }

        await confirmRevocation(
          installation.installationId,
          txHash,
          confirmReceipt.receipt,
        );
      } else if (isPendingRevocation) {
        throw new Error("SafeApprove approval did not return a valid transaction hash");
      }

      refreshInstalls();
    } catch (err) {
      toastError(
        "Agent uninstall failed",
        err,
        "Unable to uninstall agent. Please try again.",
      );
    } finally {
      setUninstallLoading(false);
    }
  }, [
    clientId,
    confirmRevocation,
    installation,
    iee,
    isPendingRevocation,
    refreshInstalls,
    tenantId,
    userId,
  ]);

  const handleRetryProvisioning = useCallback(async () => {
    if (!installation) return;
    if (!tenantId || !clientId || !userId) {
      toastError(
        "Agent retry provisioning failed",
        new Error("Missing tenant/client/user context"),
        "Missing tenant/client/user context",
      );
      return;
    }

    setRetryingProvisioning(true);
    try {
      const receipt = await iee.run({
        actionType: "agent_installation_retry_webhook_v1",
        payload: {
          tenant_id: tenantId,
          client_id: clientId,
          user_id: userId,
          installation_id: installation.installationId,
        },
      });
      if (receipt.status !== "approved" || !receipt.receipt) {
        throw new Error(
          receipt.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receipt.error?.message ?? "SafeApprove approval failed",
        );
      }
      await retryProvisioningWebhook(installation.installationId, receipt.receipt);
      refreshInstalls();
    } catch (err) {
      toastError(
        "Agent retry provisioning failed",
        err,
        "Failed to retry provisioning webhook",
      );
    } finally {
      setRetryingProvisioning(false);
    }
  }, [
    clientId,
    installation,
    iee,
    refreshInstalls,
    retryProvisioningWebhook,
    tenantId,
    userId,
  ]);

  if (isInitialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardHeaderRow
            title={<Skeleton className="h-6 w-40" />}
            actions={<Skeleton className="h-9 w-24" />}
          />
          <CardDescription>
            <Skeleton className="h-4 w-64" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardHeaderRow
            title={
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Failed to load agent</span>
              </div>
            }
            actions={
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formatAgentLoadError(error)}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!agent) {
    return (
      <Card>
        <CardEmptyState className="py-8">
          <div className="flex flex-col items-center gap-2">
            <Zap className="h-6 w-6 text-muted-foreground" />
            <div className="text-base font-medium">Agent unavailable</div>
            <div className="text-sm text-muted-foreground">
              This agent is not enabled for the current tenant.
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardEmptyState>
      </Card>
    );
  }

  const categoryLabel = categoryLabels[agent.category] ?? agent.category;
  const feeSummary = installation?.feeSummary ?? agent.feeSummary ?? null;
  const feeLabel = feeSummary
    ? `Platform ${formatBps(feeSummary.platformFeeBps)} • Tenant ${formatBps(feeSummary.tenantFeeBps)}`
    : "Fees unavailable";
  const iconSrc = agent.iconUrl ?? agent.avatarUrl ?? null;
  const description = agent.description || "No description available.";
  const tags = agent.tags ?? [];
  const installCountLabel = agent.installCount.toLocaleString();
  const stats: Array<{ key: string; value: string; className?: string }> = [
    { key: "installs", value: `${installCountLabel} installs` },
  ];
  if (tokenLabel) {
    stats.push({ key: "token", value: tokenLabel });
  }
  if (networkName) {
    stats.push({
      key: "network",
      value: networkName,
      className: "hidden md:inline",
    });
  }

  const headerStatus = isPendingRevocation
    ? {
      label: "Uninstalling",
      className:
        "bg-red-500/10 text-red-400 border border-red-500/20",
      icon: <AlertCircle className="w-3 h-3 mr-1" />,
    }
    : isProvisioning
      ? {
        label: "Provisioning",
        className:
          "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        icon: <Info className="w-3 h-3 mr-1" />,
      }
      : installation?.status === "paused"
        ? {
          label: "Paused",
          className:
            "bg-amber-500/10 text-amber-500 border border-amber-500/20",
          icon: <AlertCircle className="w-3 h-3 mr-1" />,
        }
        : installation?.status === "suspended"
          ? {
            label: "Suspended",
            className:
              "bg-red-500/10 text-red-400 border border-red-500/20",
            icon: <AlertCircle className="w-3 h-3 mr-1" />,
          }
          : null;

  const installBadge = installed
    ? {
      label: "Installed",
      className:
        "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    }
    : isPendingRevocation
      ? {
        label: "Uninstalling",
        className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      }
      : isProvisioning
        ? {
          label: "Provisioning",
          className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        }
        : null;
  const showInstallBadge = Boolean(installBadge) && !headerStatus;

  const disablePauseResume =
    !hasInstallation ||
    isPendingRevocation ||
    isPendingWebhook ||
    isMutating ||
    pauseLoading ||
    resumeLoading ||
    (isPaused ? !canResume : !canPause);
  const disableBudgetActions =
    !canManageBudget || isMutating || budgetLoading || uninstallLoading;
  const disableUninstall =
    !hasInstallation || isMutating || uninstallLoading;

  return (
    <>
      {hasInstallation ? (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 md:p-6 pb-4 md:pb-5">
          {showRealtimeFallbackNotice ? (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Realtime connection is unavailable{realtimeFallbackReason}; polling fallback {pollingFallbackLabel}.
            </div>
          ) : null}

          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-start gap-3 md:gap-4 mb-4">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {iconSrc ? (
                    <img
                      src={iconSrc}
                      alt={`${agent.displayName} icon`}
                      className="w-12 h-12 md:w-16 md:h-16 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 md:w-10 md:h-10 text-white">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl text-white truncate mb-2">
                    {agent.displayName}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-300 text-xs"
                    >
                      {categoryLabel}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-300 text-xs"
                    >
                      {feeLabel}
                    </Badge>
                    <Badge variant={feedHealth.variant as any} className="text-xs">
                      {feedHealth.label}
                    </Badge>
                    {headerStatus ? (
                      <Badge
                        variant="outline"
                        className={`${headerStatus.className} text-xs`}
                      >
                        {headerStatus.icon}
                        {headerStatus.label}
                      </Badge>
                    ) : null}
                    {showInstallBadge ? (
                      <Badge
                        variant="outline"
                        className={`${installBadge?.className ?? ""} text-xs`}
                      >
                        {installBadge?.label}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="text-xs md:text-sm text-zinc-400 mb-2 md:mb-3">
                {description}
              </p>

              {tags.length > 0 ? (
                <div className="hidden md:flex items-center gap-2 mb-3 flex-wrap">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2 md:gap-3 text-xs text-zinc-500 flex-wrap">
                {stats.map((stat, index) => (
                  <React.Fragment key={stat.key}>
                    {index > 0 ? (
                      <span className={stat.className}>•</span>
                    ) : null}
                    <span className={stat.className}>{stat.value}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isRefreshing ? (
                <RefreshCw
                  className="h-4 w-4 animate-spin text-zinc-500"
                  aria-label="Refreshing"
                />
              ) : null}
              <AgentActionsMenu
                isPaused={isPaused}
                onPauseToggle={handlePauseToggle}
                pauseDisabled={disablePauseResume}
                onViewDetails={() => setDetailsOpen(true)}
                onIncreaseBudget={() => handleBudgetChange("increase")}
                onDecreaseBudget={() => handleBudgetChange("decrease")}
                increaseDisabled={disableBudgetActions}
                decreaseDisabled={disableBudgetActions}
                onUninstall={handleUninstall}
                uninstallDisabled={disableUninstall}
                uninstallLabel={isPendingRevocation ? "Finish uninstall" : "Uninstall agent"}
              />
            </div>
          </div>

          {isPendingWebhook ? (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-400">Provisioning pending</p>
                <p className="text-xs text-zinc-400">
                  We are retrying delivery of the provisioning webhook. The agent
                  will activate after the webhook succeeds.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryProvisioning}
                disabled={retryingProvisioning || isMutating}
                className="border-blue-500/30 text-blue-200 hover:bg-blue-500/10"
              >
                {retryingProvisioning ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {retryingProvisioning ? "Retrying…" : "Retry"}
              </Button>
            </div>
          ) : null}

          {isTenantPolicyPaused ? (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-300">Disabled by tenant owner</p>
                <p className="text-xs text-zinc-300">{tenantPolicyReason}</p>
              </div>
            </div>
          ) : null}

          <div className="mb-0">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm text-zinc-400">
                Budget Usage
              </span>
            </div>
            <div className="space-y-3 mb-3">
              {perTokenBudgetRows.map((row) => (
                <div key={row.tokenPoolId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <div className="w-4 h-4 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center">
                        {row.logoUrl ? (
                          <img
                            src={row.logoUrl}
                            alt={`${row.symbol} token`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <DollarSign className="w-2.5 h-2.5 text-white" />
                        )}
                      </div>
                      <span>{row.symbol}</span>
                    </div>
                    <span className="text-zinc-200">{row.usageDisplay}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getBudgetColor(
                        row.budgetPercentage,
                      )} transition-all duration-300`}
                      style={{ width: `${row.budgetBarWidth}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {row.budgetPercentText}% used • {row.txCount} tx
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
              <div className="flex items-center gap-3 md:gap-4 text-xs text-zinc-500">
                {showDeveloperDiagnostics ? (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    {failuresLoading
                      ? "…"
                      : `${preSubmissionFailures} pre / ${onChainFailures} on-chain`}{" "}
                    failures
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {budgetAction !== "none" && canManageBudget ? (
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-400">
                  {budgetAction === "increase"
                    ? "Enter amount to increase budget"
                    : "Enter amount to decrease budget"}
                </p>
              </div>

              <div className="space-y-3">
                {perTokenBudgetRows.map((row) => (
                  <div key={row.tokenPoolId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{row.symbol}</span>
                      <span>Current: {toUsageDisplay(row.budgetRaw, row.decimals)}</span>
                    </div>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      placeholder={`e.g. 10.00 ${row.symbol}`}
                      value={budgetInputsByTokenPoolId[row.tokenPoolId] ?? ""}
                      onChange={(e) =>
                        setBudgetInputsByTokenPoolId((prev) => ({
                          ...prev,
                          [row.tokenPoolId]: e.target.value,
                        }))
                      }
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      disabled={budgetLoading || isMutating}
                    />
                  </div>
                ))}
              </div>

              {budgetError ? (
                <p className="text-xs text-red-400">{budgetError}</p>
              ) : null}

              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmBudget}
                  disabled={!perTokenBudgetRows.length || budgetLoading || isMutating}
                  className={
                    budgetAction === "increase"
                      ? "flex-1 bg-white hover:bg-zinc-100 text-black"
                      : "flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                  }
                >
                  <Check className="w-4 h-4 mr-2" />
                  Confirm {budgetAction === "increase" ? "increase" : "decrease"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelBudget}
                  className="flex-1 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                  disabled={budgetLoading || isMutating}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          {agent.bannerUrl ? (
            <div className="w-full">
              <img
                src={agent.bannerUrl}
                alt={`${agent.displayName} banner`}
                className="w-full h-auto object-cover"
              />
            </div>
          ) : null}

          <div className="p-4 md:p-6 pb-4 md:pb-5">
            {showRealtimeFallbackNotice ? (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Realtime connection is unavailable{realtimeFallbackReason}; polling fallback {pollingFallbackLabel}.
              </div>
            ) : null}

            <div className="flex flex-col md:flex-row items-start justify-between gap-4">
              <div className="flex-1 w-full">
                <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt={`${agent.displayName} icon`}
                        className="w-12 h-12 md:w-16 md:h-16 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 md:w-10 md:h-10 text-white">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-xl text-white mb-2">
                      {agent.displayName}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="bg-zinc-800 text-zinc-300 text-xs"
                      >
                        {categoryLabel}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-zinc-800 text-zinc-300 text-xs"
                      >
                        {feeLabel}
                      </Badge>
                      <Badge variant={feedHealth.variant as any} className="text-xs">
                        {feedHealth.label}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="text-xs md:text-sm text-zinc-400 mb-2 md:mb-3">
                  {description}
                </p>

                {tags.length > 0 ? (
                  <div className="hidden md:flex items-center gap-2 mb-3 flex-wrap">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center gap-2 md:gap-3 text-xs text-zinc-500 flex-wrap">
                  {stats.map((stat, index) => (
                    <React.Fragment key={stat.key}>
                      {index > 0 ? (
                        <span className={stat.className}>•</span>
                      ) : null}
                      <span className={stat.className}>{stat.value}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto md:flex-shrink-0">
                {isRefreshing ? (
                  <RefreshCw
                    className="h-4 w-4 animate-spin text-zinc-500"
                    aria-label="Refreshing"
                  />
                ) : null}
                <Button
                  className="bg-white hover:bg-zinc-100 text-black w-full md:w-auto md:flex-shrink-0"
                  onClick={handleInstall}
                  disabled={!enableInstallFlow}
                >
                  Install Agent
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 text-white">
          <DialogTitle className="text-lg text-white">
            {agent.displayName}
          </DialogTitle>
          <p className="text-sm text-zinc-400">{description}</p>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-500">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Category</span>
              <span className="text-white">{categoryLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Fees</span>
              <span className="text-white">{feeLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Network</span>
              <span className="text-white">{networkName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">
                {tokenSymbolsForStats.length > 1 ? "Tokens" : "Token"}
              </span>
              <span className="text-white">
                {tokenLabel || "Not specified"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Installs</span>
              <span className="text-white">{installCountLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Status</span>
              <span className="text-white">{agent.status}</span>
            </div>
            {feeSummary ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Platform fee</span>
                  <span className="text-white">
                    {formatBps(feeSummary.platformFeeBps)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Tenant fee</span>
                  <span className="text-white">
                    {formatBps(feeSummary.tenantFeeBps)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Total fee</span>
                  <span className="text-white">
                    {formatBps(feeSummary.totalFeeBps)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Fees</span>
                <span className="text-white">Not specified</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
