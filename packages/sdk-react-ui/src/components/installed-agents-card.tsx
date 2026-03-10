"use client";

import { useMyAgentInstallations, useAgentInstallationActions, useTenantConfig, useMarketplaceAgents, useIeeContext, useIeeReceiptAction, useRealtimeStatus } from "@xkova/sdk-react";
import { AgentInstallQuestion, AgentInstallationDetails, MarketplaceAgent, SDKError } from "@xkova/sdk-core";
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "./ui/button.js";
import { AgentActionsMenu } from "./agent-actions-menu.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow } from "./ui/card-layout.js";
import { Badge } from "./ui/badge.js";
import { Skeleton } from "./ui/skeleton.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { useRefreshState } from "./use-refresh-state.js";
import {
  RefreshCw,
  Bot,
  AlertCircle,
  Zap,
  CreditCard,
  ShoppingCart,
  Info,
  DollarSign,
  Check,
  X,
  TrendingUp,
  BarChart3,
  Bell,
} from "lucide-react";
import { DEFAULT_AGENT_INSTALLATIONS_POLL_MS } from "./agent-polling.js";
import { trapFocusWithin } from "../utils.js";
import { toastError } from "../toast-utils.js";

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
      : "Failed to load agents.";
  return message;
};

/** Category icon mapping (keeps Details modal consistent with AgentMarketplaceCard) */
const categoryIcons: Record<string, React.ReactNode> = {
  trading: <TrendingUp className="h-4 w-4" />,
  payments: <CreditCard className="h-4 w-4" />,
  ecommerce: <ShoppingCart className="h-4 w-4" />,
  defi: <Zap className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  notifications: <Bell className="h-4 w-4" />,
};

/** Category label mapping (keeps Details modal consistent with AgentMarketplaceCard) */
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

const getBudgetColor = (percentage: number) => {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 80) return "bg-orange-500";
  if (percentage >= 70) return "bg-yellow-500";
  return "bg-emerald-500";
};

const isValidTxHash = (value: string) => /^0x[a-fA-F0-9]{64}$/.test(value);

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    const inner = entries
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(",");
    return `{${inner}}`;
  }
  return JSON.stringify(value ?? null);
};

const CUSTOM_SELECT_VALUE = "__xkova_custom__";

const getQuestionOptions = (
  question: AgentInstallQuestion,
): Array<{ value: string; label: string }> =>
  (question.options ?? [])
    .map((option) => {
      const value =
        typeof option?.value === "string" ? option.value.trim() : "";
      const labelRaw =
        typeof option?.label === "string" ? option.label.trim() : "";
      return {
        value,
        label: labelRaw || value,
      };
    })
    .filter((option) => option.value.length > 0);

const getQuestionOptionValues = (question: AgentInstallQuestion): Set<string> =>
  new Set(getQuestionOptions(question).map((option) => option.value));

const allowsCustomSelectValue = (question: AgentInstallQuestion): boolean =>
  question.allow_custom === true;

/**
 * Keep number-question inputs restricted to unsigned decimal text while typing.
 */
const sanitizeUnsignedDecimalInput = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");
  const fraction = fractionParts.join("");
  return fractionParts.length > 0 ? `${whole}.${fraction}` : whole;
};

const buildConfigUpdatePayload = (
  questions: AgentInstallQuestion[],
  inputs: Record<string, string>,
  existingInputs: Record<string, string>,
): { payload: Record<string, string>; errors: Record<string, string> } => {
  const payload: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const question of questions) {
    const rawInput = inputs[question.key] ?? "";
    const trimmed = rawInput.toString().trim();
    const existingValue = existingInputs[question.key] ?? "";
    const hasExisting = existingValue.trim().length > 0;
    const isSensitive = Boolean(question.sensitive);
    const shouldInclude = !isSensitive || trimmed !== "";

    if (shouldInclude) {
      payload[question.key] = trimmed;
    }

    if (!trimmed) {
      if (question.required && !hasExisting && question.default == null) {
        errors[question.key] = "Required";
      }
      continue;
    }

    if (question.type === "number") {
      if (!/^\d+(\.\d+)?$/.test(trimmed)) {
        errors[question.key] = "Enter a valid number";
        continue;
      }
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) {
        errors[question.key] = "Enter a valid number";
        continue;
      }
      if (typeof question.min === "number" && numeric < question.min) {
        errors[question.key] = `Minimum ${question.min}`;
        continue;
      }
      if (typeof question.max === "number" && numeric > question.max) {
        errors[question.key] = `Maximum ${question.max}`;
        continue;
      }
      if (typeof question.step === "number" && question.step > 0) {
        const base = typeof question.min === "number" ? question.min : 0;
        const steps = (numeric - base) / question.step;
        if (Math.abs(steps - Math.round(steps)) > 1e-9) {
          errors[question.key] = `Step ${question.step}`;
          continue;
        }
      }
    } else if (question.type === "select") {
      const optionValues = getQuestionOptionValues(question);
      if (!optionValues.size) {
        errors[question.key] = "No options configured";
        continue;
      }
      if (!optionValues.has(trimmed) && !allowsCustomSelectValue(question)) {
        errors[question.key] = "Select a valid option";
        continue;
      }
    }
  }

  return { payload, errors };
};

/**
 * Props for {@link InstalledAgentsCard}.
 *
 * @remarks
 * Purpose:
 * - Configure agent installation callbacks and display options.
 *
 * When to use:
 * - Use when customizing agent management UI behavior.
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
 * - Callbacks are optional; default flows run when omitted.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react agent hooks.
 *
 * @example
 * <InstalledAgentsCard showBudget={false} />
 */
export interface InstalledAgentsCardProps {
  /** Called when user clicks Configure on an agent */
  onConfigure?: (installation: AgentInstallationDetails) => void;
  /** Called when user clicks Uninstall on an agent */
  onUninstall?: (installation: AgentInstallationDetails) => void;
  /** Show budget information */
  showBudget?: boolean;
  /** Polling fallback interval for installations in ms (<= 0 disables). Default: 30000 when realtime is unavailable. */
  autoRefreshMs?: number;
  /** Show developer-facing diagnostics (failure breakdowns). */
  showDeveloperDiagnostics?: boolean;
  /**
   * Visual rendering variant.
   *
   * @remarks
   * - `card`: default card wrapper with header and stacked rows.
   * - `embedded`: render content only (no wrapper), suited for nesting inside other cards.
   */
  variant?: "card" | "embedded";
  /**
   * Deprecated: rows are always expanded; retained for backwards compatibility.
   */
  forceExpanded?: boolean;
  /**
   * Optional filter to show a single agent installation by service/agent id.
   *
   * @remarks
   * - Accepts `agentServiceId` (preferred) or `agentId`/`agentid` aliases.
   * - When provided, only matching installations are rendered.
   */
  agentServiceId?: string;
  agentId?: string;
  agentid?: string;
}

/**
 * Agent installation management card.
 *
 * @remarks
 * Purpose:
 * - List agent installations in the same visual layout as {@link Agent},
 *   with pause/resume/uninstall actions.
 *
 * When to use:
 * - Use when providing an "installed agents" management view.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: InstalledAgentsCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders error state when installation data fails to load or the session is invalid.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 * - Layout defaults to single-column grids in details panels for mobile safety.
 *
 * Side effects:
 * - Triggers OAuth requests, IEE (SafeApprove) approval flows, and toast notifications for action failures.
 * - Uninstall may require two IEE (SafeApprove) approvals (initiate + confirm) when a revocation
 *   transaction hash is produced.
 * - Surfaces uninstalling state when a revocation is pending.
 * - Surfaces provisioning state when webhook delivery is pending or retrying.
 *
 * Invariants/assumptions:
 * - Requires an authenticated SDK context.
 * - Rows are always expanded; no collapse toggles.
 * - Budget actions are shown only for active or paused installations.
 *
 * Data/auth references:
 * - Uses `/agents` and related endpoints via sdk-react hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <InstalledAgentsCard />
 *
 * @see /agents
 */
export function InstalledAgentsCard({
  onConfigure,
  onUninstall,
  showBudget = true,
  autoRefreshMs,
  showDeveloperDiagnostics = false,
  agentid,
  agentId,
  agentServiceId,
  variant = "card",
  forceExpanded,
}: InstalledAgentsCardProps) {
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
    isLoading,
    error,
    refresh,
    failureCounts,
    failuresLoading,
    freshness: installationsFreshness,
  } =
    installationsState;
  const failureBreakdowns =
    (installationsState as {
      failureBreakdowns?: Record<
        string,
        { total: number; onChainFailures: number; preSubmissionFailures: number }
      >;
    }).failureBreakdowns ?? {};
  const { agents: marketplaceAgents } = useMarketplaceAgents();
  const agentActions = useAgentInstallationActions() as ReturnType<typeof useAgentInstallationActions> & {
    retryProvisioningWebhook: (
      installationId: string,
      receipt: string,
    ) => Promise<{ success: boolean; message: string }>;
  };
  const {
    resumeInstallation,
    pauseInstallation,
    confirmRevocation,
    confirmIncreaseBudget,
    confirmDecreaseBudget,
    retryProvisioningWebhook,
    updateInstallationConfig,
    isLoading: isMutating,
  } = agentActions;
  const { networks, tokens } = useTenantConfig();
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [retryingProvisioningId, setRetryingProvisioningId] = useState<string | null>(null);
  const [budgetEditInstallationId, setBudgetEditInstallationId] = useState<string | null>(null);
  const [budgetAction, setBudgetAction] = useState<BudgetAction>("none");
  const [budgetInputsByTokenPoolId, setBudgetInputsByTokenPoolId] = useState<
    Record<string, string>
  >({});
  const [budgetIncreaseLoadingId, setBudgetIncreaseLoadingId] = useState<string | null>(null);
  const [budgetIncreaseError, setBudgetIncreaseError] = useState<string | null>(null);
  const [budgetDecreaseLoadingId, setBudgetDecreaseLoadingId] = useState<string | null>(null);
  const [budgetDecreaseError, setBudgetDecreaseError] = useState<string | null>(null);
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null);
  const [pauseLoadingId, setPauseLoadingId] = useState<string | null>(null);
  const [detailsAgent, setDetailsAgent] = useState<MarketplaceAgent | null>(null);
  const [configInstallation, setConfigInstallation] = useState<AgentInstallationDetails | null>(null);
  const [configQuestions, setConfigQuestions] = useState<AgentInstallQuestion[]>([]);
  const [configQuestionsVersion, setConfigQuestionsVersion] = useState<number | null>(null);
  const [configInputs, setConfigInputs] = useState<Record<string, string>>({});
  const [configCustomSelectModeByKey, setConfigCustomSelectModeByKey] = useState<
    Record<string, boolean>
  >({});
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [configSubmitError, setConfigSubmitError] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const { tenantId, clientId, userId } = useIeeContext();
  const iee = useIeeReceiptAction();
  const detailsOverlayRef = useRef<HTMLDivElement | null>(null);
  const detailsPanelRef = useRef<HTMLDivElement | null>(null);
  const detailsCloseRef = useRef<HTMLButtonElement | null>(null);
  const configOverlayRef = useRef<HTMLDivElement | null>(null);
  const configPanelRef = useRef<HTMLDivElement | null>(null);
  const configCloseRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const detailsTitleIdRef = useRef(`xkova-agent-details-title-${Math.random().toString(36).slice(2)}`);
  const detailsDescriptionIdRef = useRef(`xkova-agent-details-desc-${Math.random().toString(36).slice(2)}`);
  const configTitleIdRef = useRef(`xkova-agent-config-title-${Math.random().toString(36).slice(2)}`);
  const configDescriptionIdRef = useRef(`xkova-agent-config-desc-${Math.random().toString(36).slice(2)}`);
  const isEmbedded = variant === "embedded";
  const normalizedFilter = useMemo(() => {
    const raw = agentServiceId ?? agentId ?? agentid ?? null;
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().toLowerCase() : null;
  }, [agentServiceId, agentId, agentid]);
  const filteredInstallations = useMemo(() => {
    if (!normalizedFilter) return installations;
    return installations.filter(
      (i) =>
        i.agentServiceId.toLowerCase() === normalizedFilter,
    );
  }, [installations, normalizedFilter]);
  const filteredFailureCounts = useMemo(() => {
    if (!normalizedFilter) return failureCounts;
    const map: typeof failureCounts = {};
    for (const inst of filteredInstallations) {
      const count = failureCounts?.[inst.installationId];
      if (count !== undefined) {
        map[inst.installationId] = count;
      }
    }
    return map;
  }, [failureCounts, filteredInstallations, normalizedFilter]);
  const filteredFailureBreakdowns = useMemo(() => {
    if (!normalizedFilter) return failureBreakdowns;
    const map: typeof failureBreakdowns = {};
    for (const inst of filteredInstallations) {
      const breakdown = failureBreakdowns?.[inst.installationId];
      if (breakdown) {
        map[inst.installationId] = breakdown;
      }
    }
    return map;
  }, [failureBreakdowns, filteredInstallations, normalizedFilter]);
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

  useEffect(() => {
    if (!configInstallation) return;
    if (typeof document === "undefined") return;

    lastActiveElementRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    const t = window.setTimeout(() => {
      configCloseRef.current?.focus?.();
      if (document.activeElement === lastActiveElementRef.current) {
        configOverlayRef.current?.focus?.();
      }
    }, 0);
    return () => {
      window.clearTimeout(t);
      lastActiveElementRef.current?.focus?.();
      lastActiveElementRef.current = null;
    };
  }, [configInstallation]);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleCloseConfig = useCallback(() => {
    setConfigInstallation(null);
    setConfigQuestions([]);
    setConfigQuestionsVersion(null);
    setConfigInputs({});
    setConfigCustomSelectModeByKey({});
    setConfigErrors({});
    setConfigSubmitError(null);
    setConfigSaving(false);
  }, []);

  const handleSubmitConfig = useCallback(async () => {
    if (!configInstallation) return;
    setConfigSubmitError(null);
    setConfigSaving(true);
    try {
      if (!tenantId || !clientId || !userId) {
        throw new Error("Missing tenant/client/user context");
      }

      const existingInputs =
        configInstallation.installInputs && typeof configInstallation.installInputs === "object"
          ? configInstallation.installInputs
          : {};
      const validation = buildConfigUpdatePayload(
        configQuestions,
        configInputs,
        existingInputs,
      );
      if (Object.keys(validation.errors).length > 0) {
        setConfigErrors(validation.errors);
        setConfigSaving(false);
        return;
      }
      setConfigErrors({});

      const installInputsJson = stableStringify(validation.payload);
      const receipt = await iee.run({
        actionType: "agent_installation_config_update_v1",
        payload: {
          tenant_id: tenantId,
          client_id: clientId,
          user_id: userId,
          installation_id: configInstallation.installationId,
          install_inputs_json: installInputsJson,
        },
      });
      if (receipt.status !== "approved" || !receipt.receipt) {
        throw new Error(
          receipt.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receipt.error?.message ?? "SafeApprove approval failed",
        );
      }

      await updateInstallationConfig(
        configInstallation.installationId,
        validation.payload,
        {
          installQuestionsVersion: configQuestionsVersion ?? null,
          receipt: receipt.receipt,
        },
      );

      handleCloseConfig();
      refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to update agent config";
      setConfigSubmitError(message);
      toastError(
        "InstalledAgentsCard config update failed",
        e instanceof Error ? e : new Error(message),
        "Could not update agent configuration. Please try again.",
      );
    } finally {
      setConfigSaving(false);
    }
  }, [
    clientId,
    configInstallation,
    configInputs,
    configQuestions,
    configQuestionsVersion,
    handleCloseConfig,
    iee,
    refresh,
    tenantId,
    updateInstallationConfig,
    userId,
  ]);

  const handleRetryProvisioning = useCallback(
    async (installation: AgentInstallationDetails) => {
      setRetryingProvisioningId(installation.installationId);
      try {
        if (!tenantId || !clientId || !userId) {
          throw new Error("Missing tenant/client/user context");
        }
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
        refresh();
      } catch (err) {
        toastError(
          "InstalledAgentsCard retry provisioning failed",
          err instanceof Error ? err : new Error("Failed to retry provisioning"),
          "Failed to retry provisioning webhook",
        );
      } finally {
        setRetryingProvisioningId(null);
      }
    },
    [clientId, iee, refresh, retryProvisioningWebhook, tenantId, userId],
  );

  const handleUninstall = useCallback(
    async (installation: AgentInstallationDetails) => {
      if (onUninstall) {
        onUninstall(installation);
        return;
      }

      if (!tenantId || !clientId || !userId) {
        toastError(
          "InstalledAgentsCard uninstall failed",
          new Error("Missing tenant/client/user context"),
          "Missing tenant/client/user context",
        );
        return;
      }

      // Default uninstall behavior (IEE-gated)
      setUninstallingId(installation.agentActorId);
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

        const isPendingRevocation =
          installation.revocationPending === true ||
          installation.rawStatus === "pending_revocation";
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

          if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
            throw new Error("SafeApprove approval did not return a valid transaction hash");
          }

          await confirmRevocation(
            installation.installationId,
            txHash,
            confirmReceipt.receipt,
          );
        } else if (isPendingRevocation) {
          throw new Error("SafeApprove approval did not return a valid transaction hash");
        }

        refresh();
      } catch (err) {
        toastError(
          "InstalledAgentsCard uninstall failed",
          err,
          "Unable to uninstall agent. Please try again.",
        );
      } finally {
        setUninstallingId(null);
      }
    },
    [onUninstall, iee, tenantId, clientId, userId, confirmRevocation, refresh]
  );

  const safeBigInt = (v: string) => {
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

  const toFixedDisplay = (value: string, decimals: number, maxFractionDigits = 2) => {
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

  const { isInitialLoading, isRefreshing } = useRefreshState(
    isLoading,
    installations.length > 0,
  );

  if (isInitialLoading) {
    return (
      <Card className={isEmbedded ? "border-0 bg-transparent shadow-none" : undefined}>
        <CardHeader className={isEmbedded ? "px-0 pt-0 pb-0" : undefined}>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className={isEmbedded ? "space-y-3 px-0 pt-0 pb-0" : "space-y-3"}>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Card className={isEmbedded ? "border-0 bg-transparent shadow-none" : undefined}>
        {!isEmbedded ? (
          <CardHeader>
            <CardHeaderRow
              title={
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {normalizedFilter ? "Agent" : "My Agents"}
                  <Badge variant={feedHealth.variant as any}>{feedHealth.label}</Badge>
                </CardTitle>
              }
              description={<CardDescription>Your installed agent services.</CardDescription>}
              actions={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        aria-label="Refresh agents"
                      >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Refresh agents</TooltipContent>
                </Tooltip>
              }
            />
          </CardHeader>
        ) : null}
        <CardContent className={isEmbedded ? "space-y-4 px-0 pt-0 pb-0" : "space-y-4"}>
          {showRealtimeFallbackNotice ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Realtime connection is unavailable{realtimeFallbackReason}; polling fallback
              {resolvedAutoRefreshMs
                ? ` every ${Math.max(1, Math.round(resolvedAutoRefreshMs / 1000))}s`
                : " is disabled"}
              .
            </div>
          ) : null}

          {/* Error State */}
          {error && (
            <div className="text-sm text-destructive py-4 text-center">
              Failed to load agents: {formatAgentLoadError(error)}
            </div>
          )}

          {/* Empty State */}
          {!error && filteredInstallations.length === 0 && (
            <CardEmptyState className="py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>You haven't installed any agents yet.</p>
              <p className="text-xs mt-1">Browse the marketplace to get started.</p>
            </CardEmptyState>
          )}

          {/* Agent List */}
          {!error && filteredInstallations.length > 0 && (
            <div className="space-y-4">
              {filteredInstallations.map((installation: AgentInstallationDetails) => {
                const isPendingRevocation =
                  installation.revocationPending === true ||
                  installation.rawStatus === "pending_revocation";
                const isPendingWebhook = installation.rawStatus === "pending_webhook";
                const isRevoked =
                  installation.status === "revoked" && !isPendingRevocation;
                const isProvisioning = isPendingWebhook && !isPendingRevocation;
                const isPaused = installation.status === "paused";
                const isSuspended = installation.status === "suspended";
                const installed =
                  !isRevoked && !isPendingRevocation && !isPendingWebhook;
                const net = networks.find(
                  (n) => String(n.networkId) === String(installation.networkId),
                );
                const installationWithTokenBudgets =
                  installation as InstallationWithTokenBudgets;
                const selectedInstallationToken = installation.operatingToken ?? null;
                const selectedTenantToken =
                  selectedInstallationToken?.tokenPoolId
                    ? tokens.find(
                        (token) =>
                          token.id ===
                          selectedInstallationToken.tokenPoolId,
                      ) ?? null
                    : null;
                const installationOperatingTokens = Array.isArray(
                  installationWithTokenBudgets.availableOperatingTokens,
                )
                  ? installationWithTokenBudgets.availableOperatingTokens
                  : [];

                const marketplaceAgent =
                  marketplaceAgents.find((a) => a.agentServiceId === installation.agentServiceId) ?? null;
                const agentFeeSummary =
                  installation.feeSummary ?? marketplaceAgent?.feeSummary ?? null;
                const agentMetaBase: MarketplaceAgent =
                  marketplaceAgent ??
                  ({
                    id: installation.agentServiceId,
                    agentServiceId: installation.agentServiceId,
                    displayName: installation.service.displayName,
                    description: installation.service.description || null,
                    avatarUrl: installation.service.avatarUrl ?? null,
                    iconUrl: installation.service.iconUrl ?? null,
                    bannerUrl: installation.service.bannerUrl ?? null,
                    publisherUrl: null,
                    publisherName: null,
                    contactEmail: null,
                    supportUrl: null,
                    privacyPolicyUrl: null,
                    termsUrl: null,
                    tags: [],
                    releaseNotes: null,
                    network: net
                      ? { networkId: String(net.networkId), name: net.name }
                      : null,
                    operatingToken: null,
                    category: "misc" as any,
                    pricingModel: null,
                    pricingDetails: {},
                    minimumBudget: null,
                    status: "approved",
                    featured: false,
                    featuredOrder: null,
                    installCount: 0,
                    createdAt: installation.installedAt,
                    updatedAt: installation.installedAt,
                  } as MarketplaceAgent);
                const agentMeta: MarketplaceAgent = {
                  ...agentMetaBase,
                  feeSummary: agentFeeSummary,
                };
                const categoryLabel = categoryLabels[agentMeta.category] ?? agentMeta.category;
                const feeLabel = agentMeta.feeSummary
                  ? `Platform ${formatBps(agentMeta.feeSummary.platformFeeBps)} • Tenant ${formatBps(agentMeta.feeSummary.tenantFeeBps)}`
                  : "Fees unavailable";
                const iconSrc =
                  agentMeta.iconUrl ??
                  agentMeta.avatarUrl ??
                  installation.service.iconUrl ??
                  installation.service.avatarUrl ??
                  null;
                const description =
                  agentMeta.description ||
                  installation.service.description ||
                  "No description available.";
                const tags = agentMeta.tags ?? [];
                const installCountLabel = agentMeta.installCount.toLocaleString();
                const networkName =
                  net?.name ?? agentMeta.network?.name ?? String(installation.networkId);
                const marketplaceOperatingTokens = Array.isArray(
                  agentMeta.availableOperatingTokens,
                )
                  ? agentMeta.availableOperatingTokens
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
                if (agentMeta.operatingToken?.tokenPoolId) {
                  fallbackOperatingTokens.push({
                    tokenPoolId: agentMeta.operatingToken.tokenPoolId,
                    symbol: agentMeta.operatingToken.symbol,
                    name: agentMeta.operatingToken.name,
                    contract: agentMeta.operatingToken.contract,
                    decimals: agentMeta.operatingToken.decimals,
                    logoUrl: agentMeta.operatingToken.logoUrl ?? null,
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
                    typeof token.contract === "string"
                      ? token.contract.trim()
                      : "";
                  const logoUrl =
                    typeof token.logoUrl === "string"
                      ? token.logoUrl.trim()
                      : "";
                  const decimals =
                    typeof token.decimals === "number" &&
                    Number.isFinite(token.decimals)
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
                const tokenLabel =
                  tokenSymbolsForStats.join(" + ") ||
                  selectedTenantToken?.symbol ||
                  selectedInstallationToken?.symbol ||
                  agentMeta.operatingToken?.symbol ||
                  "";
                const tokenDecimals =
                  selectedTenantToken?.decimals ??
                  (typeof selectedInstallationToken?.decimals === "number"
                    ? selectedInstallationToken.decimals
                    : null) ??
                  (typeof resolvedOperatingTokens[0]?.decimals === "number"
                    ? resolvedOperatingTokens[0].decimals
                    : null) ??
                  agentMeta.operatingToken?.decimals ??
                  6;
                const feeSummary = agentMeta.feeSummary ?? null;
                const feeBoundAt = installation.feeSchedule?.boundAt ?? null;
                const stats: Array<{
                  key: string;
                  value: string;
                  className?: string;
                }> = [{ key: "installs", value: `${installCountLabel} installs` }];
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

                const tokenBudgetsByTokenPoolId =
                  installationWithTokenBudgets.tokenBudgetsByTokenPoolId &&
                  typeof installationWithTokenBudgets.tokenBudgetsByTokenPoolId === "object"
                    ? installationWithTokenBudgets.tokenBudgetsByTokenPoolId
                    : null;
                const tokenSymbolsByTokenPoolId =
                  installationWithTokenBudgets.tokenSymbolsByTokenPoolId &&
                  typeof installationWithTokenBudgets.tokenSymbolsByTokenPoolId === "object"
                    ? installationWithTokenBudgets.tokenSymbolsByTokenPoolId
                    : null;
                const tokenBudgetUsedByTokenPoolId =
                  installationWithTokenBudgets.tokenBudgetUsedByTokenPoolId &&
                  typeof installationWithTokenBudgets.tokenBudgetUsedByTokenPoolId === "object"
                    ? installationWithTokenBudgets.tokenBudgetUsedByTokenPoolId
                    : null;
                const transactionCountByTokenPoolId =
                  installationWithTokenBudgets.transactionCountByTokenPoolId &&
                  typeof installationWithTokenBudgets.transactionCountByTokenPoolId === "object"
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
                      tokens.find(
                        (tenantToken) => tenantToken.id === token.tokenPoolId,
                      ) ?? null;
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
                      (typeof tenantToken?.symbol === "string" &&
                        tenantToken.symbol.trim()) ||
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
                const isThisUninstalling = uninstallingId === installation.agentActorId;
                const isRetryingProvisioning =
                  retryingProvisioningId === installation.installationId;
                const isEditingBudget = budgetEditInstallationId === installation.installationId;
                const isBudgetIncreasing = budgetIncreaseLoadingId === installation.installationId;
                const isBudgetDecreasing = budgetDecreaseLoadingId === installation.installationId;
                const isBudgetLoading = isBudgetIncreasing || isBudgetDecreasing;
                const isResuming = resumeLoadingId === installation.installationId;
                const isPausing = pauseLoadingId === installation.installationId;
                const failureCount = filteredFailureCounts?.[installation.installationId] ?? 0;
                const failureBreakdown =
                  filteredFailureBreakdowns?.[installation.installationId] ?? null;
                const onChainFailures = failureBreakdown?.onChainFailures ?? failureCount;
                const preSubmissionFailures = failureBreakdown?.preSubmissionFailures ?? 0;
                const pauseCode = installation.pauseCode ?? null;
                const rowBudgetAction = isEditingBudget ? budgetAction : "none";
                const budgetError =
                  rowBudgetAction === "decrease" ? budgetDecreaseError : budgetIncreaseError;
                const canResume =
                  installation.status === "paused" &&
                  !isPendingRevocation &&
                  ["developer_failure_threshold", "user_insufficient_balance", "user_paused"].includes(
                    pauseCode ?? "",
                  );
                const isTenantPolicyPaused =
                  installation.status === "paused" &&
                  pauseCode === "tenant_blacklisted";
                const tenantPolicyReason =
                  installation.blacklistReason?.trim() ||
                  "Disabled by tenant owner or tenant policy.";
                const canPause =
                  installation.status === "active" && !isPendingRevocation && !isPendingWebhook;
                const canManageBudget =
                  !isPendingRevocation &&
                  !isPendingWebhook &&
                  !isRevoked &&
                  (installation.status === "active" || installation.status === "paused");

                const handleStartBudgetIncrease = () => {
                  if (!canManageBudget) return;
                  const nextInputs = perTokenBudgetRows.reduce<Record<string, string>>(
                    (acc, row) => {
                      acc[row.tokenPoolId] = formatUnits(row.budgetRaw, row.decimals);
                      return acc;
                    },
                    {},
                  );
                  setBudgetIncreaseError(null);
                  setBudgetDecreaseError(null);
                  setBudgetEditInstallationId(installation.installationId);
                  setBudgetAction("increase");
                  setBudgetInputsByTokenPoolId(nextInputs);
                };

                const handleStartBudgetDecrease = () => {
                  if (!canManageBudget) return;
                  const nextInputs = perTokenBudgetRows.reduce<Record<string, string>>(
                    (acc, row) => {
                      acc[row.tokenPoolId] = formatUnits(row.budgetRaw, row.decimals);
                      return acc;
                    },
                    {},
                  );
                  setBudgetIncreaseError(null);
                  setBudgetDecreaseError(null);
                  setBudgetEditInstallationId(installation.installationId);
                  setBudgetAction("decrease");
                  setBudgetInputsByTokenPoolId(nextInputs);
                };

                const handleCancelBudget = () => {
                  setBudgetIncreaseError(null);
                  setBudgetDecreaseError(null);
                  setBudgetEditInstallationId(null);
                  setBudgetAction("none");
                  setBudgetInputsByTokenPoolId({});
                };

                const resolvedConfigQuestions =
                  installation.installQuestions ??
                  agentMeta.installQuestions ??
                  [];
                const resolvedConfigVersion =
                  installation.installQuestionsVersion ??
                  agentMeta.installQuestionsVersion ??
                  null;

                const handleConfigure = () => {
                  if (onConfigure) {
                    onConfigure(installation);
                    return;
                  }
                  if (!resolvedConfigQuestions.length) return;
                  setConfigInstallation(installation);
                  setConfigQuestions(resolvedConfigQuestions);
                  setConfigQuestionsVersion(resolvedConfigVersion);
                  const existingInputs =
                    installation.installInputs && typeof installation.installInputs === "object"
                      ? installation.installInputs
                      : {};
                  const nextInputs: Record<string, string> = {};
                  const nextCustomSelectMode: Record<string, boolean> = {};
                  for (const question of resolvedConfigQuestions) {
                    if (question.sensitive) {
                      nextInputs[question.key] = "";
                      continue;
                    }
                    const existingValue = existingInputs[question.key];
                    if (typeof existingValue === "string") {
                      nextInputs[question.key] = existingValue;
                      continue;
                    }
                    if (question.default !== undefined && question.default !== null) {
                      nextInputs[question.key] = String(question.default);
                    } else {
                      nextInputs[question.key] = "";
                    }
                  }
                  for (const question of resolvedConfigQuestions) {
                    if (question.type !== "select" || !allowsCustomSelectValue(question)) {
                      continue;
                    }
                    const currentValue = nextInputs[question.key] ?? "";
                    const optionValues = getQuestionOptionValues(question);
                    nextCustomSelectMode[question.key] =
                      currentValue.trim() !== "" && !optionValues.has(currentValue);
                  }
                  setConfigInputs(nextInputs);
                  setConfigCustomSelectModeByKey(nextCustomSelectMode);
                  setConfigErrors({});
                  setConfigSubmitError(null);
                };

                const buildTokenBudgetUpdate = (mode: "increase" | "decrease") => {
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
                    const nextBudget = parseTokenAmountToBaseUnits(
                      inputValue,
                      row.decimals,
                    );
                    if (nextBudget <= 0n) {
                      throw new Error(
                        `Enter a budget greater than 0 for ${row.symbol || "token"}`,
                      );
                    }
                    if (mode === "increase" && nextBudget < currentBudget) {
                      throw new Error(
                        `Increase mode cannot reduce ${row.symbol || "token"} budget`,
                      );
                    }
                    if (mode === "decrease" && nextBudget > currentBudget) {
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
                    mode === "increase"
                      ? nextTotal - currentTotal
                      : currentTotal - nextTotal;
                  if (delta <= 0n) {
                    throw new Error("No valid budget delta detected");
                  }
                  return {
                    normalizedTokenBudgets,
                    delta,
                  };
                };

                const handleConfirmBudgetIncrease = async () => {
                  setBudgetIncreaseError(null);
                  setBudgetIncreaseLoadingId(installation.installationId);
                  try {
                    if (!tenantId || !clientId || !userId) {
                      throw new Error("Missing tenant/client/user context");
                    }
                    const { normalizedTokenBudgets, delta } = buildTokenBudgetUpdate(
                      "increase",
                    );

                    const receipt = await iee.run({
                      actionType: "agent_budget_increase_v1",
                      payload: {
                        tenant_id: tenantId,
                        client_id: clientId,
                        user_id: userId,
                        installation_id: installation.installationId,
                        additional_budget: delta.toString(),
                      },
                    });
                    if (receipt.status !== "approved" || !receipt.receipt) {
                      throw new Error(
                        receipt.status === "cancelled"
                          ? "SafeApprove approval cancelled"
                          : receipt.error?.message ?? "SafeApprove approval failed",
                      );
                    }

                    const preparationToken = receipt.preparationToken ?? null;
                    if (!preparationToken) {
                      throw new Error(
                        "SafeApprove approval missing preparation token",
                      );
                    }
                    const txHashRaw = receipt.transactionHash ?? null;
                    const txHash =
                      typeof txHashRaw === "string" ? txHashRaw.trim() : "";
                    if (!isValidTxHash(txHash)) {
                      throw new Error(
                        "SafeApprove approval did not return a valid transaction hash",
                      );
                    }

                    await confirmIncreaseBudget(
                      installation.installationId,
                      preparationToken,
                      txHash,
                      {
                        receipt: receipt.receipt,
                        tokenBudgetsByTokenPoolId: normalizedTokenBudgets,
                        tokenBudgetMode:
                          Object.keys(normalizedTokenBudgets).length > 1
                            ? "all"
                            : "single",
                      },
                    );

                    setBudgetEditInstallationId(null);
                    setBudgetAction("none");
                    setBudgetInputsByTokenPoolId({});
                    refresh();
                  } catch (e) {
                    setBudgetIncreaseError(
                      e instanceof Error ? e.message : "Failed to increase budget",
                    );
                  } finally {
                    setBudgetIncreaseLoadingId(null);
                  }
                };

                const handleConfirmBudgetDecrease = async () => {
                  setBudgetDecreaseError(null);
                  setBudgetDecreaseLoadingId(installation.installationId);
                  try {
                    if (!tenantId || !clientId || !userId) {
                      throw new Error("Missing tenant/client/user context");
                    }
                    const { normalizedTokenBudgets, delta } = buildTokenBudgetUpdate(
                      "decrease",
                    );

                    const receipt = await iee.run({
                      actionType: "agent_budget_decrease_v1",
                      payload: {
                        tenant_id: tenantId,
                        client_id: clientId,
                        user_id: userId,
                        installation_id: installation.installationId,
                        decrease_amount: delta.toString(),
                      },
                    });
                    if (receipt.status !== "approved" || !receipt.receipt) {
                      throw new Error(
                        receipt.status === "cancelled"
                          ? "SafeApprove approval cancelled"
                          : receipt.error?.message ?? "SafeApprove approval failed",
                      );
                    }

                    const preparationToken = receipt.preparationToken ?? null;
                    if (!preparationToken) {
                      throw new Error(
                        "SafeApprove approval missing preparation token",
                      );
                    }
                    const txHashRaw = receipt.transactionHash ?? null;
                    const txHash =
                      typeof txHashRaw === "string" ? txHashRaw.trim() : "";
                    if (!isValidTxHash(txHash)) {
                      throw new Error(
                        "SafeApprove approval did not return a valid transaction hash",
                      );
                    }

                    await confirmDecreaseBudget(
                      installation.installationId,
                      preparationToken,
                      txHash,
                      {
                        receipt: receipt.receipt,
                        tokenBudgetsByTokenPoolId: normalizedTokenBudgets,
                        tokenBudgetMode:
                          Object.keys(normalizedTokenBudgets).length > 1
                            ? "all"
                            : "single",
                      },
                    );

                    setBudgetEditInstallationId(null);
                    setBudgetAction("none");
                    setBudgetInputsByTokenPoolId({});
                    refresh();
                  } catch (e) {
                    setBudgetDecreaseError(
                      e instanceof Error ? e.message : "Failed to decrease budget",
                    );
                  } finally {
                    setBudgetDecreaseLoadingId(null);
                  }
                };

                const handleResume = async () => {
                  setResumeLoadingId(installation.installationId);
                  try {
                    if (!tenantId || !clientId || !userId) {
                      throw new Error("Missing tenant/client/user context");
                    }
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
                    refresh();
                  } catch (e) {
                    toastError(
                      "InstalledAgentsCard resume failed",
                      e,
                      "Failed to resume installation. Please try again.",
                    );
                  } finally {
                    setResumeLoadingId(null);
                  }
                };

                const handlePause = async () => {
                  setPauseLoadingId(installation.installationId);
                  try {
                    if (!tenantId || !clientId || !userId) {
                      throw new Error("Missing tenant/client/user context");
                    }
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
                    refresh();
                  } catch (e) {
                    toastError(
                      "InstalledAgentsCard pause failed",
                      e,
                      "Failed to pause installation. Please try again.",
                    );
                  } finally {
                    setPauseLoadingId(null);
                  }
                };

                const handlePauseToggle = () => {
                  if (installation.status === "paused") {
                    if (!canResume) return;
                    void handleResume();
                    return;
                  }
                  if (!canPause) return;
                  void handlePause();
                };

                const headerStatus = isPendingRevocation
                  ? {
                    label: "Uninstalling",
                    className: "bg-red-500/10 text-red-400 border border-red-500/20",
                    icon: <AlertCircle className="w-3 h-3 mr-1" />,
                  }
                  : isProvisioning
                    ? {
                      label: "Provisioning",
                      className: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                      icon: <Info className="w-3 h-3 mr-1" />,
                    }
                    : isPaused
                      ? {
                        label: "Paused",
                        className: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                        icon: <AlertCircle className="w-3 h-3 mr-1" />,
                      }
                      : isSuspended
                        ? {
                          label: "Suspended",
                          className: "bg-red-500/10 text-red-400 border border-red-500/20",
                          icon: <AlertCircle className="w-3 h-3 mr-1" />,
                        }
                        : null;

                const installBadge = isPendingRevocation
                  ? {
                    label: "Uninstalling",
                    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                  }
                  : isProvisioning
                    ? {
                      label: "Provisioning",
                      className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                    }
                    : isSuspended
                      ? {
                        label: "Suspended",
                        className: "bg-red-500/10 text-red-400 border-red-500/20",
                      }
                      : isRevoked
                        ? {
                          label: "Revoked",
                          className: "bg-red-500/10 text-red-400 border-red-500/20",
                        }
                        : installed
                          ? {
                            label: "Installed",
                            className:
                              "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                          }
                          : null;
                const showInstallBadge = Boolean(installBadge) && !headerStatus;

                const disablePauseResume =
                  isMutating ||
                  isThisUninstalling ||
                  isBudgetLoading ||
                  isResuming ||
                  isPausing ||
                  isPendingRevocation ||
                  isPendingWebhook ||
                  (isPaused ? !canResume : !canPause);
                const disableBudgetActions =
                  !canManageBudget || isMutating || isBudgetLoading || isThisUninstalling;
                const disableUninstall =
                  isMutating || isThisUninstalling || isBudgetLoading;
                const canConfigure = resolvedConfigQuestions.length > 0;
                const disableConfigure =
                  !canConfigure || isMutating || isThisUninstalling || isBudgetLoading;

                return (
                  <div
                    key={installation.installationId}
                    className={isEmbedded ? "rounded-lg" : "rounded-2xl"}
                  >
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 md:p-6 pb-4 md:pb-5">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-start gap-3 md:gap-4 mb-4">
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {iconSrc ? (
                                <img
                                  src={iconSrc}
                                  alt={agentMeta.displayName}
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
                                {agentMeta.displayName}
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

                        <AgentActionsMenu
                          isPaused={isPaused}
                          onPauseToggle={handlePauseToggle}
                          pauseDisabled={disablePauseResume}
                          onViewDetails={() => setDetailsAgent(agentMeta)}
                          onConfigure={canConfigure ? handleConfigure : undefined}
                          configureDisabled={disableConfigure}
                          onIncreaseBudget={handleStartBudgetIncrease}
                          onDecreaseBudget={handleStartBudgetDecrease}
                          increaseDisabled={disableBudgetActions}
                          decreaseDisabled={disableBudgetActions}
                          onUninstall={() => handleUninstall(installation)}
                          uninstallDisabled={disableUninstall}
                          uninstallLabel={
                            isPendingRevocation ? "Finish uninstall" : "Uninstall agent"
                          }
                        />
                      </div>

                      {isProvisioning ? (
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
                            onClick={() => handleRetryProvisioning(installation)}
                            disabled={isRetryingProvisioning || isMutating}
                            className="border-blue-500/30 text-blue-200 hover:bg-blue-500/10"
                          >
                            {isRetryingProvisioning ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            {isRetryingProvisioning ? "Retrying…" : "Retry"}
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

                      {showBudget && !isRevoked ? (
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
                      ) : null}
                      <div className="mt-3 text-xs text-zinc-500">
                        {feeSummary ? (
                          <span>
                            Fees{feeBoundAt ? " (bound at install)" : ""}: Platform{" "}
                            {formatBps(feeSummary.platformFeeBps)} • Tenant{" "}
                            {formatBps(feeSummary.tenantFeeBps)} • Total{" "}
                            {formatBps(feeSummary.totalFeeBps)}
                          </span>
                        ) : (
                          <span>Fees: Not specified</span>
                        )}
                      </div>

                      {rowBudgetAction !== "none" && canManageBudget ? (
                        <div className="space-y-3 mt-4">
                          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <p className="text-sm text-blue-400">
                              {rowBudgetAction === "increase"
                                ? "Enter amount to increase budget"
                                : "Enter amount to decrease budget"}
                            </p>
                          </div>

                          <div className="space-y-3">
                            {perTokenBudgetRows.map((row) => (
                              <div key={row.tokenPoolId} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs text-zinc-400">
                                  <span>{row.symbol}</span>
                                  <span>
                                    Current: {toUsageDisplay(row.budgetRaw, row.decimals)}
                                  </span>
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
                                  disabled={isBudgetLoading || isMutating}
                                />
                              </div>
                            ))}
                          </div>

                          {budgetError ? (
                            <p className="text-xs text-red-400">{budgetError}</p>
                          ) : null}

                          <div className="flex gap-3">
                            <Button
                              onClick={
                                rowBudgetAction === "increase"
                                  ? handleConfirmBudgetIncrease
                                  : handleConfirmBudgetDecrease
                              }
                              disabled={
                                !perTokenBudgetRows.length || isBudgetLoading || isMutating
                              }
                              className={
                                rowBudgetAction === "increase"
                                  ? "flex-1 bg-white hover:bg-zinc-100 text-black"
                                  : "flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                              }
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Confirm {rowBudgetAction === "increase" ? "increase" : "decrease"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleCancelBudget}
                              className="flex-1 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                              disabled={isBudgetLoading || isMutating}
                            >
                              <X className="w-4 h-4 mr-2" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Details Modal (same UI style as AgentMarketplaceCard Details) */}
        {detailsAgent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailsTitleIdRef.current}
            aria-describedby={detailsDescriptionIdRef.current}
            onMouseDown={(e) => {
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
                        {categoryIcons[(detailsAgent as any).category] || <Zap className="h-6 w-6 text-muted-foreground" />}
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
                          {(detailsAgent as any).featured ? (
                            <Badge variant="secondary" className="text-xs">
                              Featured
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            {categoryIcons[(detailsAgent as any).category]}
                            {categoryLabels[(detailsAgent as any).category] || (detailsAgent as any).category}
                          </span>
                          <span>
                            {(detailsAgent as any).feeSummary
                              ? `Platform ${formatBps((detailsAgent as any).feeSummary.platformFeeBps)} • Tenant ${formatBps((detailsAgent as any).feeSummary.tenantFeeBps)}`
                              : "Fees unavailable"}
                          </span>
                          <span>{(detailsAgent as any).installCount?.toLocaleString?.() ?? 0} installs</span>
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
                          {detailsAgent?.network?.name ?? "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Operating token</span>
                        <span className="font-medium text-right">
                          {(detailsAgent as any).operatingToken?.symbol ?? "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Minimum budget</span>
                        <span className="font-mono text-right">
                          {(() => {
                            const min = (detailsAgent as any).minimumBudget as string | null | undefined;
                            if (!min) return "Not specified";
                            const decimals = (detailsAgent as any).operatingToken?.decimals as number | undefined;
                            const symbol = (detailsAgent as any).operatingToken?.symbol as string | undefined;
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
                    </div>

                    {(detailsAgent as any).tags && (detailsAgent as any).tags.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(detailsAgent as any).tags.map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    {((detailsAgent as any).publisherName ||
                      (detailsAgent as any).publisherUrl ||
                      (detailsAgent as any).contactEmail ||
                      (detailsAgent as any).supportUrl ||
                      (detailsAgent as any).privacyPolicyUrl ||
                      (detailsAgent as any).termsUrl) ? (
                      <div className="mt-4 rounded-lg border p-3 text-sm">
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Publisher</span>
                            <span className="font-medium text-right">
                              {(detailsAgent as any).publisherName ??
                                (detailsAgent as any).publisherUrl ??
                                "Not specified"}
                            </span>
                          </div>
                          {(detailsAgent as any).contactEmail ? (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Contact</span>
                              <span className="font-medium text-right">{(detailsAgent as any).contactEmail}</span>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {(detailsAgent as any).publisherUrl ? (
                              <a
                                href={(detailsAgent as any).publisherUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                              >
                                Website
                              </a>
                            ) : null}
                            {(detailsAgent as any).supportUrl ? (
                              <a
                                href={(detailsAgent as any).supportUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                              >
                                Support
                              </a>
                            ) : null}
                            {(detailsAgent as any).privacyPolicyUrl ? (
                              <a
                                href={(detailsAgent as any).privacyPolicyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                              >
                                Privacy
                              </a>
                            ) : null}
                            {(detailsAgent as any).termsUrl ? (
                              <a
                                href={(detailsAgent as any).termsUrl}
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

                    {(detailsAgent as any).releaseNotes ? (
                      <div className="mt-4 rounded-lg border p-3 text-sm">
                        <div className="text-muted-foreground text-xs mb-1">Release notes</div>
                        <div className="whitespace-pre-wrap">{(detailsAgent as any).releaseNotes}</div>
                      </div>
                    ) : null}

                    <div className="mt-5 flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled>
                        Installed
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDetailsAgent(null)}>
                        Done
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {configInstallation && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={configTitleIdRef.current}
            aria-describedby={configDescriptionIdRef.current}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) handleCloseConfig();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleCloseConfig();
              trapFocusWithin(e, configPanelRef.current);
            }}
            tabIndex={-1}
            ref={configOverlayRef}
          >
            <div
              ref={configPanelRef}
              className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-hidden overflow-y-auto rounded-lg border bg-background shadow-lg"
            >
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 id={configTitleIdRef.current} className="text-lg font-semibold truncate">
                      Configure {configInstallation.service?.displayName ?? "agent"}
                    </h3>
                    <p
                      id={configDescriptionIdRef.current}
                      className="text-sm text-muted-foreground"
                    >
                      Update the installation settings used by this agent.
                    </p>
                  </div>
                  <Button
                    ref={configCloseRef}
                    variant="outline"
                    size="sm"
                    onClick={handleCloseConfig}
                    aria-label="Close configuration dialog"
                  >
                    Close
                  </Button>
                </div>

                {configQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This agent does not expose configurable install questions.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {configQuestions.map((question) => {
                      const inputId = `config-${configInstallation.installationId}-${question.key}`;
                      const error = configErrors[question.key];
                      const existingValue =
                        configInstallation.installInputs?.[question.key] ?? "";
                      const isSelect = question.type === "select";
                      const selectOptions = getQuestionOptions(question);
                      const optionValues = getQuestionOptionValues(question);
                      const allowsCustom = allowsCustomSelectValue(question);
                      const currentInputValue = configInputs[question.key] ?? "";
                      const hasMappedOption = optionValues.has(currentInputValue);
                      const isCustomMode =
                        isSelect &&
                        allowsCustom &&
                        (configCustomSelectModeByKey[question.key] === true ||
                          (!hasMappedOption && currentInputValue.trim() !== ""));
                      const selectValue = isCustomMode
                        ? CUSTOM_SELECT_VALUE
                        : hasMappedOption
                          ? currentInputValue
                          : "";
                      const showCustomInput =
                        isSelect && allowsCustom && isCustomMode;
                      const placeholder =
                        question.sensitive && existingValue
                          ? "Saved"
                          : question.default !== undefined && question.default !== null
                            ? String(question.default)
                            : undefined;
                      return (
                        <div key={question.key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={inputId}>{question.label}</Label>
                            <span className="text-xs text-muted-foreground">
                              {question.required ? "Required" : "Optional"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelect ? (
                              <select
                                id={inputId}
                                value={selectValue}
                                onChange={(event) => {
                                  const nextSelection = event.target.value;
                                  setConfigInputs((prev) => {
                                    if (nextSelection === CUSTOM_SELECT_VALUE) {
                                      const existing = prev[question.key] ?? "";
                                      const nextCustom = optionValues.has(existing)
                                        ? ""
                                        : existing;
                                      return {
                                        ...prev,
                                        [question.key]: nextCustom,
                                      };
                                    }
                                    return {
                                      ...prev,
                                      [question.key]: nextSelection,
                                    };
                                  });
                                  setConfigCustomSelectModeByKey((prev) => ({
                                    ...prev,
                                    [question.key]:
                                      nextSelection === CUSTOM_SELECT_VALUE,
                                  }));
                                  setConfigErrors((prev) => {
                                    if (!prev[question.key]) return prev;
                                    const next = { ...prev };
                                    delete next[question.key];
                                    return next;
                                  });
                                }}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="">Select an option</option>
                                {selectOptions.map((option) => (
                                  <option
                                    key={`${question.key}-${option.value}`}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                                {allowsCustom ? (
                                  <option value={CUSTOM_SELECT_VALUE}>
                                    Custom value
                                  </option>
                                ) : null}
                              </select>
                            ) : (
                              <Input
                                id={inputId}
                                type={
                                  question.type === "number"
                                    ? "text"
                                    : question.sensitive
                                      ? "password"
                                      : "text"
                                }
                                min={
                                  question.type === "number" && typeof question.min === "number"
                                    ? question.min
                                    : undefined
                                }
                                max={
                                  question.type === "number" && typeof question.max === "number"
                                    ? question.max
                                    : undefined
                                }
                                step={
                                  question.type === "number"
                                    ? typeof question.step === "number"
                                      ? question.step
                                      : "any"
                                    : undefined
                                }
                                value={currentInputValue}
                                onChange={(e) => {
                                  const nextValue =
                                    question.type === "number"
                                      ? sanitizeUnsignedDecimalInput(e.target.value)
                                      : e.target.value;
                                  setConfigInputs((prev) => ({
                                    ...prev,
                                    [question.key]: nextValue,
                                  }));
                                  setConfigErrors((prev) => {
                                    if (!prev[question.key]) return prev;
                                    const next = { ...prev };
                                    delete next[question.key];
                                    return next;
                                  });
                                }}
                                inputMode={question.type === "number" ? "decimal" : undefined}
                                placeholder={placeholder}
                                autoComplete={question.sensitive ? "off" : undefined}
                              />
                            )}
                            {question.unit ? (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {question.unit}
                              </span>
                            ) : null}
                          </div>
                          {showCustomInput ? (
                            <Input
                              value={currentInputValue}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setConfigInputs((prev) => ({
                                  ...prev,
                                  [question.key]: nextValue,
                                }));
                                setConfigCustomSelectModeByKey((prev) => ({
                                  ...prev,
                                  [question.key]: true,
                                }));
                                setConfigErrors((prev) => {
                                  if (!prev[question.key]) return prev;
                                  const next = { ...prev };
                                  delete next[question.key];
                                  return next;
                                });
                              }}
                              placeholder="Enter custom value"
                            />
                          ) : null}
                          {question.sensitive ? (
                            <p className="text-xs text-muted-foreground">
                              Leave blank to keep the current value.
                            </p>
                          ) : null}
                          {error ? (
                            <p className="text-xs text-red-400">{error}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {configSubmitError ? (
                  <div className="text-xs text-red-400">{configSubmitError}</div>
                ) : null}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={handleCloseConfig} disabled={configSaving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitConfig} disabled={configSaving || isMutating}>
                    {configSaving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
}
