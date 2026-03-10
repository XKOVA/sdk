import { MarketplaceAgent } from "@xkova/sdk-core";
/**
 * Props for {@link AgentMarketplaceCard}.
 *
 * @remarks
 * Purpose:
 * - Configure filters and callbacks for marketplace catalog UI.
 *
 * When to use:
 * - Use when customizing catalog filters or install flows.
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
 * - `limit` is applied after filtering when provided.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react marketplace hooks.
 */
export interface AgentMarketplaceCardProps {
    /** Filter by category */
    category?: string;
    /** Maximum number of agents to show */
    limit?: number;
    /** Polling fallback interval for installations in ms (<= 0 disables). Default: 30000 when realtime is unavailable. */
    autoRefreshMs?: number;
    /** Called when user clicks Install on an agent */
    onInstall?: (agent: MarketplaceAgent) => void;
    /** Called when user clicks View Details on an agent */
    onViewDetails?: (agent: MarketplaceAgent) => void;
    /** Show only featured agents */
    featuredOnly?: boolean;
    /** If true and onInstall is not provided, AgentMarketplaceCard will show the built-in install flow modal. */
    enableInstallFlow?: boolean;
    /** Title for the install modal (visually hidden, for a11y). */
    installDialogTitle?: string;
}
/**
 * Renders the tenant-scoped marketplace catalog and (optionally) the built-in install flow.
 *
 * @remarks
 * Purpose:
 * - Render the tenant-scoped marketplace catalog and optional install flow.
 *
 * When to use:
 * - Use when you want a ready-made marketplace catalog UI.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: AgentMarketplaceCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders an in-card error message and allows retry via refresh.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 * - Layout defaults to a single-column grid and expands to two columns at the `sm` breakpoint.
 *
 * Side effects:
 * - Calls marketplace hooks and opens modal dialogs.
 *
 * Invariants/assumptions:
 * - Marketplace catalog is tenant-scoped and requires authentication.
 * - Installed badges exclude revoked installs; pending revocations show as uninstalling.
 * - Pending webhook provisioning surfaces as provisioning status.
 * - Built-in install flow auto-closes on success and will not open when already installed.
 *
 * Data/auth references:
 * - Uses `/marketplace/tenant/catalog` via sdk-react hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <AgentMarketplaceCard enableInstallFlow installDialogTitle="Install Agent" />
 */
export declare function AgentMarketplaceCard({ category, limit, autoRefreshMs, onInstall, onViewDetails, featuredOnly, enableInstallFlow, installDialogTitle, }: AgentMarketplaceCardProps): import("react/jsx-runtime.js").JSX.Element;
