"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Menu, Pause, Play, Sliders, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "./ui/button.js";

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
export function AgentActionsMenu({
  isPaused,
  onPauseToggle,
  pauseDisabled,
  onViewDetails,
  viewDisabled,
  onConfigure,
  configureDisabled,
  onIncreaseBudget,
  increaseDisabled,
  onDecreaseBudget,
  decreaseDisabled,
  onUninstall,
  uninstallDisabled,
  uninstallLabel,
}: AgentActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const pauseLabel = isPaused ? "Resume agent" : "Pause agent";
  const PauseIcon = isPaused ? Play : Pause;

  const actions = useMemo(
    () => [
      {
        key: "pause",
        label: pauseLabel,
        icon: PauseIcon,
        onClick: onPauseToggle,
        disabled: pauseDisabled,
        className: "text-zinc-300 focus:bg-zinc-800 focus:text-white",
        show: Boolean(onPauseToggle),
      },
      {
        key: "view",
        label: "View details",
        icon: Eye,
        onClick: onViewDetails,
        disabled: viewDisabled,
        className: "text-zinc-300 focus:bg-zinc-800 focus:text-white",
        show: Boolean(onViewDetails),
      },
      {
        key: "configure",
        label: "Configure",
        icon: Sliders,
        onClick: onConfigure,
        disabled: configureDisabled,
        className: "text-zinc-300 focus:bg-zinc-800 focus:text-white",
        show: Boolean(onConfigure),
      },
      {
        key: "increase",
        label: "Increase budget",
        icon: TrendingUp,
        onClick: onIncreaseBudget,
        disabled: increaseDisabled,
        className: "text-emerald-400 focus:bg-zinc-800 focus:text-emerald-300",
        show: Boolean(onIncreaseBudget),
      },
      {
        key: "decrease",
        label: "Decrease budget",
        icon: TrendingDown,
        onClick: onDecreaseBudget,
        disabled: decreaseDisabled,
        className: "text-orange-400 focus:bg-zinc-800 focus:text-orange-300",
        show: Boolean(onDecreaseBudget),
      },
      {
        key: "uninstall",
        label: uninstallLabel ?? "Uninstall agent",
        icon: Trash2,
        onClick: onUninstall,
        disabled: uninstallDisabled,
        className: "text-red-400 focus:bg-zinc-800 focus:text-red-300",
        show: Boolean(onUninstall),
      },
    ],
    [
      PauseIcon,
      decreaseDisabled,
      increaseDisabled,
      isPaused,
      onDecreaseBudget,
      onIncreaseBudget,
      onPauseToggle,
      onUninstall,
      onViewDetails,
      pauseDisabled,
      pauseLabel,
      uninstallDisabled,
      uninstallLabel,
      viewDisabled,
    ],
  );

  const visibleActions = actions.filter((action) => action.show);
  if (visibleActions.length === 0) return null;

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 rounded-md border border-zinc-800 bg-zinc-900 p-1 shadow-lg z-50"
        >
          {visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50 ${action.className}`}
                onClick={() => {
                  if (action.disabled || !action.onClick) return;
                  action.onClick();
                  setOpen(false);
                }}
                disabled={action.disabled}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
