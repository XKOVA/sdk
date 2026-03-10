import type { AgentInstallQuestion } from "../types.js";
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
export declare function getInstallInputDefaults(questions: AgentInstallQuestion[]): Record<string, string>;
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
export declare function normalizeInstallInputs(questions: AgentInstallQuestion[], inputs: Record<string, string | number | null | undefined>, options?: NormalizeInstallInputsOptions): NormalizeInstallInputsResult;
