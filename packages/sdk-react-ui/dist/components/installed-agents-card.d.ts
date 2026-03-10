import { AgentInstallationDetails } from "@xkova/sdk-core";
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
export declare function InstalledAgentsCard({ onConfigure, onUninstall, showBudget, autoRefreshMs, showDeveloperDiagnostics, agentid, agentId, agentServiceId, variant, forceExpanded, }: InstalledAgentsCardProps): import("react/jsx-runtime.js").JSX.Element;
