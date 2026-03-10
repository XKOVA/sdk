/**
 * Default polling interval for agent installation state in UI components.
 *
 * @remarks
 * Purpose:
 * - Keep agent status and budget displays fresh without manual refresh.
 *
 * When to use:
 * - Used internally by Agent, InstalledAgentsCard, and AgentMarketplaceCard.
 *
 * When not to use:
 * - Override via component props when a different polling cadence is required.
 *
 * Return semantics:
 * - Constant millisecond interval.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 */
export declare const DEFAULT_AGENT_INSTALLATIONS_POLL_MS = 30000;
