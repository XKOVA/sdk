"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAccountState, useAgentInstallationActions, useIeeContext, useIeeReceiptAction, useTenantConfig } from "@xkova/sdk-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { toastError } from "../toast-utils.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { NetworkText } from "./ui/network-text.js";
import { RefreshCw, Bot, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, User, Shield, Zap } from "lucide-react";
/**
 * Format a base-unit token amount into a human-readable string.
 *
 * @remarks
 * Purpose:
 * - Display base-unit values (wei) in token units for the UI.
 *
 * Parameters (fields):
 * - `value`: Base-unit string (required).
 * - `decimals`: Token decimals (integer >= 0).
 *
 * Return semantics:
 * - Returns a decimal string trimmed of trailing zeros.
 *
 * Errors/failure modes:
 * - None; invalid input coerces to zero.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `decimals` is a finite integer.
 *
 * Data/auth references:
 * - None.
 *
 * @param value - Base-unit amount string.
 * @param decimals - Token decimals.
 * @returns Human-readable token units as a string.
 *
 * @example
 * formatUnits("1000000", 6) // "1"
 */
function formatUnits(value, decimals) {
    const v = BigInt(value || '0');
    if (decimals <= 0)
        return v.toString();
    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = v % base;
    if (frac === 0n)
        return whole.toString();
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole.toString()}.${fracStr}`;
}
/**
 * Parse a human-readable token amount into base units.
 *
 * @remarks
 * Purpose:
 * - Convert user input into a base-unit string for API requests.
 *
 * Parameters (fields):
 * - `value`: Decimal string (required).
 * - `decimals`: Token decimals (integer >= 0).
 *
 * Return semantics:
 * - Returns a bigint representing base units.
 *
 * Errors/failure modes:
 * - Throws when the input is not a valid decimal number.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Input uses `.` as the decimal separator.
 *
 * Data/auth references:
 * - None.
 *
 * @param value - Human-readable decimal string.
 * @param decimals - Token decimals.
 * @returns Base-unit bigint value.
 *
 * @example
 * parseUnits("1.5", 6) // 1500000n
 */
function parseUnits(value, decimals) {
    const raw = (value ?? '').trim();
    if (raw === '')
        return 0n;
    if (!/^\d+(\.\d+)?$/.test(raw)) {
        throw new Error('Invalid number');
    }
    const [wholeStr, fracStrRaw] = raw.split('.');
    const whole = BigInt(wholeStr || '0');
    const fracStr = (fracStrRaw ?? '').slice(0, Math.max(0, decimals));
    const fracPadded = fracStr.padEnd(Math.max(0, decimals), '0');
    const frac = fracPadded === '' ? 0n : BigInt(fracPadded);
    const base = 10n ** BigInt(decimals);
    return whole * base + frac;
}
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
const buildDefaultInstallInputs = (questions) => {
    const defaults = {};
    for (const question of questions) {
        if (question.default !== undefined && question.default !== null) {
            defaults[question.key] = String(question.default);
        }
    }
    return defaults;
};
/**
 * Keep number-question inputs restricted to unsigned decimal text while typing.
 */
const sanitizeUnsignedDecimalInput = (value) => {
    const cleaned = value.replace(/[^\d.]/g, "");
    const [whole = "", ...fractionParts] = cleaned.split(".");
    const fraction = fractionParts.join("");
    return fractionParts.length > 0 ? `${whole}.${fraction}` : whole;
};
const normalizeInstallInputs = (questions, inputs) => {
    const errors = {};
    const normalized = {};
    for (const question of questions) {
        const raw = (inputs[question.key] ?? "").toString().trim();
        let value = raw;
        if (!value && question.default !== undefined && question.default !== null) {
            value = String(question.default);
        }
        if (!value) {
            if (question.required) {
                errors[question.key] = "Required";
            }
            continue;
        }
        if (question.type === "number") {
            if (!/^\d+(\.\d+)?$/.test(value)) {
                errors[question.key] = "Enter a valid number";
                continue;
            }
            const numeric = Number(value);
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
            if (!optionValues.has(value) && !allowsCustomSelectValue(question)) {
                errors[question.key] = "Select a valid option";
                continue;
            }
        }
        normalized[question.key] = value;
    }
    return { normalized, errors };
};
/**
 * Guided agent installation flow UI.
 *
 * @remarks
 * Purpose:
 * - Walk the user through agent installation, signing, and confirmation.
 *
 * When to use:
 * - Use when you want a guided install flow for marketplace agents.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: AgentInstallFlowProps. Nullable: no.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders error state when approval or confirmation fails.
 *
 * Side effects:
 * - Triggers OAuth requests, IEE (SafeApprove) approval flows, and installation list invalidations.
 *
 * Invariants/assumptions:
 * - Requires an authenticated SDK context with `agents:manage` scope.
 *
 * Data/auth references:
 * - `/iee/tickets`, `/iee/op-token`, `/iee/receipt`, and `/agents/install/confirm` (oauth-server).
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * Notes:
 * - Uses IEE (SafeApprove) receipt approval (no client-side signing in public SDK).
 *
 * @example
 * <AgentInstallFlow agent={agent} />
 *
 * @see /agents/install/confirm
 */
export function AgentInstallFlow({ agent, onComplete, onCancel, onError, disableToasts = false, defaultBudget = "100", defaultValidityDays, tokenBudgetMode = "all", }) {
    const { confirmInstallation } = useAgentInstallationActions();
    const { tenantId, clientId, userId } = useIeeContext();
    const iee = useIeeReceiptAction();
    const { tokens, networks } = useTenantConfig();
    const { account } = useAccountState();
    const operatingTokenOptions = useMemo(() => {
        if (Array.isArray(agent.availableOperatingTokens) &&
            agent.availableOperatingTokens.length > 0) {
            return agent.availableOperatingTokens.map((token) => ({
                tokenPoolId: token.tokenPoolId,
                symbol: token.symbol,
                name: token.name,
                contract: token.contract,
                decimals: token.decimals,
                isStable: token.isStable,
                minimumBudget: token.minimumBudget ?? null,
            }));
        }
        if (!agent.operatingToken) {
            return [];
        }
        return [
            {
                tokenPoolId: agent.operatingToken.tokenPoolId,
                symbol: agent.operatingToken.symbol,
                name: agent.operatingToken.name,
                contract: agent.operatingToken.contract,
                decimals: agent.operatingToken.decimals,
                isStable: agent.operatingToken.isStable,
                minimumBudget: agent.minimumBudget ?? null,
            },
        ];
    }, [agent.availableOperatingTokens, agent.minimumBudget, agent.operatingToken]);
    const normalizedTokenBudgetMode = tokenBudgetMode === "single" ? "single" : "all";
    const defaultTokenPoolId = useMemo(() => {
        if (!operatingTokenOptions.length) {
            return "";
        }
        const preferredTokenPoolId = String(agent.operatingToken?.tokenPoolId ?? "").trim();
        if (preferredTokenPoolId &&
            operatingTokenOptions.some((token) => token.tokenPoolId === preferredTokenPoolId)) {
            return preferredTokenPoolId;
        }
        return operatingTokenOptions[0].tokenPoolId;
    }, [agent.operatingToken?.tokenPoolId, operatingTokenOptions]);
    const [selectedTokenPoolId, setSelectedTokenPoolId] = useState(defaultTokenPoolId);
    const selectedOperatingToken = useMemo(() => {
        if (!operatingTokenOptions.length)
            return null;
        if (!selectedTokenPoolId) {
            return operatingTokenOptions[0] ?? null;
        }
        return (operatingTokenOptions.find((token) => token.tokenPoolId === selectedTokenPoolId) ??
            operatingTokenOptions[0] ??
            null);
    }, [operatingTokenOptions, selectedTokenPoolId]);
    // Prefer agent-defined minimum budget as the default shown to the user.
    const tokenSymbol = selectedOperatingToken?.symbol ??
        tokens?.find((t) => t.isPrimary || t.isDefault)?.symbol ??
        "TOKEN";
    const tokenDecimals = selectedOperatingToken?.decimals ??
        tokens?.find((t) => t.isPrimary || t.isDefault)?.decimals ??
        18;
    const resolveTokenMinimumBudget = useCallback((tokenPoolId, tokenMinimumBudget) => {
        const tokenMinimumBudgetRaw = typeof tokenMinimumBudget === "string" ? tokenMinimumBudget.trim() : "";
        if (/^\d+$/.test(tokenMinimumBudgetRaw)) {
            return tokenMinimumBudgetRaw;
        }
        const mappedMinimumRaw = agent.minimumBudgetByTokenPoolId &&
            typeof agent.minimumBudgetByTokenPoolId[tokenPoolId] === "string"
            ? String(agent.minimumBudgetByTokenPoolId[tokenPoolId]).trim()
            : "";
        if (/^\d+$/.test(mappedMinimumRaw)) {
            return mappedMinimumRaw;
        }
        const globalMinimumRaw = typeof agent.minimumBudget === "string" ? agent.minimumBudget.trim() : "";
        if (/^\d+$/.test(globalMinimumRaw)) {
            return globalMinimumRaw;
        }
        return null;
    }, [agent.minimumBudget, agent.minimumBudgetByTokenPoolId]);
    const selectedTokenMinimumBudget = useMemo(() => resolveTokenMinimumBudget(selectedTokenPoolId, selectedOperatingToken?.minimumBudget), [
        resolveTokenMinimumBudget,
        selectedOperatingToken?.minimumBudget,
        selectedTokenPoolId,
    ]);
    const effectiveDefaultBudget = (() => {
        const minWei = selectedTokenMinimumBudget;
        if (!minWei)
            return defaultBudget;
        try {
            return formatUnits(minWei, tokenDecimals);
        }
        catch {
            return defaultBudget;
        }
    })();
    const [step, setStep] = useState("configure");
    const [singleBudget, setSingleBudget] = useState(effectiveDefaultBudget);
    const [budgetByTokenPoolId, setBudgetByTokenPoolId] = useState({});
    const [installLabel, setInstallLabel] = useState("");
    const validityBounds = useMemo(() => {
        const parseBound = (value, fallback) => {
            const parsed = typeof value === "number"
                ? value
                : typeof value === "string"
                    ? Number(value)
                    : NaN;
            if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
                return fallback;
            }
            return parsed;
        };
        const min = parseBound(agent.minValidityDays, 1);
        const defaultDays = parseBound(agent.defaultValidityDays, 30);
        const max = parseBound(agent.maxValidityDays, 365);
        if (min < 1 || max > 365 || min > defaultDays || defaultDays > max) {
            return { min: 1, defaultDays: 30, max: 365 };
        }
        return { min, defaultDays, max };
    }, [agent.defaultValidityDays, agent.maxValidityDays, agent.minValidityDays]);
    const [validityDays, setValidityDays] = useState(() => {
        if (typeof defaultValidityDays === "number" &&
            Number.isInteger(defaultValidityDays)) {
            return defaultValidityDays;
        }
        return validityBounds.defaultDays;
    });
    const [transactionHash, setTransactionHash] = useState(null);
    const [flowError, setFlowError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const installQuestions = useMemo(() => (Array.isArray(agent.installQuestions) ? agent.installQuestions : []), [agent.installQuestions]);
    const [installInputs, setInstallInputs] = useState(() => buildDefaultInstallInputs(installQuestions));
    const [customSelectModeByKey, setCustomSelectModeByKey] = useState({});
    const [installInputErrors, setInstallInputErrors] = useState({});
    const [normalizedInstallInputs, setNormalizedInstallInputs] = useState({});
    const selectedNetwork = useMemo(() => {
        if (!agent.network?.networkId)
            return networks?.[0] ?? null;
        return (networks?.find((network) => String(network.networkId) === String(agent.network?.networkId)) ??
            null);
    }, [agent.network?.networkId, networks]);
    const primaryAccount = account ?? null;
    useEffect(() => {
        const defaults = buildDefaultInstallInputs(installQuestions);
        const nextCustomSelectMode = {};
        for (const question of installQuestions) {
            if (question.type !== "select" || !allowsCustomSelectValue(question)) {
                continue;
            }
            const optionValues = getQuestionOptionValues(question);
            const value = defaults[question.key] ?? "";
            nextCustomSelectMode[question.key] =
                value.trim() !== "" && !optionValues.has(value);
        }
        setInstallInputs(defaults);
        setCustomSelectModeByKey(nextCustomSelectMode);
        setNormalizedInstallInputs(defaults);
        setInstallInputErrors({});
    }, [agent.agentServiceId, installQuestions]);
    useEffect(() => {
        setSingleBudget(effectiveDefaultBudget);
    }, [agent.agentServiceId, effectiveDefaultBudget]);
    useEffect(() => {
        if (!operatingTokenOptions.length) {
            setBudgetByTokenPoolId({});
            return;
        }
        const nextBudgets = {};
        for (const token of operatingTokenOptions) {
            const minimumBudget = resolveTokenMinimumBudget(token.tokenPoolId, token.minimumBudget);
            if (minimumBudget) {
                try {
                    nextBudgets[token.tokenPoolId] = formatUnits(minimumBudget, token.decimals);
                    continue;
                }
                catch {
                    // Fall through to default budget.
                }
            }
            nextBudgets[token.tokenPoolId] = defaultBudget;
        }
        setBudgetByTokenPoolId(nextBudgets);
    }, [
        agent.agentServiceId,
        defaultBudget,
        operatingTokenOptions,
        resolveTokenMinimumBudget,
    ]);
    useEffect(() => {
        if (typeof defaultValidityDays === "number" &&
            Number.isInteger(defaultValidityDays)) {
            setValidityDays(defaultValidityDays);
            return;
        }
        setValidityDays(validityBounds.defaultDays);
    }, [agent.agentServiceId, defaultValidityDays, validityBounds.defaultDays]);
    useEffect(() => {
        if (selectedTokenPoolId &&
            operatingTokenOptions.some((token) => token.tokenPoolId === selectedTokenPoolId)) {
            return;
        }
        setSelectedTokenPoolId(defaultTokenPoolId);
    }, [
        defaultTokenPoolId,
        operatingTokenOptions,
        selectedTokenPoolId,
    ]);
    const usesSingleTokenBudgetMode = normalizedTokenBudgetMode === "single" ||
        operatingTokenOptions.length <= 1;
    const reviewBudgetRows = useMemo(() => {
        if (usesSingleTokenBudgetMode) {
            return [
                {
                    tokenPoolId: selectedOperatingToken?.tokenPoolId ?? "",
                    symbol: tokenSymbol,
                    amount: singleBudget,
                },
            ];
        }
        return operatingTokenOptions.map((token) => ({
            tokenPoolId: token.tokenPoolId,
            symbol: token.symbol,
            amount: budgetByTokenPoolId[token.tokenPoolId] ?? "",
        }));
    }, [
        budgetByTokenPoolId,
        operatingTokenOptions,
        selectedOperatingToken?.tokenPoolId,
        singleBudget,
        tokenSymbol,
        usesSingleTokenBudgetMode,
    ]);
    const resolveInstallBudgetSelection = useCallback(() => {
        if (!operatingTokenOptions.length) {
            const parsed = parseUnits(singleBudget, tokenDecimals);
            if (parsed <= 0n) {
                throw new Error("Please enter a valid budget amount");
            }
            return {
                policyBudgetWei: parsed.toString(),
                selectedTokenPoolId: selectedTokenPoolId || null,
                tokenBudgetsByTokenPoolId: selectedTokenPoolId
                    ? { [selectedTokenPoolId]: parsed.toString() }
                    : {},
            };
        }
        if (usesSingleTokenBudgetMode) {
            const token = selectedOperatingToken ?? operatingTokenOptions[0] ?? null;
            if (!token) {
                throw new Error("No operating token available for installation");
            }
            const parsed = parseUnits(singleBudget, token.decimals);
            if (parsed <= 0n) {
                throw new Error("Please enter a valid budget amount");
            }
            const minimumBudget = resolveTokenMinimumBudget(token.tokenPoolId, token.minimumBudget);
            if (minimumBudget && parsed < BigInt(minimumBudget)) {
                throw new Error(`${token.symbol} budget must be at least the minimum budget`);
            }
            return {
                policyBudgetWei: parsed.toString(),
                selectedTokenPoolId: token.tokenPoolId,
                tokenBudgetsByTokenPoolId: {
                    [token.tokenPoolId]: parsed.toString(),
                },
            };
        }
        let total = 0n;
        const tokenBudgetsByTokenPoolId = {};
        for (const token of operatingTokenOptions) {
            const rawBudget = String(budgetByTokenPoolId[token.tokenPoolId] ?? "").trim();
            const parsed = parseUnits(rawBudget, token.decimals);
            if (parsed <= 0n) {
                throw new Error(`Please enter a valid ${token.symbol} budget amount`);
            }
            const minimumBudget = resolveTokenMinimumBudget(token.tokenPoolId, token.minimumBudget);
            if (minimumBudget && parsed < BigInt(minimumBudget)) {
                throw new Error(`${token.symbol} budget must be at least the minimum budget`);
            }
            tokenBudgetsByTokenPoolId[token.tokenPoolId] = parsed.toString();
            total += parsed;
        }
        const selectedTokenForInstall = defaultTokenPoolId || operatingTokenOptions[0]?.tokenPoolId || null;
        if (!selectedTokenForInstall) {
            throw new Error("No default operating token available for installation");
        }
        return {
            policyBudgetWei: total.toString(),
            selectedTokenPoolId: selectedTokenForInstall,
            tokenBudgetsByTokenPoolId,
        };
    }, [
        budgetByTokenPoolId,
        defaultTokenPoolId,
        operatingTokenOptions,
        resolveTokenMinimumBudget,
        selectedOperatingToken,
        selectedTokenPoolId,
        singleBudget,
        tokenDecimals,
        usesSingleTokenBudgetMode,
    ]);
    const reviewBudgetSummary = useMemo(() => {
        try {
            return resolveInstallBudgetSelection();
        }
        catch {
            return null;
        }
    }, [resolveInstallBudgetSelection]);
    // Step 1: Configure -> Review
    const handleContinueToReview = useCallback(() => {
        if (!Number.isInteger(validityDays) ||
            validityDays < validityBounds.min ||
            validityDays > validityBounds.max) {
            setFlowError(new Error(`Validity must be between ${validityBounds.min} and ${validityBounds.max} days`));
            return;
        }
        try {
            resolveInstallBudgetSelection();
        }
        catch (error) {
            setFlowError(error instanceof Error
                ? error
                : new Error("Please enter a valid budget amount"));
            return;
        }
        const validation = normalizeInstallInputs(installQuestions, installInputs);
        if (Object.keys(validation.errors).length > 0) {
            setInstallInputErrors(validation.errors);
            setFlowError(new Error("Please complete required fields"));
            return;
        }
        setInstallInputErrors({});
        setNormalizedInstallInputs(validation.normalized);
        setFlowError(null);
        setStep("review");
    }, [
        installInputs,
        installQuestions,
        resolveInstallBudgetSelection,
        validityBounds.max,
        validityBounds.min,
        validityDays,
    ]);
    // Step 2: Review -> SafeApprove approval + confirm installation
    const handlePrepare = useCallback(async () => {
        setFlowError(null);
        setIsSubmitting(true);
        try {
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const budgetSelection = resolveInstallBudgetSelection();
            if (!Number.isInteger(validityDays) ||
                validityDays < validityBounds.min ||
                validityDays > validityBounds.max) {
                throw new Error(`Validity must be between ${validityBounds.min} and ${validityBounds.max} days`);
            }
            const installValidation = normalizeInstallInputs(installQuestions, installInputs);
            if (Object.keys(installValidation.errors).length > 0) {
                setInstallInputErrors(installValidation.errors);
                throw new Error("Please complete required fields");
            }
            setInstallInputErrors({});
            setNormalizedInstallInputs(installValidation.normalized);
            const payload = {
                tenant_id: tenantId,
                client_id: clientId,
                user_id: userId,
                agent_service_id: agent.agentServiceId,
                ...(budgetSelection.selectedTokenPoolId
                    ? {
                        selected_token_pool_id: budgetSelection.selectedTokenPoolId,
                    }
                    : {}),
                budget: budgetSelection.policyBudgetWei,
                validity_days: validityDays,
            };
            const trimmedLabel = installLabel.trim();
            if (trimmedLabel) {
                payload["install_label"] = trimmedLabel;
            }
            const metadata = {
                ...(installQuestions.length > 0
                    ? {
                        install_inputs: installValidation.normalized,
                        ...(agent.installQuestionsVersion !== undefined &&
                            agent.installQuestionsVersion !== null
                            ? { install_questions_version: agent.installQuestionsVersion }
                            : {}),
                    }
                    : {}),
                token_budgets_by_token_pool_id: budgetSelection.tokenBudgetsByTokenPoolId,
                token_budget_mode: normalizedTokenBudgetMode,
            };
            if (Object.keys(metadata).length > 0) {
                payload["metadata"] = metadata;
            }
            setStep("sign");
            const receiptResult = await iee.run({
                actionType: "agent_install_confirm_v1",
                payload,
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            const installationIdRaw = receiptResult.installationId ?? null;
            const installationId = typeof installationIdRaw === "string" ? installationIdRaw.trim() : "";
            if (!installationId) {
                throw new Error("SafeApprove approval did not return an installation id");
            }
            const txHashRaw = receiptResult.transactionHash ?? receiptResult.userOpHash ?? null;
            const txHash = typeof txHashRaw === "string" ? txHashRaw.trim() : "";
            if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
                throw new Error("SafeApprove approval did not return a valid transaction hash");
            }
            setStep("confirm");
            const confirmResult = await confirmInstallation({
                installationId,
                transactionHash: txHash,
                receipt: receiptResult.receipt,
            });
            setTransactionHash(txHash);
            setStep("complete");
            if (confirmResult && onComplete) {
                onComplete({
                    agentActorId: confirmResult.agentActorId ?? "",
                    installationId: confirmResult.installationId ?? installationId,
                });
            }
        }
        catch (err) {
            const e = err instanceof Error ? err : new Error("Failed to install agent");
            setFlowError(e);
            onError?.(e);
            if (!disableToasts) {
                toastError("AgentInstallFlow install failed", e, "Could not start install. Please try again.");
            }
            setStep("error");
        }
        finally {
            setIsSubmitting(false);
        }
    }, [
        agent.agentServiceId,
        clientId,
        confirmInstallation,
        disableToasts,
        iee,
        installLabel,
        installInputs,
        installQuestions,
        normalizedTokenBudgetMode,
        onComplete,
        onError,
        resolveInstallBudgetSelection,
        tenantId,
        userId,
        validityBounds.max,
        validityBounds.min,
        validityDays,
    ]);
    const handleBack = useCallback(() => {
        setFlowError(null);
        if (step === "review")
            setStep("configure");
        else if (step === "sign")
            setStep("review");
    }, [step]);
    const renderStep = () => {
        switch (step) {
            case "configure":
                return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4 p-4 bg-muted/50 rounded-lg", children: [_jsx("div", { className: "h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0", children: (agent.iconUrl ?? agent.avatarUrl) ? (_jsx("img", { src: agent.iconUrl ?? agent.avatarUrl ?? "", alt: agent.displayName, className: "h-12 w-12 rounded-lg object-cover" })) : (_jsx(Bot, { className: "h-6 w-6 text-muted-foreground" })) }), _jsxs("div", { children: [_jsx("h3", { className: "font-medium", children: agent.displayName }), _jsx("p", { className: "text-sm text-muted-foreground line-clamp-1", children: agent.description })] })] }), _jsxs("div", { className: "space-y-3", children: [usesSingleTokenBudgetMode ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "selected-token", children: "Operating Token" }), operatingTokenOptions.length > 1 ? (_jsx("select", { id: "selected-token", value: selectedTokenPoolId, onChange: (event) => {
                                                        const nextTokenPoolId = event.target.value;
                                                        setSelectedTokenPoolId(nextTokenPoolId);
                                                        const nextToken = operatingTokenOptions.find((token) => token.tokenPoolId === nextTokenPoolId);
                                                        const nextMinimumBudget = nextToken
                                                            ? resolveTokenMinimumBudget(nextToken.tokenPoolId, nextToken.minimumBudget)
                                                            : null;
                                                        if (nextToken && nextMinimumBudget) {
                                                            try {
                                                                setSingleBudget(formatUnits(nextMinimumBudget, nextToken.decimals));
                                                            }
                                                            catch {
                                                                setSingleBudget(defaultBudget);
                                                            }
                                                        }
                                                        setFlowError(null);
                                                    }, className: "w-full rounded-md border border-input bg-background px-3 py-2 text-sm", children: operatingTokenOptions.map((token) => (_jsx("option", { value: token.tokenPoolId, children: token.symbol }, token.tokenPoolId))) })) : (_jsx(Input, { id: "selected-token", value: selectedOperatingToken?.symbol ?? tokenSymbol, readOnly: true })), _jsx("p", { className: "text-xs text-muted-foreground", children: "This agent installation will use the selected token as its default." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "budget", children: "Budget Amount" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { id: "budget", type: "number", min: "0", step: "0.01", value: singleBudget, onChange: (e) => setSingleBudget(e.target.value), placeholder: "100", className: "flex-1" }), _jsx("span", { className: "text-sm text-muted-foreground w-16", children: tokenSymbol })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Maximum amount the agent can spend on your behalf." })] })] })) : (_jsxs("div", { className: "space-y-3", children: [_jsx(Label, { children: "Token Budgets" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Set a budget for each operating token. The install policy budget uses the total of all token budgets." }), operatingTokenOptions.map((token) => {
                                            const minimumBudget = resolveTokenMinimumBudget(token.tokenPoolId, token.minimumBudget);
                                            let minimumBudgetDisplay = null;
                                            if (minimumBudget) {
                                                try {
                                                    minimumBudgetDisplay = `${formatUnits(minimumBudget, token.decimals)} ${token.symbol}`;
                                                }
                                                catch {
                                                    minimumBudgetDisplay = null;
                                                }
                                            }
                                            return (_jsxs("div", { className: "space-y-2 rounded-md border border-border bg-muted/20 p-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm font-medium", children: token.symbol }), _jsx("span", { className: "text-xs text-muted-foreground", children: token.name })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { id: `budget-${token.tokenPoolId}`, type: "number", min: "0", step: "0.01", value: budgetByTokenPoolId[token.tokenPoolId] ?? "", onChange: (event) => {
                                                                    const nextValue = event.target.value;
                                                                    setBudgetByTokenPoolId((prev) => ({
                                                                        ...prev,
                                                                        [token.tokenPoolId]: nextValue,
                                                                    }));
                                                                }, placeholder: "100", className: "flex-1" }), _jsx("span", { className: "text-sm text-muted-foreground w-16", children: token.symbol })] }), minimumBudgetDisplay ? (_jsxs("p", { className: "text-xs text-muted-foreground", children: ["Minimum budget: ", minimumBudgetDisplay] })) : null] }, token.tokenPoolId));
                                        })] })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "validity-days", children: "Validity Window (days)" }), _jsx(Input, { id: "validity-days", type: "number", min: String(validityBounds.min), max: String(validityBounds.max), step: "1", value: String(validityDays), onChange: (e) => {
                                                const parsed = Number(e.target.value);
                                                if (!Number.isFinite(parsed)) {
                                                    setValidityDays(validityBounds.defaultDays);
                                                    return;
                                                }
                                                setValidityDays(Math.trunc(parsed));
                                            } }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Agent permissions stay active for this period (", validityBounds.min, "-", validityBounds.max, " days)."] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "label", children: "Installation Label (Optional)" }), _jsx(Input, { id: "label", value: installLabel, onChange: (e) => setInstallLabel(e.target.value), placeholder: "e.g., Trading Bot #1" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "A friendly name to identify this installation." })] }), installQuestions.length > 0 ? (_jsxs("div", { className: "space-y-3", children: [_jsx(Label, { children: "Install Questions" }), _jsx("div", { className: "space-y-3", children: installQuestions.map((question) => {
                                                const inputId = `install-${question.key}`;
                                                const error = installInputErrors[question.key];
                                                const isNumber = question.type === "number";
                                                const isSelect = question.type === "select";
                                                const currentInputValue = installInputs[question.key] ?? "";
                                                const selectOptions = getQuestionOptions(question);
                                                const optionValues = getQuestionOptionValues(question);
                                                const allowsCustom = allowsCustomSelectValue(question);
                                                const hasMappedOption = optionValues.has(currentInputValue);
                                                const isCustomMode = isSelect &&
                                                    allowsCustom &&
                                                    (customSelectModeByKey[question.key] === true ||
                                                        (!hasMappedOption && currentInputValue.trim() !== ""));
                                                const selectValue = isCustomMode
                                                    ? CUSTOM_SELECT_VALUE
                                                    : hasMappedOption
                                                        ? currentInputValue
                                                        : "";
                                                const showCustomInput = isSelect && allowsCustom && isCustomMode;
                                                return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { htmlFor: inputId, children: question.label }), _jsx("span", { className: "text-xs text-muted-foreground", children: question.required ? "Required" : "Optional" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [isSelect ? (_jsxs("select", { id: inputId, value: selectValue, onChange: (event) => {
                                                                        const nextSelection = event.target.value;
                                                                        setInstallInputs((prev) => {
                                                                            if (nextSelection === CUSTOM_SELECT_VALUE) {
                                                                                const existing = prev[question.key] ?? "";
                                                                                const nextCustom = optionValues.has(existing)
                                                                                    ? ""
                                                                                    : existing;
                                                                                return { ...prev, [question.key]: nextCustom };
                                                                            }
                                                                            return { ...prev, [question.key]: nextSelection };
                                                                        });
                                                                        setCustomSelectModeByKey((prev) => ({
                                                                            ...prev,
                                                                            [question.key]: nextSelection === CUSTOM_SELECT_VALUE,
                                                                        }));
                                                                        setInstallInputErrors((prev) => {
                                                                            if (!prev[question.key])
                                                                                return prev;
                                                                            const next = { ...prev };
                                                                            delete next[question.key];
                                                                            return next;
                                                                        });
                                                                    }, className: "w-full rounded-md border border-input bg-background px-3 py-2 text-sm", children: [_jsx("option", { value: "", children: "Select an option" }), selectOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, `${question.key}-${option.value}`))), allowsCustom ? (_jsx("option", { value: CUSTOM_SELECT_VALUE, children: "Custom value" })) : null] })) : (_jsx(Input, { id: inputId, type: isNumber
                                                                        ? "text"
                                                                        : question.sensitive
                                                                            ? "password"
                                                                            : "text", min: isNumber && typeof question.min === "number" ? question.min : undefined, max: isNumber && typeof question.max === "number" ? question.max : undefined, step: isNumber ? (typeof question.step === "number" ? question.step : "any") : undefined, value: currentInputValue, onChange: (e) => {
                                                                        const nextValue = isNumber
                                                                            ? sanitizeUnsignedDecimalInput(e.target.value)
                                                                            : e.target.value;
                                                                        setInstallInputs((prev) => ({ ...prev, [question.key]: nextValue }));
                                                                        setInstallInputErrors((prev) => {
                                                                            if (!prev[question.key])
                                                                                return prev;
                                                                            const next = { ...prev };
                                                                            delete next[question.key];
                                                                            return next;
                                                                        });
                                                                    }, inputMode: isNumber ? "decimal" : undefined, placeholder: question.default !== undefined && question.default !== null ? String(question.default) : undefined })), question.unit ? (_jsx("span", { className: "text-xs text-muted-foreground whitespace-nowrap", children: question.unit })) : null] }), showCustomInput ? (_jsx(Input, { value: currentInputValue, onChange: (e) => {
                                                                const nextValue = e.target.value;
                                                                setInstallInputs((prev) => ({ ...prev, [question.key]: nextValue }));
                                                                setCustomSelectModeByKey((prev) => ({
                                                                    ...prev,
                                                                    [question.key]: true,
                                                                }));
                                                                setInstallInputErrors((prev) => {
                                                                    if (!prev[question.key])
                                                                        return prev;
                                                                    const next = { ...prev };
                                                                    delete next[question.key];
                                                                    return next;
                                                                });
                                                            }, placeholder: "Enter custom value" })) : null, question.sensitive ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "This value is hidden once saved." })) : null, error ? (_jsx("p", { className: "text-xs text-destructive", children: error })) : null] }, question.key));
                                            }) })] })) : null] }), flowError && (_jsxs("div", { className: "flex items-center gap-2 text-sm text-destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), flowError.message] })), _jsxs("div", { className: "flex justify-end gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: onCancel, children: "Cancel" }), _jsxs(Button, { onClick: handleContinueToReview, children: ["Continue", _jsx(ArrowRight, { className: "h-4 w-4 ml-2" })] })] })] }));
            case "review":
                return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between p-3 bg-muted/50 rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(User, { className: "h-4 w-4 text-muted-foreground" }), _jsx("span", { className: "text-sm", children: "Account" })] }), _jsx("code", { className: "text-xs font-mono", children: primaryAccount ? `${primaryAccount.slice(0, 6)}...${primaryAccount.slice(-4)}` : "Not connected" })] }), _jsxs("div", { className: "space-y-2 p-3 bg-muted/50 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Zap, { className: "h-4 w-4 text-muted-foreground" }), _jsx("span", { className: "text-sm", children: "Token Budgets" })] }), _jsx("span", { className: "text-xs text-muted-foreground", children: usesSingleTokenBudgetMode ? "Single token" : "All tokens" })] }), _jsx("div", { className: "space-y-1", children: reviewBudgetRows.map((row) => (_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: row.symbol }), _jsxs("span", { className: "font-medium", children: [row.amount || "0", " ", row.symbol] })] }, row.tokenPoolId || row.symbol))) }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Policy ceiling (base units):", " ", reviewBudgetSummary?.policyBudgetWei ?? "0"] })] }), _jsxs("div", { className: "flex items-center justify-between p-3 bg-muted/50 rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Shield, { className: "h-4 w-4 text-muted-foreground" }), _jsx("span", { className: "text-sm", children: "Validity" })] }), _jsxs("span", { className: "font-medium", children: [validityDays, " days"] })] }), _jsxs("div", { className: "flex items-center justify-between p-3 bg-muted/50 rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Shield, { className: "h-4 w-4 text-muted-foreground" }), _jsx("span", { className: "text-sm", children: "Network" })] }), _jsx("span", { className: "text-sm", children: selectedNetwork ? (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(NetworkText, { name: selectedNetwork.name, logoUrl: selectedNetwork.logoUrl }), _jsxs("span", { className: "text-muted-foreground", children: ["(Network ", selectedNetwork.networkId, ")"] })] })) : (agent.network?.name ?? "Unknown") })] }), installLabel && (_jsxs("div", { className: "flex items-center justify-between p-3 bg-muted/50 rounded-lg", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Label" }), _jsx("span", { className: "text-sm", children: installLabel })] })), installQuestions.length > 0 ? (_jsxs("div", { className: "p-3 bg-muted/50 rounded-lg space-y-2", children: [_jsx("div", { className: "text-sm font-medium", children: "Configuration" }), installQuestions.map((question) => {
                                            const value = normalizedInstallInputs[question.key] ?? "";
                                            const displayValue = question.sensitive
                                                ? "Hidden"
                                                : value
                                                    ? `${value}${question.unit ? ` ${question.unit}` : ""}`
                                                    : "Not set";
                                            return (_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: question.label }), _jsx("span", { children: displayValue })] }, question.key));
                                        })] })) : null] }), _jsx("div", { className: "p-3 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg", children: _jsx("p", { className: "text-sm text-amber-800 dark:text-amber-200", children: "By installing this agent, you authorize it to execute transactions on your behalf up to the configured budget limits." }) }), flowError && (_jsxs("div", { className: "flex items-center gap-2 text-sm text-destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), flowError.message] })), _jsxs("div", { className: "flex justify-between gap-2 pt-4", children: [_jsxs(Button, { variant: "outline", onClick: handleBack, children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back"] }), _jsx(Button, { onClick: handlePrepare, disabled: isSubmitting, children: isSubmitting ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "h-4 w-4 mr-2 animate-spin" }), "Opening SafeApprove..."] })) : (_jsxs(_Fragment, { children: ["Approve with SafeApprove", _jsx(ArrowRight, { className: "h-4 w-4 ml-2" })] })) })] })] }));
            case "sign":
                return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "text-center py-6", children: [_jsx(User, { className: "h-12 w-12 mx-auto mb-4 text-primary" }), _jsx("h3", { className: "font-medium text-lg", children: "Approve with SafeApprove" }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: isSubmitting
                                        ? "Complete the approval in the SafeApprove modal to continue."
                                        : "Return to the previous step if you need to edit details." })] }), flowError && (_jsxs("div", { className: "flex items-center gap-2 text-sm text-destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), flowError.message] })), _jsx("div", { className: "flex justify-between gap-2 pt-4", children: _jsxs(Button, { variant: "outline", onClick: handleBack, disabled: isSubmitting, children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back"] }) })] }));
            case "confirm":
                return (_jsxs("div", { className: "text-center py-8", children: [_jsx(RefreshCw, { className: "h-12 w-12 mx-auto mb-4 text-primary animate-spin" }), _jsx("h3", { className: "font-medium text-lg", children: "Confirming Installation" }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: "Submitting transaction..." }), transactionHash && (_jsxs("p", { className: "text-xs text-muted-foreground mt-4 font-mono", children: ["TX: ", transactionHash.slice(0, 10), "...", transactionHash.slice(-8)] }))] }));
            case "complete":
                return (_jsxs("div", { className: "text-center py-8", children: [_jsx(CheckCircle, { className: "h-12 w-12 mx-auto mb-4 text-emerald-500" }), _jsx("h3", { className: "font-medium text-lg", children: "Installation Complete!" }), _jsxs("p", { className: "text-sm text-muted-foreground mt-2", children: [agent.displayName, " has been successfully installed."] }), _jsx(Button, { className: "mt-6", onClick: onCancel, children: "Done" })] }));
            case "error":
                return (_jsxs("div", { className: "text-center py-8", children: [_jsx(AlertCircle, { className: "h-12 w-12 mx-auto mb-4 text-destructive" }), _jsx("h3", { className: "font-medium text-lg", children: "Installation Failed" }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: flowError?.message || "An unexpected error occurred." }), _jsxs("div", { className: "flex justify-center gap-2 mt-6", children: [_jsx(Button, { variant: "outline", onClick: onCancel, children: "Cancel" }), _jsx(Button, { onClick: () => setStep("configure"), children: "Try Again" })] })] }));
            default:
                return null;
        }
    };
    const stepTitles = {
        configure: "Configure Installation",
        review: "Review & Confirm",
        sign: "Approve with SafeApprove",
        confirm: "Confirming...",
        complete: "Complete",
        error: "Error",
    };
    return (_jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Bot, { className: "h-5 w-5" }), "Install Agent"] }), _jsx(CardDescription, { children: stepTitles[step] }), !["complete", "error"].includes(step) && (_jsx("div", { className: "flex items-center gap-1 mt-3", children: ["configure", "review", "sign", "confirm"].map((s, i) => (_jsx("div", { className: `h-1.5 flex-1 rounded-full ${["configure", "review", "sign", "confirm"].indexOf(step) >= i
                                ? "bg-primary"
                                : "bg-muted"}` }, s))) }))] }), _jsx(CardContent, { children: renderStep() })] }));
}
