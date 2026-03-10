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
export declare function Agent({ agentid, agentId, enableInstallFlow, installDialogTitle, autoRefreshMs, showDeveloperDiagnostics, }: AgentProps): import("react/jsx-runtime.js").JSX.Element;
