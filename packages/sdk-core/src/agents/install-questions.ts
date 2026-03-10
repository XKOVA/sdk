import type { AgentInstallQuestion } from "../types.js";

const getSelectOptionValues = (question: AgentInstallQuestion): Set<string> =>
  new Set(
    (question.options ?? [])
      .map((option) =>
        typeof option?.value === "string" ? option.value.trim() : "",
      )
      .filter(Boolean),
  );

const allowsCustomSelectValue = (question: AgentInstallQuestion): boolean =>
  question.allow_custom === true;

export interface NormalizeInstallInputsOptions {
  /**
   * Validation mode.
   * - `install`: require all required fields (unless default provided).
   * - `update`: allow missing values if an existing value exists.
   */
  mode?: "install" | "update";
  /** Existing install inputs for update flows. */
  existingInputs?: Record<string, string>;
  /**
   * When true, apply question defaults if the user leaves the field blank.
   * Defaults to true for install mode and false for update mode.
   */
  includeDefaults?: boolean;
}

export interface NormalizeInstallInputsResult {
  normalized: Record<string, string>;
  errors: Record<string, string>;
}

/**
 * Build default install inputs from question definitions.
 *
 * @remarks
 * Purpose:
 * - Provide a baseline map of install inputs using question defaults.
 *
 * Return semantics:
 * - Returns a map of question keys to stringified default values.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Only includes keys with defined defaults.
 */
export function getInstallInputDefaults(
  questions: AgentInstallQuestion[],
): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const question of questions) {
    if (question.default !== undefined && question.default !== null) {
      defaults[question.key] = String(question.default);
    }
  }
  return defaults;
}

/**
 * Normalize and validate install inputs against question definitions.
 *
 * @remarks
 * Purpose:
 * - Provide headless validation that mirrors SDK UI rules.
 *
 * Return semantics:
 * - Returns `{ normalized, errors }` where `normalized` contains string values
 *   suitable for `install_inputs` and `errors` maps question keys to messages.
 *
 * Errors/failure modes:
 * - Never throws; validation errors are surfaced in the `errors` map.
 *
 * Side effects:
 * - None.
 */
export function normalizeInstallInputs(
  questions: AgentInstallQuestion[],
  inputs: Record<string, string | number | null | undefined>,
  options: NormalizeInstallInputsOptions = {},
): NormalizeInstallInputsResult {
  const errors: Record<string, string> = {};
  const normalized: Record<string, string> = {};
  const mode = options.mode ?? "install";
  const includeDefaults =
    options.includeDefaults ?? (mode === "install" ? true : false);
  const existingInputs = options.existingInputs ?? {};

  for (const question of questions) {
    const raw = inputs?.[question.key];
    const trimmed =
      raw === undefined || raw === null ? "" : String(raw).trim();
    let value = trimmed;

    if (!value && includeDefaults && question.default !== undefined && question.default !== null) {
      value = String(question.default);
    }

    if (!value) {
      const existing = existingInputs[question.key];
      if (mode === "update" && typeof existing === "string" && existing.trim()) {
        continue;
      }
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
      const optionValues = getSelectOptionValues(question);
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
}
