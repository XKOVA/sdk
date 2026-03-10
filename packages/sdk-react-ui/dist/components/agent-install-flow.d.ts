import { MarketplaceAgent } from "@xkova/sdk-core";
type TokenBudgetMode = "all" | "single";
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
    onComplete?: (result: {
        agentActorId: string;
        installationId: string;
    }) => void;
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
export declare function AgentInstallFlow({ agent, onComplete, onCancel, onError, disableToasts, defaultBudget, defaultValidityDays, tokenBudgetMode, }: AgentInstallFlowProps): import("react/jsx-runtime.js").JSX.Element;
export {};
