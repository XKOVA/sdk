/**
 * Props for {@link AgentActionsMenu}.
 *
 * @remarks
 * Purpose:
 * - Render a compact actions menu for agent rows.
 *
 * When to use:
 * - Use when an agent row needs a minimal action surface on small screens.
 *
 * When not to use:
 * - Do not use when actions should be always visible (use inline buttons instead).
 *
 * Parameters:
 * - `isPaused`: When true, shows "Resume agent" instead of "Pause agent".
 * - `onPauseToggle`: Called when pause/resume is selected.
 * - `onViewDetails`: Called when "View details" is selected.
 * - `onConfigure`: Called when "Configure" is selected.
 * - `onIncreaseBudget`: Called when "Increase budget" is selected.
 * - `onDecreaseBudget`: Called when "Decrease budget" is selected.
 * - `onUninstall`: Called when "Uninstall agent" is selected.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None; actions are invoked via callbacks.
 */
export interface AgentActionsMenuProps {
    isPaused?: boolean;
    onPauseToggle?: () => void;
    pauseDisabled?: boolean;
    onViewDetails?: () => void;
    viewDisabled?: boolean;
    onConfigure?: () => void;
    configureDisabled?: boolean;
    onIncreaseBudget?: () => void;
    increaseDisabled?: boolean;
    onDecreaseBudget?: () => void;
    decreaseDisabled?: boolean;
    onUninstall?: () => void;
    uninstallDisabled?: boolean;
    uninstallLabel?: string;
}
/**
 * Dropdown-style menu for agent actions.
 */
export declare function AgentActionsMenu({ isPaused, onPauseToggle, pauseDisabled, onViewDetails, viewDisabled, onConfigure, configureDisabled, onIncreaseBudget, increaseDisabled, onDecreaseBudget, decreaseDisabled, onUninstall, uninstallDisabled, uninstallLabel, }: AgentActionsMenuProps): import("react/jsx-runtime.js").JSX.Element | null;
