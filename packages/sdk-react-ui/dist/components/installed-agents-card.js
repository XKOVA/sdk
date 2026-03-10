"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMyAgentInstallations, useAgentInstallationActions, useTenantConfig, useMarketplaceAgents, useIeeContext, useIeeReceiptAction, useRealtimeStatus } from "@xkova/sdk-react";
import { SDKError } from "@xkova/sdk-core";
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
import { RefreshCw, Bot, AlertCircle, Zap, CreditCard, ShoppingCart, Info, DollarSign, Check, X, TrendingUp, BarChart3, Bell, } from "lucide-react";
import { DEFAULT_AGENT_INSTALLATIONS_POLL_MS } from "./agent-polling.js";
import { trapFocusWithin } from "../utils.js";
import { toastError } from "../toast-utils.js";
const formatAgentLoadError = (err) => {
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
        : "Failed to load agents.";
    return message;
};
/** Category icon mapping (keeps Details modal consistent with AgentMarketplaceCard) */
const categoryIcons = {
    trading: _jsx(TrendingUp, { className: "h-4 w-4" }),
    payments: _jsx(CreditCard, { className: "h-4 w-4" }),
    ecommerce: _jsx(ShoppingCart, { className: "h-4 w-4" }),
    defi: _jsx(Zap, { className: "h-4 w-4" }),
    analytics: _jsx(BarChart3, { className: "h-4 w-4" }),
    notifications: _jsx(Bell, { className: "h-4 w-4" }),
};
/** Category label mapping (keeps Details modal consistent with AgentMarketplaceCard) */
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
const getBudgetColor = (percentage) => {
    if (percentage >= 90)
        return "bg-red-500";
    if (percentage >= 80)
        return "bg-orange-500";
    if (percentage >= 70)
        return "bg-yellow-500";
    return "bg-emerald-500";
};
const isValidTxHash = (value) => /^0x[a-fA-F0-9]{64}$/.test(value);
const stableStringify = (value) => {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
        const entries = Object.entries(value)
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
const getQuestionOptions = (question) => (question.options ?? [])
    .map((option) => {
    const value = typeof option?.value === "string" ? option.value.trim() : "";
    const labelRaw = typeof option?.label === "string" ? option.label.trim() : "";
    return {
        value,
        label: labelRaw || value,
    };
})
    .filter((option) => option.value.length > 0);
const getQuestionOptionValues = (question) => new Set(getQuestionOptions(question).map((option) => option.value));
const allowsCustomSelectValue = (question) => question.allow_custom === true;
/**
 * Keep number-question inputs restricted to unsigned decimal text while typing.
 */
const sanitizeUnsignedDecimalInput = (value) => {
    const cleaned = value.replace(/[^\d.]/g, "");
    const [whole = "", ...fractionParts] = cleaned.split(".");
    const fraction = fractionParts.join("");
    return fractionParts.length > 0 ? `${whole}.${fraction}` : whole;
};
const buildConfigUpdatePayload = (questions, inputs, existingInputs) => {
    const payload = {};
    const errors = {};
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
        }
        else if (question.type === "select") {
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
export function InstalledAgentsCard({ onConfigure, onUninstall, showBudget = true, autoRefreshMs, showDeveloperDiagnostics = false, agentid, agentId, agentServiceId, variant = "card", forceExpanded, }) {
    const realtime = useRealtimeStatus();
    const installationsAutoRefreshMs = autoRefreshMs === undefined ? DEFAULT_AGENT_INSTALLATIONS_POLL_MS : autoRefreshMs;
    const resolvedAutoRefreshMs = useMemo(() => {
        if (!installationsAutoRefreshMs || installationsAutoRefreshMs <= 0) {
            return undefined;
        }
        return realtime.status === "connected" ? undefined : installationsAutoRefreshMs;
    }, [installationsAutoRefreshMs, realtime.status]);
    const installationsState = useMyAgentInstallations({
        autoRefreshMs: resolvedAutoRefreshMs,
    });
    const { installations, isLoading, error, refresh, failureCounts, failuresLoading, freshness: installationsFreshness, } = installationsState;
    const failureBreakdowns = installationsState.failureBreakdowns ?? {};
    const { agents: marketplaceAgents } = useMarketplaceAgents();
    const agentActions = useAgentInstallationActions();
    const { resumeInstallation, pauseInstallation, confirmRevocation, confirmIncreaseBudget, confirmDecreaseBudget, retryProvisioningWebhook, updateInstallationConfig, isLoading: isMutating, } = agentActions;
    const { networks, tokens } = useTenantConfig();
    const [uninstallingId, setUninstallingId] = useState(null);
    const [retryingProvisioningId, setRetryingProvisioningId] = useState(null);
    const [budgetEditInstallationId, setBudgetEditInstallationId] = useState(null);
    const [budgetAction, setBudgetAction] = useState("none");
    const [budgetInputsByTokenPoolId, setBudgetInputsByTokenPoolId] = useState({});
    const [budgetIncreaseLoadingId, setBudgetIncreaseLoadingId] = useState(null);
    const [budgetIncreaseError, setBudgetIncreaseError] = useState(null);
    const [budgetDecreaseLoadingId, setBudgetDecreaseLoadingId] = useState(null);
    const [budgetDecreaseError, setBudgetDecreaseError] = useState(null);
    const [resumeLoadingId, setResumeLoadingId] = useState(null);
    const [pauseLoadingId, setPauseLoadingId] = useState(null);
    const [detailsAgent, setDetailsAgent] = useState(null);
    const [configInstallation, setConfigInstallation] = useState(null);
    const [configQuestions, setConfigQuestions] = useState([]);
    const [configQuestionsVersion, setConfigQuestionsVersion] = useState(null);
    const [configInputs, setConfigInputs] = useState({});
    const [configCustomSelectModeByKey, setConfigCustomSelectModeByKey] = useState({});
    const [configErrors, setConfigErrors] = useState({});
    const [configSubmitError, setConfigSubmitError] = useState(null);
    const [configSaving, setConfigSaving] = useState(false);
    const { tenantId, clientId, userId } = useIeeContext();
    const iee = useIeeReceiptAction();
    const detailsOverlayRef = useRef(null);
    const detailsPanelRef = useRef(null);
    const detailsCloseRef = useRef(null);
    const configOverlayRef = useRef(null);
    const configPanelRef = useRef(null);
    const configCloseRef = useRef(null);
    const lastActiveElementRef = useRef(null);
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
        if (!normalizedFilter)
            return installations;
        return installations.filter((i) => i.agentServiceId.toLowerCase() === normalizedFilter);
    }, [installations, normalizedFilter]);
    const filteredFailureCounts = useMemo(() => {
        if (!normalizedFilter)
            return failureCounts;
        const map = {};
        for (const inst of filteredInstallations) {
            const count = failureCounts?.[inst.installationId];
            if (count !== undefined) {
                map[inst.installationId] = count;
            }
        }
        return map;
    }, [failureCounts, filteredInstallations, normalizedFilter]);
    const filteredFailureBreakdowns = useMemo(() => {
        if (!normalizedFilter)
            return failureBreakdowns;
        const map = {};
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
    useEffect(() => {
        if (!configInstallation)
            return;
        if (typeof document === "undefined")
            return;
        lastActiveElementRef.current =
            typeof document !== "undefined"
                ? document.activeElement
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
        if (!configInstallation)
            return;
        setConfigSubmitError(null);
        setConfigSaving(true);
        try {
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const existingInputs = configInstallation.installInputs && typeof configInstallation.installInputs === "object"
                ? configInstallation.installInputs
                : {};
            const validation = buildConfigUpdatePayload(configQuestions, configInputs, existingInputs);
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
                throw new Error(receipt.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receipt.error?.message ?? "SafeApprove approval failed");
            }
            await updateInstallationConfig(configInstallation.installationId, validation.payload, {
                installQuestionsVersion: configQuestionsVersion ?? null,
                receipt: receipt.receipt,
            });
            handleCloseConfig();
            refresh();
        }
        catch (e) {
            const message = e instanceof Error ? e.message : "Failed to update agent config";
            setConfigSubmitError(message);
            toastError("InstalledAgentsCard config update failed", e instanceof Error ? e : new Error(message), "Could not update agent configuration. Please try again.");
        }
        finally {
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
    const handleRetryProvisioning = useCallback(async (installation) => {
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
                throw new Error(receipt.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receipt.error?.message ?? "SafeApprove approval failed");
            }
            await retryProvisioningWebhook(installation.installationId, receipt.receipt);
            refresh();
        }
        catch (err) {
            toastError("InstalledAgentsCard retry provisioning failed", err instanceof Error ? err : new Error("Failed to retry provisioning"), "Failed to retry provisioning webhook");
        }
        finally {
            setRetryingProvisioningId(null);
        }
    }, [clientId, iee, refresh, retryProvisioningWebhook, tenantId, userId]);
    const handleUninstall = useCallback(async (installation) => {
        if (onUninstall) {
            onUninstall(installation);
            return;
        }
        if (!tenantId || !clientId || !userId) {
            toastError("InstalledAgentsCard uninstall failed", new Error("Missing tenant/client/user context"), "Missing tenant/client/user context");
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
                throw new Error(receipt.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receipt.error?.message ?? "SafeApprove approval failed");
            }
            const isPendingRevocation = installation.revocationPending === true ||
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
                    throw new Error(confirmReceipt.status === "cancelled"
                        ? "SafeApprove approval cancelled"
                        : confirmReceipt.error?.message ?? "SafeApprove approval failed");
                }
                if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
                    throw new Error("SafeApprove approval did not return a valid transaction hash");
                }
                await confirmRevocation(installation.installationId, txHash, confirmReceipt.receipt);
            }
            else if (isPendingRevocation) {
                throw new Error("SafeApprove approval did not return a valid transaction hash");
            }
            refresh();
        }
        catch (err) {
            toastError("InstalledAgentsCard uninstall failed", err, "Unable to uninstall agent. Please try again.");
        }
        finally {
            setUninstallingId(null);
        }
    }, [onUninstall, iee, tenantId, clientId, userId, confirmRevocation, refresh]);
    const safeBigInt = (v) => {
        const raw = (v ?? "0").toString();
        const normalized = raw.includes(".") ? raw.split(".")[0] : raw;
        try {
            return BigInt(normalized || "0");
        }
        catch {
            return 0n;
        }
    };
    const parseTokenAmountToBaseUnits = (value, decimals) => {
        const raw = (value ?? "").trim();
        if (!raw)
            return 0n;
        if (raw.startsWith("-"))
            throw new Error("Amount must be positive");
        if (!decimals || decimals <= 0)
            return BigInt(raw);
        const [wholeRaw, fracRaw = ""] = raw.split(".");
        const whole = wholeRaw === "" ? 0n : BigInt(wholeRaw);
        const fracTrimmed = fracRaw.slice(0, decimals);
        const fracPadded = fracTrimmed.padEnd(decimals, "0");
        const frac = fracPadded === "" ? 0n : BigInt(fracPadded);
        const base = 10n ** BigInt(decimals);
        return whole * base + frac;
    };
    const formatUnits = (value, decimals) => {
        const v = safeBigInt(value);
        if (!decimals || decimals <= 0)
            return v.toString();
        const base = 10n ** BigInt(decimals);
        const whole = v / base;
        const frac = v % base;
        const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
        return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
    };
    const toFixedDisplay = (value, decimals, maxFractionDigits = 2) => {
        const formatted = formatUnits(value, decimals);
        const [w, f = ""] = formatted.split(".");
        if (maxFractionDigits <= 0)
            return w;
        if (!f)
            return `${w}.00`.slice(0, w.length + 1 + maxFractionDigits);
        const trimmed = f.slice(0, maxFractionDigits).padEnd(maxFractionDigits, "0");
        return `${w}.${trimmed}`;
    };
    const toUsageDisplay = (value, decimals) => {
        const fixed2 = toFixedDisplay(value, decimals, 2);
        if (safeBigInt(value) <= 0n)
            return fixed2;
        if (fixed2 !== "0.00")
            return fixed2;
        const formatted = formatUnits(value, decimals);
        const [w, f = ""] = formatted.split(".");
        if (!f)
            return fixed2;
        const maxFractionDigits = Math.max(2, Math.min(decimals, 8));
        const clipped = f.slice(0, maxFractionDigits).replace(/0+$/, "");
        return clipped ? `${w}.${clipped}` : fixed2;
    };
    const { isInitialLoading, isRefreshing } = useRefreshState(isLoading, installations.length > 0);
    if (isInitialLoading) {
        return (_jsxs(Card, { className: isEmbedded ? "border-0 bg-transparent shadow-none" : undefined, children: [_jsxs(CardHeader, { className: isEmbedded ? "px-0 pt-0 pb-0" : undefined, children: [_jsx(Skeleton, { className: "h-6 w-32" }), _jsx(Skeleton, { className: "h-4 w-48 mt-2" })] }), _jsxs(CardContent, { className: isEmbedded ? "space-y-3 px-0 pt-0 pb-0" : "space-y-3", children: [_jsx(Skeleton, { className: "h-20 w-full" }), _jsx(Skeleton, { className: "h-20 w-full" })] })] }));
    }
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { className: isEmbedded ? "border-0 bg-transparent shadow-none" : undefined, children: [!isEmbedded ? (_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Bot, { className: "h-5 w-5" }), normalizedFilter ? "Agent" : "My Agents", _jsx(Badge, { variant: feedHealth.variant, children: feedHealth.label })] }), description: _jsx(CardDescription, { children: "Your installed agent services." }), actions: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { variant: "outline", size: "icon-sm", onClick: handleRefresh, disabled: isRefreshing, "aria-label": "Refresh agents", children: _jsx(RefreshCw, { className: `h-4 w-4 ${isRefreshing ? "animate-spin" : ""}` }) }) }) }), _jsx(TooltipContent, { children: "Refresh agents" })] }) }) })) : null, _jsxs(CardContent, { className: isEmbedded ? "space-y-4 px-0 pt-0 pb-0" : "space-y-4", children: [showRealtimeFallbackNotice ? (_jsxs("div", { className: "rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900", children: ["Realtime connection is unavailable", realtimeFallbackReason, "; polling fallback", resolvedAutoRefreshMs
                                    ? ` every ${Math.max(1, Math.round(resolvedAutoRefreshMs / 1000))}s`
                                    : " is disabled", "."] })) : null, error && (_jsxs("div", { className: "text-sm text-destructive py-4 text-center", children: ["Failed to load agents: ", formatAgentLoadError(error)] })), !error && filteredInstallations.length === 0 && (_jsxs(CardEmptyState, { className: "py-8", children: [_jsx(Bot, { className: "h-12 w-12 mx-auto mb-3 text-muted-foreground/50" }), _jsx("p", { children: "You haven't installed any agents yet." }), _jsx("p", { className: "text-xs mt-1", children: "Browse the marketplace to get started." })] })), !error && filteredInstallations.length > 0 && (_jsx("div", { className: "space-y-4", children: filteredInstallations.map((installation) => {
                                const isPendingRevocation = installation.revocationPending === true ||
                                    installation.rawStatus === "pending_revocation";
                                const isPendingWebhook = installation.rawStatus === "pending_webhook";
                                const isRevoked = installation.status === "revoked" && !isPendingRevocation;
                                const isProvisioning = isPendingWebhook && !isPendingRevocation;
                                const isPaused = installation.status === "paused";
                                const isSuspended = installation.status === "suspended";
                                const installed = !isRevoked && !isPendingRevocation && !isPendingWebhook;
                                const net = networks.find((n) => String(n.networkId) === String(installation.networkId));
                                const installationWithTokenBudgets = installation;
                                const selectedInstallationToken = installation.operatingToken ?? null;
                                const selectedTenantToken = selectedInstallationToken?.tokenPoolId
                                    ? tokens.find((token) => token.id ===
                                        selectedInstallationToken.tokenPoolId) ?? null
                                    : null;
                                const installationOperatingTokens = Array.isArray(installationWithTokenBudgets.availableOperatingTokens)
                                    ? installationWithTokenBudgets.availableOperatingTokens
                                    : [];
                                const marketplaceAgent = marketplaceAgents.find((a) => a.agentServiceId === installation.agentServiceId) ?? null;
                                const agentFeeSummary = installation.feeSummary ?? marketplaceAgent?.feeSummary ?? null;
                                const agentMetaBase = marketplaceAgent ??
                                    {
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
                                        category: "misc",
                                        pricingModel: null,
                                        pricingDetails: {},
                                        minimumBudget: null,
                                        status: "approved",
                                        featured: false,
                                        featuredOrder: null,
                                        installCount: 0,
                                        createdAt: installation.installedAt,
                                        updatedAt: installation.installedAt,
                                    };
                                const agentMeta = {
                                    ...agentMetaBase,
                                    feeSummary: agentFeeSummary,
                                };
                                const categoryLabel = categoryLabels[agentMeta.category] ?? agentMeta.category;
                                const feeLabel = agentMeta.feeSummary
                                    ? `Platform ${formatBps(agentMeta.feeSummary.platformFeeBps)} • Tenant ${formatBps(agentMeta.feeSummary.tenantFeeBps)}`
                                    : "Fees unavailable";
                                const iconSrc = agentMeta.iconUrl ??
                                    agentMeta.avatarUrl ??
                                    installation.service.iconUrl ??
                                    installation.service.avatarUrl ??
                                    null;
                                const description = agentMeta.description ||
                                    installation.service.description ||
                                    "No description available.";
                                const tags = agentMeta.tags ?? [];
                                const installCountLabel = agentMeta.installCount.toLocaleString();
                                const networkName = net?.name ?? agentMeta.network?.name ?? String(installation.networkId);
                                const marketplaceOperatingTokens = Array.isArray(agentMeta.availableOperatingTokens)
                                    ? agentMeta.availableOperatingTokens
                                    : [];
                                const fallbackOperatingTokens = [];
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
                                const operatingTokenMap = new Map();
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
                                    const tokenPoolId = typeof token.tokenPoolId === "string"
                                        ? token.tokenPoolId.trim()
                                        : "";
                                    if (!tokenPoolId)
                                        continue;
                                    const symbol = typeof token.symbol === "string" ? token.symbol.trim() : "";
                                    const name = typeof token.name === "string" ? token.name.trim() : "";
                                    const contract = typeof token.contract === "string"
                                        ? token.contract.trim()
                                        : "";
                                    const logoUrl = typeof token.logoUrl === "string"
                                        ? token.logoUrl.trim()
                                        : "";
                                    const decimals = typeof token.decimals === "number" &&
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
                                    if (!symbol)
                                        return false;
                                    return items.indexOf(symbol) === index;
                                });
                                const tokenLabel = tokenSymbolsForStats.join(" + ") ||
                                    selectedTenantToken?.symbol ||
                                    selectedInstallationToken?.symbol ||
                                    agentMeta.operatingToken?.symbol ||
                                    "";
                                const tokenDecimals = selectedTenantToken?.decimals ??
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
                                const stats = [{ key: "installs", value: `${installCountLabel} installs` }];
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
                                const tokenBudgetsByTokenPoolId = installationWithTokenBudgets.tokenBudgetsByTokenPoolId &&
                                    typeof installationWithTokenBudgets.tokenBudgetsByTokenPoolId === "object"
                                    ? installationWithTokenBudgets.tokenBudgetsByTokenPoolId
                                    : null;
                                const tokenSymbolsByTokenPoolId = installationWithTokenBudgets.tokenSymbolsByTokenPoolId &&
                                    typeof installationWithTokenBudgets.tokenSymbolsByTokenPoolId === "object"
                                    ? installationWithTokenBudgets.tokenSymbolsByTokenPoolId
                                    : null;
                                const tokenBudgetUsedByTokenPoolId = installationWithTokenBudgets.tokenBudgetUsedByTokenPoolId &&
                                    typeof installationWithTokenBudgets.tokenBudgetUsedByTokenPoolId === "object"
                                    ? installationWithTokenBudgets.tokenBudgetUsedByTokenPoolId
                                    : null;
                                const transactionCountByTokenPoolId = installationWithTokenBudgets.transactionCountByTokenPoolId &&
                                    typeof installationWithTokenBudgets.transactionCountByTokenPoolId === "object"
                                    ? installationWithTokenBudgets.transactionCountByTokenPoolId
                                    : null;
                                const perTokenBudgetRows = resolvedOperatingTokens
                                    .map((token) => {
                                    const rawBudget = tokenBudgetsByTokenPoolId &&
                                        typeof tokenBudgetsByTokenPoolId[token.tokenPoolId] === "string"
                                        ? tokenBudgetsByTokenPoolId[token.tokenPoolId].trim()
                                        : "";
                                    const normalizedBudgetRaw = /^\d+$/.test(rawBudget) ? rawBudget : "";
                                    const rawUsed = tokenBudgetUsedByTokenPoolId &&
                                        typeof tokenBudgetUsedByTokenPoolId[token.tokenPoolId] === "string"
                                        ? tokenBudgetUsedByTokenPoolId[token.tokenPoolId].trim()
                                        : "0";
                                    const normalizedUsedRaw = /^\d+$/.test(rawUsed) ? rawUsed : "0";
                                    const tenantToken = tokens.find((tenantToken) => tenantToken.id === token.tokenPoolId) ?? null;
                                    const decimals = (typeof tenantToken?.decimals === "number"
                                        ? tenantToken.decimals
                                        : token.decimals) ?? tokenDecimals;
                                    const symbol = token.symbol ||
                                        (tokenSymbolsByTokenPoolId &&
                                            typeof tokenSymbolsByTokenPoolId[token.tokenPoolId] === "string"
                                            ? tokenSymbolsByTokenPoolId[token.tokenPoolId].trim()
                                            : "") ||
                                        (typeof tenantToken?.symbol === "string" &&
                                            tenantToken.symbol.trim()) ||
                                        "TOKEN";
                                    const logoUrl = (typeof token.logoUrl === "string" && token.logoUrl.trim()) ||
                                        (typeof tenantToken?.logoUrl === "string" &&
                                            tenantToken.logoUrl.trim()
                                            ? tenantToken.logoUrl.trim()
                                            : "") ||
                                        null;
                                    const rawTxCount = transactionCountByTokenPoolId &&
                                        typeof transactionCountByTokenPoolId[token.tokenPoolId] === "number"
                                        ? transactionCountByTokenPoolId[token.tokenPoolId]
                                        : Number(String(transactionCountByTokenPoolId?.[token.tokenPoolId] ?? 0).trim());
                                    const txCount = Number.isFinite(rawTxCount)
                                        ? Math.max(0, Math.floor(rawTxCount))
                                        : 0;
                                    const budgetUsedBigInt = safeBigInt(normalizedUsedRaw);
                                    const budgetTotalBigInt = safeBigInt(normalizedBudgetRaw);
                                    const budgetPercentage = budgetTotalBigInt > 0n
                                        ? Number((budgetUsedBigInt * 10000n) / budgetTotalBigInt) / 100
                                        : 0;
                                    return {
                                        tokenPoolId: token.tokenPoolId,
                                        symbol,
                                        logoUrl,
                                        decimals,
                                        budgetRaw: normalizedBudgetRaw || "0",
                                        usageDisplay: normalizedBudgetRaw && /^\d+$/.test(normalizedBudgetRaw)
                                            ? `${toUsageDisplay(normalizedUsedRaw, decimals)} / ${toUsageDisplay(normalizedBudgetRaw, decimals)} ${symbol}`
                                            : "Not set",
                                        txCount,
                                        budgetPercentage,
                                        budgetBarWidth: Math.min(budgetPercentage, 100),
                                        budgetPercentText: Number.isFinite(budgetPercentage)
                                            ? budgetPercentage.toFixed(1)
                                            : "0.0",
                                    };
                                })
                                    .filter((row) => Boolean(row));
                                const isThisUninstalling = uninstallingId === installation.agentActorId;
                                const isRetryingProvisioning = retryingProvisioningId === installation.installationId;
                                const isEditingBudget = budgetEditInstallationId === installation.installationId;
                                const isBudgetIncreasing = budgetIncreaseLoadingId === installation.installationId;
                                const isBudgetDecreasing = budgetDecreaseLoadingId === installation.installationId;
                                const isBudgetLoading = isBudgetIncreasing || isBudgetDecreasing;
                                const isResuming = resumeLoadingId === installation.installationId;
                                const isPausing = pauseLoadingId === installation.installationId;
                                const failureCount = filteredFailureCounts?.[installation.installationId] ?? 0;
                                const failureBreakdown = filteredFailureBreakdowns?.[installation.installationId] ?? null;
                                const onChainFailures = failureBreakdown?.onChainFailures ?? failureCount;
                                const preSubmissionFailures = failureBreakdown?.preSubmissionFailures ?? 0;
                                const pauseCode = installation.pauseCode ?? null;
                                const rowBudgetAction = isEditingBudget ? budgetAction : "none";
                                const budgetError = rowBudgetAction === "decrease" ? budgetDecreaseError : budgetIncreaseError;
                                const canResume = installation.status === "paused" &&
                                    !isPendingRevocation &&
                                    ["developer_failure_threshold", "user_insufficient_balance", "user_paused"].includes(pauseCode ?? "");
                                const isTenantPolicyPaused = installation.status === "paused" &&
                                    pauseCode === "tenant_blacklisted";
                                const tenantPolicyReason = installation.blacklistReason?.trim() ||
                                    "Disabled by tenant owner or tenant policy.";
                                const canPause = installation.status === "active" && !isPendingRevocation && !isPendingWebhook;
                                const canManageBudget = !isPendingRevocation &&
                                    !isPendingWebhook &&
                                    !isRevoked &&
                                    (installation.status === "active" || installation.status === "paused");
                                const handleStartBudgetIncrease = () => {
                                    if (!canManageBudget)
                                        return;
                                    const nextInputs = perTokenBudgetRows.reduce((acc, row) => {
                                        acc[row.tokenPoolId] = formatUnits(row.budgetRaw, row.decimals);
                                        return acc;
                                    }, {});
                                    setBudgetIncreaseError(null);
                                    setBudgetDecreaseError(null);
                                    setBudgetEditInstallationId(installation.installationId);
                                    setBudgetAction("increase");
                                    setBudgetInputsByTokenPoolId(nextInputs);
                                };
                                const handleStartBudgetDecrease = () => {
                                    if (!canManageBudget)
                                        return;
                                    const nextInputs = perTokenBudgetRows.reduce((acc, row) => {
                                        acc[row.tokenPoolId] = formatUnits(row.budgetRaw, row.decimals);
                                        return acc;
                                    }, {});
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
                                const resolvedConfigQuestions = installation.installQuestions ??
                                    agentMeta.installQuestions ??
                                    [];
                                const resolvedConfigVersion = installation.installQuestionsVersion ??
                                    agentMeta.installQuestionsVersion ??
                                    null;
                                const handleConfigure = () => {
                                    if (onConfigure) {
                                        onConfigure(installation);
                                        return;
                                    }
                                    if (!resolvedConfigQuestions.length)
                                        return;
                                    setConfigInstallation(installation);
                                    setConfigQuestions(resolvedConfigQuestions);
                                    setConfigQuestionsVersion(resolvedConfigVersion);
                                    const existingInputs = installation.installInputs && typeof installation.installInputs === "object"
                                        ? installation.installInputs
                                        : {};
                                    const nextInputs = {};
                                    const nextCustomSelectMode = {};
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
                                        }
                                        else {
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
                                const buildTokenBudgetUpdate = (mode) => {
                                    if (!perTokenBudgetRows.length) {
                                        throw new Error("No operating tokens available for budget update");
                                    }
                                    let currentTotal = 0n;
                                    let nextTotal = 0n;
                                    let changedCount = 0;
                                    const normalizedTokenBudgets = perTokenBudgetRows.reduce((acc, row) => {
                                        const currentBudget = safeBigInt(row.budgetRaw);
                                        currentTotal += currentBudget;
                                        const inputValue = budgetInputsByTokenPoolId[row.tokenPoolId] ??
                                            formatUnits(row.budgetRaw, row.decimals);
                                        const nextBudget = parseTokenAmountToBaseUnits(inputValue, row.decimals);
                                        if (nextBudget <= 0n) {
                                            throw new Error(`Enter a budget greater than 0 for ${row.symbol || "token"}`);
                                        }
                                        if (mode === "increase" && nextBudget < currentBudget) {
                                            throw new Error(`Increase mode cannot reduce ${row.symbol || "token"} budget`);
                                        }
                                        if (mode === "decrease" && nextBudget > currentBudget) {
                                            throw new Error(`Decrease mode cannot increase ${row.symbol || "token"} budget`);
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
                                    const delta = mode === "increase"
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
                                        const { normalizedTokenBudgets, delta } = buildTokenBudgetUpdate("increase");
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
                                            throw new Error(receipt.status === "cancelled"
                                                ? "SafeApprove approval cancelled"
                                                : receipt.error?.message ?? "SafeApprove approval failed");
                                        }
                                        const preparationToken = receipt.preparationToken ?? null;
                                        if (!preparationToken) {
                                            throw new Error("SafeApprove approval missing preparation token");
                                        }
                                        const txHashRaw = receipt.transactionHash ?? null;
                                        const txHash = typeof txHashRaw === "string" ? txHashRaw.trim() : "";
                                        if (!isValidTxHash(txHash)) {
                                            throw new Error("SafeApprove approval did not return a valid transaction hash");
                                        }
                                        await confirmIncreaseBudget(installation.installationId, preparationToken, txHash, {
                                            receipt: receipt.receipt,
                                            tokenBudgetsByTokenPoolId: normalizedTokenBudgets,
                                            tokenBudgetMode: Object.keys(normalizedTokenBudgets).length > 1
                                                ? "all"
                                                : "single",
                                        });
                                        setBudgetEditInstallationId(null);
                                        setBudgetAction("none");
                                        setBudgetInputsByTokenPoolId({});
                                        refresh();
                                    }
                                    catch (e) {
                                        setBudgetIncreaseError(e instanceof Error ? e.message : "Failed to increase budget");
                                    }
                                    finally {
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
                                        const { normalizedTokenBudgets, delta } = buildTokenBudgetUpdate("decrease");
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
                                            throw new Error(receipt.status === "cancelled"
                                                ? "SafeApprove approval cancelled"
                                                : receipt.error?.message ?? "SafeApprove approval failed");
                                        }
                                        const preparationToken = receipt.preparationToken ?? null;
                                        if (!preparationToken) {
                                            throw new Error("SafeApprove approval missing preparation token");
                                        }
                                        const txHashRaw = receipt.transactionHash ?? null;
                                        const txHash = typeof txHashRaw === "string" ? txHashRaw.trim() : "";
                                        if (!isValidTxHash(txHash)) {
                                            throw new Error("SafeApprove approval did not return a valid transaction hash");
                                        }
                                        await confirmDecreaseBudget(installation.installationId, preparationToken, txHash, {
                                            receipt: receipt.receipt,
                                            tokenBudgetsByTokenPoolId: normalizedTokenBudgets,
                                            tokenBudgetMode: Object.keys(normalizedTokenBudgets).length > 1
                                                ? "all"
                                                : "single",
                                        });
                                        setBudgetEditInstallationId(null);
                                        setBudgetAction("none");
                                        setBudgetInputsByTokenPoolId({});
                                        refresh();
                                    }
                                    catch (e) {
                                        setBudgetDecreaseError(e instanceof Error ? e.message : "Failed to decrease budget");
                                    }
                                    finally {
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
                                            throw new Error(receipt.status === "cancelled"
                                                ? "SafeApprove approval cancelled"
                                                : receipt.error?.message ?? "SafeApprove approval failed");
                                        }
                                        await resumeInstallation(installation.installationId, receipt.receipt);
                                        refresh();
                                    }
                                    catch (e) {
                                        toastError("InstalledAgentsCard resume failed", e, "Failed to resume installation. Please try again.");
                                    }
                                    finally {
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
                                            throw new Error(receipt.status === "cancelled"
                                                ? "SafeApprove approval cancelled"
                                                : receipt.error?.message ?? "SafeApprove approval failed");
                                        }
                                        await pauseInstallation(installation.installationId, undefined, {
                                            receipt: receipt.receipt,
                                        });
                                        refresh();
                                    }
                                    catch (e) {
                                        toastError("InstalledAgentsCard pause failed", e, "Failed to pause installation. Please try again.");
                                    }
                                    finally {
                                        setPauseLoadingId(null);
                                    }
                                };
                                const handlePauseToggle = () => {
                                    if (installation.status === "paused") {
                                        if (!canResume)
                                            return;
                                        void handleResume();
                                        return;
                                    }
                                    if (!canPause)
                                        return;
                                    void handlePause();
                                };
                                const headerStatus = isPendingRevocation
                                    ? {
                                        label: "Uninstalling",
                                        className: "bg-red-500/10 text-red-400 border border-red-500/20",
                                        icon: _jsx(AlertCircle, { className: "w-3 h-3 mr-1" }),
                                    }
                                    : isProvisioning
                                        ? {
                                            label: "Provisioning",
                                            className: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                                            icon: _jsx(Info, { className: "w-3 h-3 mr-1" }),
                                        }
                                        : isPaused
                                            ? {
                                                label: "Paused",
                                                className: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                                                icon: _jsx(AlertCircle, { className: "w-3 h-3 mr-1" }),
                                            }
                                            : isSuspended
                                                ? {
                                                    label: "Suspended",
                                                    className: "bg-red-500/10 text-red-400 border border-red-500/20",
                                                    icon: _jsx(AlertCircle, { className: "w-3 h-3 mr-1" }),
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
                                                        className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                                    }
                                                    : null;
                                const showInstallBadge = Boolean(installBadge) && !headerStatus;
                                const disablePauseResume = isMutating ||
                                    isThisUninstalling ||
                                    isBudgetLoading ||
                                    isResuming ||
                                    isPausing ||
                                    isPendingRevocation ||
                                    isPendingWebhook ||
                                    (isPaused ? !canResume : !canPause);
                                const disableBudgetActions = !canManageBudget || isMutating || isBudgetLoading || isThisUninstalling;
                                const disableUninstall = isMutating || isThisUninstalling || isBudgetLoading;
                                const canConfigure = resolvedConfigQuestions.length > 0;
                                const disableConfigure = !canConfigure || isMutating || isThisUninstalling || isBudgetLoading;
                                return (_jsx("div", { className: isEmbedded ? "rounded-lg" : "rounded-2xl", children: _jsxs("div", { className: "bg-zinc-900 rounded-2xl border border-zinc-800 p-4 md:p-6 pb-4 md:pb-5", children: [_jsxs("div", { className: "flex items-start justify-between mb-6", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-start gap-3 md:gap-4 mb-4", children: [_jsx("div", { className: "w-12 h-12 md:w-16 md:h-16 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden", children: iconSrc ? (_jsx("img", { src: iconSrc, alt: agentMeta.displayName, className: "w-12 h-12 md:w-16 md:h-16 object-cover" })) : (_jsx("div", { className: "w-8 h-8 md:w-10 md:h-10 text-white", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M12 2L4 7v10l8 5 8-5V7l-8-5z" }) }) })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "text-lg md:text-xl text-white truncate mb-2", children: agentMeta.displayName }), _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [_jsx(Badge, { variant: "secondary", className: "bg-zinc-800 text-zinc-300 text-xs", children: categoryLabel }), _jsx(Badge, { variant: "secondary", className: "bg-zinc-800 text-zinc-300 text-xs", children: feeLabel }), headerStatus ? (_jsxs(Badge, { variant: "outline", className: `${headerStatus.className} text-xs`, children: [headerStatus.icon, headerStatus.label] })) : null, showInstallBadge ? (_jsx(Badge, { variant: "outline", className: `${installBadge?.className ?? ""} text-xs`, children: installBadge?.label })) : null] })] })] }), _jsx("p", { className: "text-xs md:text-sm text-zinc-400 mb-2 md:mb-3", children: description }), tags.length > 0 ? (_jsx("div", { className: "hidden md:flex items-center gap-2 mb-3 flex-wrap", children: tags.map((tag) => (_jsx("span", { className: "px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded", children: tag }, tag))) })) : null, _jsx("div", { className: "flex items-center gap-2 md:gap-3 text-xs text-zinc-500 flex-wrap", children: stats.map((stat, index) => (_jsxs(React.Fragment, { children: [index > 0 ? (_jsx("span", { className: stat.className, children: "\u2022" })) : null, _jsx("span", { className: stat.className, children: stat.value })] }, stat.key))) })] }), _jsx(AgentActionsMenu, { isPaused: isPaused, onPauseToggle: handlePauseToggle, pauseDisabled: disablePauseResume, onViewDetails: () => setDetailsAgent(agentMeta), onConfigure: canConfigure ? handleConfigure : undefined, configureDisabled: disableConfigure, onIncreaseBudget: handleStartBudgetIncrease, onDecreaseBudget: handleStartBudgetDecrease, increaseDisabled: disableBudgetActions, decreaseDisabled: disableBudgetActions, onUninstall: () => handleUninstall(installation), uninstallDisabled: disableUninstall, uninstallLabel: isPendingRevocation ? "Finish uninstall" : "Uninstall agent" })] }), isProvisioning ? (_jsxs("div", { className: "mb-6 flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3", children: [_jsx(Info, { className: "w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm text-blue-400", children: "Provisioning pending" }), _jsx("p", { className: "text-xs text-zinc-400", children: "We are retrying delivery of the provisioning webhook. The agent will activate after the webhook succeeds." })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => handleRetryProvisioning(installation), disabled: isRetryingProvisioning || isMutating, className: "border-blue-500/30 text-blue-200 hover:bg-blue-500/10", children: [isRetryingProvisioning ? (_jsx(RefreshCw, { className: "h-4 w-4 mr-2 animate-spin" })) : null, isRetryingProvisioning ? "Retrying…" : "Retry"] })] })) : null, isTenantPolicyPaused ? (_jsxs("div", { className: "mb-6 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3", children: [_jsx(AlertCircle, { className: "w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm text-amber-300", children: "Disabled by tenant owner" }), _jsx("p", { className: "text-xs text-zinc-300", children: tenantPolicyReason })] })] })) : null, showBudget && !isRevoked ? (_jsxs("div", { className: "mb-0", children: [_jsx("div", { className: "flex items-center justify-between mb-2 md:mb-3", children: _jsx("span", { className: "text-xs md:text-sm text-zinc-400", children: "Budget Usage" }) }), _jsx("div", { className: "space-y-3 mb-3", children: perTokenBudgetRows.map((row) => (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs md:text-sm", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-zinc-500", children: [_jsx("div", { className: "w-4 h-4 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center", children: row.logoUrl ? (_jsx("img", { src: row.logoUrl, alt: `${row.symbol} token`, className: "w-full h-full object-cover" })) : (_jsx(DollarSign, { className: "w-2.5 h-2.5 text-white" })) }), _jsx("span", { children: row.symbol })] }), _jsx("span", { className: "text-zinc-200", children: row.usageDisplay })] }), _jsx("div", { className: "h-2 bg-zinc-800 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full ${getBudgetColor(row.budgetPercentage)} transition-all duration-300`, style: { width: `${row.budgetBarWidth}%` } }) }), _jsxs("p", { className: "text-xs text-zinc-500", children: [row.budgetPercentText, "% used \u2022 ", row.txCount, " tx"] })] }, row.tokenPoolId))) }), _jsx("div", { className: "flex items-center justify-between mt-2 flex-wrap gap-2", children: _jsx("div", { className: "flex items-center gap-3 md:gap-4 text-xs text-zinc-500", children: showDeveloperDiagnostics ? (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(AlertCircle, { className: "w-3 h-3 text-red-500" }), failuresLoading
                                                                        ? "…"
                                                                        : `${preSubmissionFailures} pre / ${onChainFailures} on-chain`, " ", "failures"] })) : null }) })] })) : null, _jsx("div", { className: "mt-3 text-xs text-zinc-500", children: feeSummary ? (_jsxs("span", { children: ["Fees", feeBoundAt ? " (bound at install)" : "", ": Platform", " ", formatBps(feeSummary.platformFeeBps), " \u2022 Tenant", " ", formatBps(feeSummary.tenantFeeBps), " \u2022 Total", " ", formatBps(feeSummary.totalFeeBps)] })) : (_jsx("span", { children: "Fees: Not specified" })) }), rowBudgetAction !== "none" && canManageBudget ? (_jsxs("div", { className: "space-y-3 mt-4", children: [_jsxs("div", { className: "flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg", children: [_jsx(Info, { className: "w-4 h-4 text-blue-400 flex-shrink-0" }), _jsx("p", { className: "text-sm text-blue-400", children: rowBudgetAction === "increase"
                                                                    ? "Enter amount to increase budget"
                                                                    : "Enter amount to decrease budget" })] }), _jsx("div", { className: "space-y-3", children: perTokenBudgetRows.map((row) => (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-zinc-400", children: [_jsx("span", { children: row.symbol }), _jsxs("span", { children: ["Current: ", toUsageDisplay(row.budgetRaw, row.decimals)] })] }), _jsx(Input, { type: "number", step: "any", min: "0", inputMode: "decimal", placeholder: `e.g. 10.00 ${row.symbol}`, value: budgetInputsByTokenPoolId[row.tokenPoolId] ?? "", onChange: (e) => setBudgetInputsByTokenPoolId((prev) => ({
                                                                        ...prev,
                                                                        [row.tokenPoolId]: e.target.value,
                                                                    })), className: "bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500", disabled: isBudgetLoading || isMutating })] }, row.tokenPoolId))) }), budgetError ? (_jsx("p", { className: "text-xs text-red-400", children: budgetError })) : null, _jsxs("div", { className: "flex gap-3", children: [_jsxs(Button, { onClick: rowBudgetAction === "increase"
                                                                    ? handleConfirmBudgetIncrease
                                                                    : handleConfirmBudgetDecrease, disabled: !perTokenBudgetRows.length || isBudgetLoading || isMutating, className: rowBudgetAction === "increase"
                                                                    ? "flex-1 bg-white hover:bg-zinc-100 text-black"
                                                                    : "flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700", children: [_jsx(Check, { className: "w-4 h-4 mr-2" }), "Confirm ", rowBudgetAction === "increase" ? "increase" : "decrease"] }), _jsxs(Button, { variant: "outline", onClick: handleCancelBudget, className: "flex-1 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white", disabled: isBudgetLoading || isMutating, children: [_jsx(X, { className: "w-4 h-4 mr-2" }), "Cancel"] })] })] })) : null] }) }, installation.installationId));
                            }) }))] }), detailsAgent && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4", role: "dialog", "aria-modal": "true", "aria-labelledby": detailsTitleIdRef.current, "aria-describedby": detailsDescriptionIdRef.current, onMouseDown: (e) => {
                        if (e.target === e.currentTarget)
                            setDetailsAgent(null);
                    }, onKeyDown: (e) => {
                        if (e.key === "Escape")
                            setDetailsAgent(null);
                        trapFocusWithin(e, detailsPanelRef.current);
                    }, tabIndex: -1, ref: detailsOverlayRef, children: _jsxs("div", { ref: detailsPanelRef, className: "w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden overflow-y-auto rounded-lg border bg-background shadow-lg", children: [detailsAgent.bannerUrl ? (_jsx("div", { className: "w-full bg-muted aspect-[1178/192]", children: _jsx("img", { src: detailsAgent.bannerUrl, alt: `${detailsAgent.displayName} banner`, className: "h-full w-full object-contain" }) })) : (_jsx("div", { className: "w-full bg-muted aspect-[1178/192]" })), _jsx("div", { className: "p-4 sm:p-6", children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "-mt-10 h-16 w-16 rounded-xl border bg-muted shrink-0 overflow-hidden", children: (detailsAgent.iconUrl ?? detailsAgent.avatarUrl) ? (_jsx("img", { src: detailsAgent.iconUrl ?? detailsAgent.avatarUrl ?? "", alt: detailsAgent.displayName, className: "h-16 w-16 object-cover" })) : (_jsx("div", { className: "h-16 w-16 flex items-center justify-center", children: categoryIcons[detailsAgent.category] || _jsx(Zap, { className: "h-6 w-6 text-muted-foreground" }) })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { id: detailsTitleIdRef.current, className: "text-lg font-semibold truncate", children: detailsAgent.displayName }), detailsAgent.featured ? (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Featured" })) : null] }), _jsxs("div", { className: "mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3", children: [_jsxs("span", { className: "flex items-center gap-1", children: [categoryIcons[detailsAgent.category], categoryLabels[detailsAgent.category] || detailsAgent.category] }), _jsx("span", { children: detailsAgent.feeSummary
                                                                                ? `Platform ${formatBps(detailsAgent.feeSummary.platformFeeBps)} • Tenant ${formatBps(detailsAgent.feeSummary.tenantFeeBps)}`
                                                                                : "Fees unavailable" }), _jsxs("span", { children: [detailsAgent.installCount?.toLocaleString?.() ?? 0, " installs"] })] })] }), _jsx(Button, { ref: detailsCloseRef, variant: "outline", size: "sm", onClick: () => setDetailsAgent(null), "aria-label": "Close agent details", children: "Close" })] }), _jsx("p", { id: detailsDescriptionIdRef.current, className: "mt-3 text-sm text-muted-foreground", children: detailsAgent.description || "No description available." }), _jsxs("div", { className: "mt-4 grid grid-cols-1 gap-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Network" }), _jsx("span", { className: "font-medium text-right", children: detailsAgent?.network?.name ?? "Not specified" })] }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Operating token" }), _jsx("span", { className: "font-medium text-right", children: detailsAgent.operatingToken?.symbol ?? "Not specified" })] }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Minimum budget" }), _jsx("span", { className: "font-mono text-right", children: (() => {
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
                                                                    })() })] })] }), detailsAgent.tags && detailsAgent.tags.length > 0 ? (_jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: detailsAgent.tags.map((t) => (_jsx(Badge, { variant: "secondary", className: "text-xs", children: t }, t))) })) : null, (detailsAgent.publisherName ||
                                                    detailsAgent.publisherUrl ||
                                                    detailsAgent.contactEmail ||
                                                    detailsAgent.supportUrl ||
                                                    detailsAgent.privacyPolicyUrl ||
                                                    detailsAgent.termsUrl) ? (_jsx("div", { className: "mt-4 rounded-lg border p-3 text-sm", children: _jsxs("div", { className: "grid grid-cols-1 gap-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Publisher" }), _jsx("span", { className: "font-medium text-right", children: detailsAgent.publisherName ??
                                                                            detailsAgent.publisherUrl ??
                                                                            "Not specified" })] }), detailsAgent.contactEmail ? (_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Contact" }), _jsx("span", { className: "font-medium text-right", children: detailsAgent.contactEmail })] })) : null, _jsxs("div", { className: "flex flex-wrap gap-x-4 gap-y-1", children: [detailsAgent.publisherUrl ? (_jsx("a", { href: detailsAgent.publisherUrl, target: "_blank", rel: "noreferrer", className: "underline underline-offset-4 text-muted-foreground hover:text-foreground", children: "Website" })) : null, detailsAgent.supportUrl ? (_jsx("a", { href: detailsAgent.supportUrl, target: "_blank", rel: "noreferrer", className: "underline underline-offset-4 text-muted-foreground hover:text-foreground", children: "Support" })) : null, detailsAgent.privacyPolicyUrl ? (_jsx("a", { href: detailsAgent.privacyPolicyUrl, target: "_blank", rel: "noreferrer", className: "underline underline-offset-4 text-muted-foreground hover:text-foreground", children: "Privacy" })) : null, detailsAgent.termsUrl ? (_jsx("a", { href: detailsAgent.termsUrl, target: "_blank", rel: "noreferrer", className: "underline underline-offset-4 text-muted-foreground hover:text-foreground", children: "Terms" })) : null] })] }) })) : null, detailsAgent.releaseNotes ? (_jsxs("div", { className: "mt-4 rounded-lg border p-3 text-sm", children: [_jsx("div", { className: "text-muted-foreground text-xs mb-1", children: "Release notes" }), _jsx("div", { className: "whitespace-pre-wrap", children: detailsAgent.releaseNotes })] })) : null, _jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [_jsx(Button, { size: "sm", variant: "outline", disabled: true, children: "Installed" }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setDetailsAgent(null), children: "Done" })] })] })] }) })] }) })), configInstallation && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4", role: "dialog", "aria-modal": "true", "aria-labelledby": configTitleIdRef.current, "aria-describedby": configDescriptionIdRef.current, onMouseDown: (e) => {
                        if (e.target === e.currentTarget)
                            handleCloseConfig();
                    }, onKeyDown: (e) => {
                        if (e.key === "Escape")
                            handleCloseConfig();
                        trapFocusWithin(e, configPanelRef.current);
                    }, tabIndex: -1, ref: configOverlayRef, children: _jsx("div", { ref: configPanelRef, className: "w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-hidden overflow-y-auto rounded-lg border bg-background shadow-lg", children: _jsxs("div", { className: "p-4 sm:p-6 space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("h3", { id: configTitleIdRef.current, className: "text-lg font-semibold truncate", children: ["Configure ", configInstallation.service?.displayName ?? "agent"] }), _jsx("p", { id: configDescriptionIdRef.current, className: "text-sm text-muted-foreground", children: "Update the installation settings used by this agent." })] }), _jsx(Button, { ref: configCloseRef, variant: "outline", size: "sm", onClick: handleCloseConfig, "aria-label": "Close configuration dialog", children: "Close" })] }), configQuestions.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "This agent does not expose configurable install questions." })) : (_jsx("div", { className: "space-y-3", children: configQuestions.map((question) => {
                                        const inputId = `config-${configInstallation.installationId}-${question.key}`;
                                        const error = configErrors[question.key];
                                        const existingValue = configInstallation.installInputs?.[question.key] ?? "";
                                        const isSelect = question.type === "select";
                                        const selectOptions = getQuestionOptions(question);
                                        const optionValues = getQuestionOptionValues(question);
                                        const allowsCustom = allowsCustomSelectValue(question);
                                        const currentInputValue = configInputs[question.key] ?? "";
                                        const hasMappedOption = optionValues.has(currentInputValue);
                                        const isCustomMode = isSelect &&
                                            allowsCustom &&
                                            (configCustomSelectModeByKey[question.key] === true ||
                                                (!hasMappedOption && currentInputValue.trim() !== ""));
                                        const selectValue = isCustomMode
                                            ? CUSTOM_SELECT_VALUE
                                            : hasMappedOption
                                                ? currentInputValue
                                                : "";
                                        const showCustomInput = isSelect && allowsCustom && isCustomMode;
                                        const placeholder = question.sensitive && existingValue
                                            ? "Saved"
                                            : question.default !== undefined && question.default !== null
                                                ? String(question.default)
                                                : undefined;
                                        return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { htmlFor: inputId, children: question.label }), _jsx("span", { className: "text-xs text-muted-foreground", children: question.required ? "Required" : "Optional" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [isSelect ? (_jsxs("select", { id: inputId, value: selectValue, onChange: (event) => {
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
                                                                    [question.key]: nextSelection === CUSTOM_SELECT_VALUE,
                                                                }));
                                                                setConfigErrors((prev) => {
                                                                    if (!prev[question.key])
                                                                        return prev;
                                                                    const next = { ...prev };
                                                                    delete next[question.key];
                                                                    return next;
                                                                });
                                                            }, className: "w-full rounded-md border border-input bg-background px-3 py-2 text-sm", children: [_jsx("option", { value: "", children: "Select an option" }), selectOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, `${question.key}-${option.value}`))), allowsCustom ? (_jsx("option", { value: CUSTOM_SELECT_VALUE, children: "Custom value" })) : null] })) : (_jsx(Input, { id: inputId, type: question.type === "number"
                                                                ? "text"
                                                                : question.sensitive
                                                                    ? "password"
                                                                    : "text", min: question.type === "number" && typeof question.min === "number"
                                                                ? question.min
                                                                : undefined, max: question.type === "number" && typeof question.max === "number"
                                                                ? question.max
                                                                : undefined, step: question.type === "number"
                                                                ? typeof question.step === "number"
                                                                    ? question.step
                                                                    : "any"
                                                                : undefined, value: currentInputValue, onChange: (e) => {
                                                                const nextValue = question.type === "number"
                                                                    ? sanitizeUnsignedDecimalInput(e.target.value)
                                                                    : e.target.value;
                                                                setConfigInputs((prev) => ({
                                                                    ...prev,
                                                                    [question.key]: nextValue,
                                                                }));
                                                                setConfigErrors((prev) => {
                                                                    if (!prev[question.key])
                                                                        return prev;
                                                                    const next = { ...prev };
                                                                    delete next[question.key];
                                                                    return next;
                                                                });
                                                            }, inputMode: question.type === "number" ? "decimal" : undefined, placeholder: placeholder, autoComplete: question.sensitive ? "off" : undefined })), question.unit ? (_jsx("span", { className: "text-xs text-muted-foreground whitespace-nowrap", children: question.unit })) : null] }), showCustomInput ? (_jsx(Input, { value: currentInputValue, onChange: (e) => {
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
                                                            if (!prev[question.key])
                                                                return prev;
                                                            const next = { ...prev };
                                                            delete next[question.key];
                                                            return next;
                                                        });
                                                    }, placeholder: "Enter custom value" })) : null, question.sensitive ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "Leave blank to keep the current value." })) : null, error ? (_jsx("p", { className: "text-xs text-red-400", children: error })) : null] }, question.key));
                                    }) })), configSubmitError ? (_jsx("div", { className: "text-xs text-red-400", children: configSubmitError })) : null, _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx(Button, { variant: "outline", onClick: handleCloseConfig, disabled: configSaving, children: "Cancel" }), _jsx(Button, { onClick: handleSubmitConfig, disabled: configSaving || isMutating, children: configSaving ? "Saving…" : "Save changes" })] })] }) }) }))] }) }));
}
