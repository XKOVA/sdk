"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Menu, Pause, Play, Sliders, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "./ui/button.js";
/**
 * Dropdown-style menu for agent actions.
 */
export function AgentActionsMenu({ isPaused, onPauseToggle, pauseDisabled, onViewDetails, viewDisabled, onConfigure, configureDisabled, onIncreaseBudget, increaseDisabled, onDecreaseBudget, decreaseDisabled, onUninstall, uninstallDisabled, uninstallLabel, }) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);
    const triggerRef = useRef(null);
    const pauseLabel = isPaused ? "Resume agent" : "Pause agent";
    const PauseIcon = isPaused ? Play : Pause;
    const actions = useMemo(() => [
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
    ], [
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
    ]);
    const visibleActions = actions.filter((action) => action.show);
    if (visibleActions.length === 0)
        return null;
    useEffect(() => {
        if (!open)
            return;
        const handleClickOutside = (event) => {
            const target = event.target;
            if (menuRef.current?.contains(target))
                return;
            if (triggerRef.current?.contains(target))
                return;
            setOpen(false);
        };
        const handleKeyDown = (event) => {
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
    return (_jsxs("div", { className: "relative", ref: menuRef, children: [_jsx(Button, { ref: triggerRef, variant: "ghost", size: "icon", className: "h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700", "aria-haspopup": "menu", "aria-expanded": open, onClick: () => setOpen((prev) => !prev), children: _jsx(Menu, { className: "h-4 w-4" }) }), open ? (_jsx("div", { role: "menu", className: "absolute right-0 mt-2 w-48 rounded-md border border-zinc-800 bg-zinc-900 p-1 shadow-lg z-50", children: visibleActions.map((action) => {
                    const Icon = action.icon;
                    return (_jsxs("button", { type: "button", role: "menuitem", className: `flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50 ${action.className}`, onClick: () => {
                            if (action.disabled || !action.onClick)
                                return;
                            action.onClick();
                            setOpen(false);
                        }, disabled: action.disabled, children: [_jsx(Icon, { className: "h-4 w-4" }), action.label] }, action.key));
                }) })) : null] }));
}
