"use client";

import { useAccountState, useAgentInstallationActions, useIeeContext, useIeeReceiptAction, useTenantConfig } from "@xkova/sdk-react";
import { AgentInstallQuestion, MarketplaceAgent } from "@xkova/sdk-core";
import { useState, useCallback, useEffect, useMemo } from "react";
import { toastError } from "../toast-utils.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { NetworkText } from "./ui/network-text.js";
import {
  RefreshCw,
  Bot,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  User,
  Shield,
  Zap
} from "lucide-react";

type FlowStep = "configure" | "review" | "sign" | "confirm" | "complete" | "error";
type TokenBudgetMode = "all" | "single";
type OperatingTokenOption = {
  tokenPoolId: string;
  symbol: string;
  name: string;
  contract: string;
  decimals: number;
  isStable?: boolean;
  minimumBudget?: string | null;
};

/**
 * Props for the agent installation flow UI.
 *
 * @remarks
 * Purpose:
 * - Configure the guided install flow for marketplace agents.
 *
 * When to use:
 * - Use when embedding the built-in agent install flow.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Return semantics:
 * - Props bag only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `agent` must be a valid marketplace agent.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react agent hooks.
 *
 * @example
 * <AgentInstallFlow agent={agent} />
 */
export interface AgentInstallFlowProps {
  /** The agent to install */
  agent: MarketplaceAgent;
  /** Called when installation is complete */
  onComplete?: (result: { agentActorId: string; installationId: string }) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Disable built-in toast notifications (default: false) */
  disableToasts?: boolean;
  /** Default budget amount (in token units, e.g., "100" for 100 USDC) */
  defaultBudget?: string;
  /** @deprecated Client-provided permissions are non-authoritative and ignored by OAuth. */
  defaultPermissions?: string[];
  /** Optional initial validity window (days). OAuth still enforces service min/default/max bounds. */
  defaultValidityDays?: number;
  /**
   * Token budget mode.
   *
   * `all` (default): collect a budget input for each available operating token.
   * `single`: collect budget for only the selected operating token.
   */
  tokenBudgetMode?: TokenBudgetMode;
}

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
function formatUnits(value: string, decimals: number): string {
  const v = BigInt(value || '0');
  if (decimals <= 0) return v.toString();
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  if (frac === 0n) return whole.toString();
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
function parseUnits(value: string, decimals: number): bigint {
  const raw = (value ?? '').trim();
  if (raw === '') return 0n;
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

type InstallInputState = Record<string, string>;
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

const buildDefaultInstallInputs = (
  questions: AgentInstallQuestion[],
): InstallInputState => {
  const defaults: InstallInputState = {};
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
const sanitizeUnsignedDecimalInput = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");
  const fraction = fractionParts.join("");
  return fractionParts.length > 0 ? `${whole}.${fraction}` : whole;
};

const normalizeInstallInputs = (
  questions: AgentInstallQuestion[],
  inputs: InstallInputState,
): { normalized: InstallInputState; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  const normalized: InstallInputState = {};

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
    } else if (question.type === "select") {
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
export function AgentInstallFlow({
  agent,
  onComplete,
  onCancel,
  onError,
  disableToasts = false,
  defaultBudget = "100",
  defaultValidityDays,
  tokenBudgetMode = "all",
}: AgentInstallFlowProps) {
  const { confirmInstallation } = useAgentInstallationActions();
  const { tenantId, clientId, userId } = useIeeContext();
  const iee = useIeeReceiptAction();
  const { tokens, networks } = useTenantConfig();
  const { account } = useAccountState();

  const operatingTokenOptions = useMemo<OperatingTokenOption[]>(() => {
    if (
      Array.isArray(agent.availableOperatingTokens) &&
      agent.availableOperatingTokens.length > 0
    ) {
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
  const normalizedTokenBudgetMode: TokenBudgetMode =
    tokenBudgetMode === "single" ? "single" : "all";
  const defaultTokenPoolId = useMemo(() => {
    if (!operatingTokenOptions.length) {
      return "";
    }
    const preferredTokenPoolId = String(agent.operatingToken?.tokenPoolId ?? "").trim();
    if (
      preferredTokenPoolId &&
      operatingTokenOptions.some(
        (token) => token.tokenPoolId === preferredTokenPoolId,
      )
    ) {
      return preferredTokenPoolId;
    }
    return operatingTokenOptions[0].tokenPoolId;
  }, [agent.operatingToken?.tokenPoolId, operatingTokenOptions]);
  const [selectedTokenPoolId, setSelectedTokenPoolId] = useState<string>(
    defaultTokenPoolId,
  );

  const selectedOperatingToken = useMemo(() => {
    if (!operatingTokenOptions.length) return null;
    if (!selectedTokenPoolId) {
      return operatingTokenOptions[0] ?? null;
    }
    return (
      operatingTokenOptions.find(
        (token) => token.tokenPoolId === selectedTokenPoolId,
      ) ??
      operatingTokenOptions[0] ??
      null
    );
  }, [operatingTokenOptions, selectedTokenPoolId]);

  // Prefer agent-defined minimum budget as the default shown to the user.
  const tokenSymbol =
    selectedOperatingToken?.symbol ??
    tokens?.find((t) => t.isPrimary || t.isDefault)?.symbol ??
    "TOKEN";
  const tokenDecimals =
    selectedOperatingToken?.decimals ??
    tokens?.find((t) => t.isPrimary || t.isDefault)?.decimals ??
    18;
  const resolveTokenMinimumBudget = useCallback(
    (
      tokenPoolId: string,
      tokenMinimumBudget?: string | null,
    ): string | null => {
      const tokenMinimumBudgetRaw =
        typeof tokenMinimumBudget === "string" ? tokenMinimumBudget.trim() : "";
      if (/^\d+$/.test(tokenMinimumBudgetRaw)) {
        return tokenMinimumBudgetRaw;
      }
      const mappedMinimumRaw =
        agent.minimumBudgetByTokenPoolId &&
        typeof agent.minimumBudgetByTokenPoolId[tokenPoolId] === "string"
          ? String(agent.minimumBudgetByTokenPoolId[tokenPoolId]).trim()
          : "";
      if (/^\d+$/.test(mappedMinimumRaw)) {
        return mappedMinimumRaw;
      }
      const globalMinimumRaw =
        typeof agent.minimumBudget === "string" ? agent.minimumBudget.trim() : "";
      if (/^\d+$/.test(globalMinimumRaw)) {
        return globalMinimumRaw;
      }
      return null;
    },
    [agent.minimumBudget, agent.minimumBudgetByTokenPoolId],
  );
  const selectedTokenMinimumBudget = useMemo(
    () =>
      resolveTokenMinimumBudget(
        selectedTokenPoolId,
        selectedOperatingToken?.minimumBudget,
      ),
    [
      resolveTokenMinimumBudget,
      selectedOperatingToken?.minimumBudget,
      selectedTokenPoolId,
    ],
  );
  const effectiveDefaultBudget = (() => {
    const minWei = selectedTokenMinimumBudget;
    if (!minWei) return defaultBudget;
    try {
      return formatUnits(minWei, tokenDecimals);
    } catch {
      return defaultBudget;
    }
  })();

  const [step, setStep] = useState<FlowStep>("configure");
  const [singleBudget, setSingleBudget] = useState(effectiveDefaultBudget);
  const [budgetByTokenPoolId, setBudgetByTokenPoolId] = useState<
    Record<string, string>
  >({});
  const [installLabel, setInstallLabel] = useState("");
  const validityBounds = useMemo(() => {
    const parseBound = (value: unknown, fallback: number): number => {
      const parsed =
        typeof value === "number"
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
  const [validityDays, setValidityDays] = useState<number>(() => {
    if (
      typeof defaultValidityDays === "number" &&
      Number.isInteger(defaultValidityDays)
    ) {
      return defaultValidityDays;
    }
    return validityBounds.defaultDays;
  });
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const installQuestions = useMemo(
    () => (Array.isArray(agent.installQuestions) ? agent.installQuestions : []),
    [agent.installQuestions],
  );
  const [installInputs, setInstallInputs] = useState<InstallInputState>(() =>
    buildDefaultInstallInputs(installQuestions),
  );
  const [customSelectModeByKey, setCustomSelectModeByKey] = useState<
    Record<string, boolean>
  >({});
  const [installInputErrors, setInstallInputErrors] = useState<Record<string, string>>({});
  const [normalizedInstallInputs, setNormalizedInstallInputs] = useState<InstallInputState>({});

  const selectedNetwork = useMemo(() => {
    if (!agent.network?.networkId) return networks?.[0] ?? null;
    return (
      networks?.find(
        (network) =>
          String(network.networkId) === String(agent.network?.networkId),
      ) ??
      null
    );
  }, [agent.network?.networkId, networks]);
  const primaryAccount = account ?? null;

  useEffect(() => {
    const defaults = buildDefaultInstallInputs(installQuestions);
    const nextCustomSelectMode: Record<string, boolean> = {};
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
    const nextBudgets: Record<string, string> = {};
    for (const token of operatingTokenOptions) {
      const minimumBudget = resolveTokenMinimumBudget(
        token.tokenPoolId,
        token.minimumBudget,
      );
      if (minimumBudget) {
        try {
          nextBudgets[token.tokenPoolId] = formatUnits(
            minimumBudget,
            token.decimals,
          );
          continue;
        } catch {
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
    if (
      typeof defaultValidityDays === "number" &&
      Number.isInteger(defaultValidityDays)
    ) {
      setValidityDays(defaultValidityDays);
      return;
    }
    setValidityDays(validityBounds.defaultDays);
  }, [agent.agentServiceId, defaultValidityDays, validityBounds.defaultDays]);

  useEffect(() => {
    if (
      selectedTokenPoolId &&
      operatingTokenOptions.some(
        (token) => token.tokenPoolId === selectedTokenPoolId,
      )
    ) {
      return;
    }
    setSelectedTokenPoolId(defaultTokenPoolId);
  }, [
    defaultTokenPoolId,
    operatingTokenOptions,
    selectedTokenPoolId,
  ]);

  const usesSingleTokenBudgetMode =
    normalizedTokenBudgetMode === "single" ||
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
      const minimumBudget = resolveTokenMinimumBudget(
        token.tokenPoolId,
        token.minimumBudget,
      );
      if (minimumBudget && parsed < BigInt(minimumBudget)) {
        throw new Error(
          `${token.symbol} budget must be at least the minimum budget`,
        );
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
    const tokenBudgetsByTokenPoolId: Record<string, string> = {};
    for (const token of operatingTokenOptions) {
      const rawBudget = String(
        budgetByTokenPoolId[token.tokenPoolId] ?? "",
      ).trim();
      const parsed = parseUnits(rawBudget, token.decimals);
      if (parsed <= 0n) {
        throw new Error(`Please enter a valid ${token.symbol} budget amount`);
      }
      const minimumBudget = resolveTokenMinimumBudget(
        token.tokenPoolId,
        token.minimumBudget,
      );
      if (minimumBudget && parsed < BigInt(minimumBudget)) {
        throw new Error(
          `${token.symbol} budget must be at least the minimum budget`,
        );
      }
      tokenBudgetsByTokenPoolId[token.tokenPoolId] = parsed.toString();
      total += parsed;
    }

    const selectedTokenForInstall =
      defaultTokenPoolId || operatingTokenOptions[0]?.tokenPoolId || null;
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
    } catch {
      return null;
    }
  }, [resolveInstallBudgetSelection]);

  // Step 1: Configure -> Review
  const handleContinueToReview = useCallback(() => {
    if (
      !Number.isInteger(validityDays) ||
      validityDays < validityBounds.min ||
      validityDays > validityBounds.max
    ) {
      setFlowError(
        new Error(
          `Validity must be between ${validityBounds.min} and ${validityBounds.max} days`,
        ),
      );
      return;
    }
    try {
      resolveInstallBudgetSelection();
    } catch (error) {
      setFlowError(
        error instanceof Error
          ? error
          : new Error("Please enter a valid budget amount"),
      );
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
      if (
        !Number.isInteger(validityDays) ||
        validityDays < validityBounds.min ||
        validityDays > validityBounds.max
      ) {
        throw new Error(
          `Validity must be between ${validityBounds.min} and ${validityBounds.max} days`,
        );
      }

      const installValidation = normalizeInstallInputs(installQuestions, installInputs);
      if (Object.keys(installValidation.errors).length > 0) {
        setInstallInputErrors(installValidation.errors);
        throw new Error("Please complete required fields");
      }
      setInstallInputErrors({});
      setNormalizedInstallInputs(installValidation.normalized);

      const payload: Record<string, unknown> = {
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
      const metadata: Record<string, unknown> = {
        ...(installQuestions.length > 0
          ? {
              install_inputs: installValidation.normalized,
              ...(agent.installQuestionsVersion !== undefined &&
              agent.installQuestionsVersion !== null
                ? { install_questions_version: agent.installQuestionsVersion }
                : {}),
            }
          : {}),
        token_budgets_by_token_pool_id:
          budgetSelection.tokenBudgetsByTokenPoolId,
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
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }

      const installationIdRaw = receiptResult.installationId ?? null;
      const installationId =
        typeof installationIdRaw === "string" ? installationIdRaw.trim() : "";
      if (!installationId) {
        throw new Error("SafeApprove approval did not return an installation id");
      }

      const txHashRaw =
        receiptResult.transactionHash ?? receiptResult.userOpHash ?? null;
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
    } catch (err) {
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
    if (step === "review") setStep("configure");
    else if (step === "sign") setStep("review");
  }, [step]);

  const renderStep = () => {
    switch (step) {
      case "configure":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {(agent.iconUrl ?? agent.avatarUrl) ? (
                  <img
                    src={agent.iconUrl ?? agent.avatarUrl ?? ""}
                    alt={agent.displayName}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <Bot className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-medium">{agent.displayName}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {agent.description}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {usesSingleTokenBudgetMode ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="selected-token">Operating Token</Label>
                    {operatingTokenOptions.length > 1 ? (
                      <select
                        id="selected-token"
                        value={selectedTokenPoolId}
                        onChange={(event) => {
                          const nextTokenPoolId = event.target.value;
                          setSelectedTokenPoolId(nextTokenPoolId);
                          const nextToken = operatingTokenOptions.find(
                            (token) => token.tokenPoolId === nextTokenPoolId,
                          );
                          const nextMinimumBudget = nextToken
                            ? resolveTokenMinimumBudget(
                                nextToken.tokenPoolId,
                                nextToken.minimumBudget,
                              )
                            : null;
                          if (nextToken && nextMinimumBudget) {
                            try {
                              setSingleBudget(
                                formatUnits(
                                  nextMinimumBudget,
                                  nextToken.decimals,
                                ),
                              );
                            } catch {
                              setSingleBudget(defaultBudget);
                            }
                          }
                          setFlowError(null);
                        }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {operatingTokenOptions.map((token) => (
                          <option key={token.tokenPoolId} value={token.tokenPoolId}>
                            {token.symbol}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id="selected-token"
                        value={selectedOperatingToken?.symbol ?? tokenSymbol}
                        readOnly
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      This agent installation will use the selected token as its default.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget Amount</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="budget"
                        type="number"
                        min="0"
                        step="0.01"
                        value={singleBudget}
                        onChange={(e) => setSingleBudget(e.target.value)}
                        placeholder="100"
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-16">
                        {tokenSymbol}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Maximum amount the agent can spend on your behalf.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <Label>Token Budgets</Label>
                  <p className="text-xs text-muted-foreground">
                    Set a budget for each operating token. The install policy budget uses the total of all token budgets.
                  </p>
                  {operatingTokenOptions.map((token) => {
                    const minimumBudget = resolveTokenMinimumBudget(
                      token.tokenPoolId,
                      token.minimumBudget,
                    );
                    let minimumBudgetDisplay: string | null = null;
                    if (minimumBudget) {
                      try {
                        minimumBudgetDisplay = `${formatUnits(
                          minimumBudget,
                          token.decimals,
                        )} ${token.symbol}`;
                      } catch {
                        minimumBudgetDisplay = null;
                      }
                    }
                    return (
                      <div
                        key={token.tokenPoolId}
                        className="space-y-2 rounded-md border border-border bg-muted/20 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground">
                            {token.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`budget-${token.tokenPoolId}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={budgetByTokenPoolId[token.tokenPoolId] ?? ""}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setBudgetByTokenPoolId((prev) => ({
                                ...prev,
                                [token.tokenPoolId]: nextValue,
                              }));
                            }}
                            placeholder="100"
                            className="flex-1"
                          />
                          <span className="text-sm text-muted-foreground w-16">
                            {token.symbol}
                          </span>
                        </div>
                        {minimumBudgetDisplay ? (
                          <p className="text-xs text-muted-foreground">
                            Minimum budget: {minimumBudgetDisplay}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="validity-days">Validity Window (days)</Label>
                <Input
                  id="validity-days"
                  type="number"
                  min={String(validityBounds.min)}
                  max={String(validityBounds.max)}
                  step="1"
                  value={String(validityDays)}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (!Number.isFinite(parsed)) {
                      setValidityDays(validityBounds.defaultDays);
                      return;
                    }
                    setValidityDays(Math.trunc(parsed));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Agent permissions stay active for this period ({validityBounds.min}-{validityBounds.max} days).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Installation Label (Optional)</Label>
                <Input
                  id="label"
                  value={installLabel}
                  onChange={(e) => setInstallLabel(e.target.value)}
                  placeholder="e.g., Trading Bot #1"
                />
                <p className="text-xs text-muted-foreground">
                  A friendly name to identify this installation.
                </p>
              </div>

              {installQuestions.length > 0 ? (
                <div className="space-y-3">
                  <Label>Install Questions</Label>
                  <div className="space-y-3">
                    {installQuestions.map((question) => {
                      const inputId = `install-${question.key}`;
                      const error = installInputErrors[question.key];
                      const isNumber = question.type === "number";
                      const isSelect = question.type === "select";
                      const currentInputValue = installInputs[question.key] ?? "";
                      const selectOptions = getQuestionOptions(question);
                      const optionValues = getQuestionOptionValues(question);
                      const allowsCustom = allowsCustomSelectValue(question);
                      const hasMappedOption = optionValues.has(currentInputValue);
                      const isCustomMode =
                        isSelect &&
                        allowsCustom &&
                        (customSelectModeByKey[question.key] === true ||
                          (!hasMappedOption && currentInputValue.trim() !== ""));
                      const selectValue = isCustomMode
                        ? CUSTOM_SELECT_VALUE
                        : hasMappedOption
                          ? currentInputValue
                          : "";
                      const showCustomInput =
                        isSelect && allowsCustom && isCustomMode;
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
                                    [question.key]:
                                      nextSelection === CUSTOM_SELECT_VALUE,
                                  }));
                                  setInstallInputErrors((prev) => {
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
                                  <option key={`${question.key}-${option.value}`} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                                {allowsCustom ? (
                                  <option value={CUSTOM_SELECT_VALUE}>Custom value</option>
                                ) : null}
                              </select>
                            ) : (
                              <Input
                                id={inputId}
                                type={
                                  isNumber
                                    ? "text"
                                    : question.sensitive
                                      ? "password"
                                      : "text"
                                }
                                min={isNumber && typeof question.min === "number" ? question.min : undefined}
                                max={isNumber && typeof question.max === "number" ? question.max : undefined}
                                step={isNumber ? (typeof question.step === "number" ? question.step : "any") : undefined}
                                value={currentInputValue}
                                onChange={(e) => {
                                  const nextValue = isNumber
                                    ? sanitizeUnsignedDecimalInput(e.target.value)
                                    : e.target.value;
                                  setInstallInputs((prev) => ({ ...prev, [question.key]: nextValue }));
                                  setInstallInputErrors((prev) => {
                                    if (!prev[question.key]) return prev;
                                    const next = { ...prev };
                                    delete next[question.key];
                                    return next;
                                  });
                                }}
                                inputMode={isNumber ? "decimal" : undefined}
                                placeholder={question.default !== undefined && question.default !== null ? String(question.default) : undefined}
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
                                setInstallInputs((prev) => ({ ...prev, [question.key]: nextValue }));
                                setCustomSelectModeByKey((prev) => ({
                                  ...prev,
                                  [question.key]: true,
                                }));
                                setInstallInputErrors((prev) => {
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
                              This value is hidden once saved.
                            </p>
                          ) : null}
                          {error ? (
                            <p className="text-xs text-destructive">{error}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {flowError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {flowError.message}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleContinueToReview}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Account</span>
                </div>
                <code className="text-xs font-mono">
                  {primaryAccount ? `${primaryAccount.slice(0, 6)}...${primaryAccount.slice(-4)}` : "Not connected"}
                </code>
              </div>

              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Token Budgets</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {usesSingleTokenBudgetMode ? "Single token" : "All tokens"}
                  </span>
                </div>
                <div className="space-y-1">
                  {reviewBudgetRows.map((row) => (
                    <div
                      key={row.tokenPoolId || row.symbol}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{row.symbol}</span>
                      <span className="font-medium">
                        {row.amount || "0"} {row.symbol}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Policy ceiling (base units):{" "}
                  {reviewBudgetSummary?.policyBudgetWei ?? "0"}
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Validity</span>
                </div>
                <span className="font-medium">{validityDays} days</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Network</span>
                </div>
                <span className="text-sm">
                  {selectedNetwork ? (
                    <span className="inline-flex items-center gap-2">
                      <NetworkText name={selectedNetwork.name} logoUrl={(selectedNetwork as any).logoUrl} />
                      <span className="text-muted-foreground">(Network {selectedNetwork.networkId})</span>
                    </span>
                  ) : (
                    agent.network?.name ?? "Unknown"
                  )}
                </span>
              </div>

              {installLabel && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Label</span>
                  <span className="text-sm">{installLabel}</span>
                </div>
              )}

              {installQuestions.length > 0 ? (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="text-sm font-medium">Configuration</div>
                  {installQuestions.map((question) => {
                    const value = normalizedInstallInputs[question.key] ?? "";
                    const displayValue = question.sensitive
                      ? "Hidden"
                      : value
                        ? `${value}${question.unit ? ` ${question.unit}` : ""}`
                        : "Not set";
                    return (
                      <div
                        key={question.key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {question.label}
                        </span>
                        <span>{displayValue}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="p-3 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                By installing this agent, you authorize it to execute transactions on your behalf up to the configured budget limits.
              </p>
            </div>

            {flowError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {flowError.message}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handlePrepare} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Opening SafeApprove...
                  </>
                ) : (
                  <>
                    Approve with SafeApprove
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "sign":
        return (
          <div className="space-y-4">
            <div className="text-center py-6">
              <User className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-medium text-lg">Approve with SafeApprove</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {isSubmitting
                  ? "Complete the approval in the SafeApprove modal to continue."
                  : "Return to the previous step if you need to edit details."}
              </p>
            </div>

            {flowError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {flowError.message}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        );

      case "confirm":
        return (
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
            <h3 className="font-medium text-lg">Confirming Installation</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Submitting transaction...
            </p>
            {transactionHash && (
              <p className="text-xs text-muted-foreground mt-4 font-mono">
                TX: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
              </p>
            )}
          </div>
        );

      case "complete":
        return (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
            <h3 className="font-medium text-lg">Installation Complete!</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {agent.displayName} has been successfully installed.
            </p>
            <Button className="mt-6" onClick={onCancel}>
              Done
            </Button>
          </div>
        );

      case "error":
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="font-medium text-lg">Installation Failed</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {flowError?.message || "An unexpected error occurred."}
            </p>
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => setStep("configure")}>
                Try Again
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const stepTitles: Record<FlowStep, string> = {
    configure: "Configure Installation",
    review: "Review & Confirm",
    sign: "Approve with SafeApprove",
    confirm: "Confirming...",
    complete: "Complete",
    error: "Error",
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Install Agent
        </CardTitle>
        <CardDescription>{stepTitles[step]}</CardDescription>
        {/* Progress indicator */}
        {!["complete", "error"].includes(step) && (
          <div className="flex items-center gap-1 mt-3">
            {["configure", "review", "sign", "confirm"].map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${["configure", "review", "sign", "confirm"].indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-muted"
                  }`}
              />
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>{renderStep()}</CardContent>
    </Card>
  );
}
