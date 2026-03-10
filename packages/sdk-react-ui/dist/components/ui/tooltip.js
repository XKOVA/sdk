"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../utils.js";
/**
 * TooltipProvider configures shared tooltip behavior for descendants.
 *
 * @remarks
 * Purpose:
 * - Provides global tooltip timing and hover behavior for a subtree.
 *
 * When to use:
 * - Use at the root of a subtree that relies on tooltips.
 *
 * When not to use:
 * - Do not wrap the entire app if you need different timing rules per section.
 *
 * Parameters:
 * - props.delayDuration: Delay before opening (ms, optional).
 * - props.skipDelayDuration: Delay before re-opening after close (ms, optional).
 * - props.disableHoverableContent: When true, hover on content will not keep it open (optional).
 * - props.children: Tooltip-enabled subtree (required).
 *
 * Return semantics:
 * - Returns a provider element that wraps tooltip usage.
 *
 * Errors/failure modes:
 * - None; renders children regardless of configuration.
 *
 * Side effects:
 * - Applies tooltip timing rules to descendants.
 *
 * Invariants/assumptions:
 * - Should wrap any Tooltip/TooltipTrigger/TooltipContent usage for consistent behavior.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events for hover/focus.
 *
 * @example
 * <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
 *
 * @see Tooltip
 * @see TooltipContent
 */
const TooltipProvider = TooltipPrimitive.Provider;
/**
 * Tooltip root component that manages open state.
 *
 * @remarks
 * Purpose:
 * - Defines a single tooltip instance with trigger + content.
 *
 * When to use:
 * - Use to provide short contextual hints on hover or focus.
 *
 * When not to use:
 * - Do not use for long-form guidance; use a dialog or inline text.
 *
 * Parameters:
 * - props.open: Controlled open state (optional).
 * - props.defaultOpen: Uncontrolled default state (optional).
 * - props.onOpenChange: Callback for open state changes (optional).
 * - props.children: TooltipTrigger + TooltipContent (required).
 *
 * Return semantics:
 * - Returns a Radix tooltip root element.
 *
 * Errors/failure modes:
 * - None; invalid children result in no visible tooltip.
 *
 * Side effects:
 * - Manages open/close state and hover/focus tracking.
 *
 * Invariants/assumptions:
 * - Must include a TooltipTrigger and TooltipContent to display content.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM focus and hover events.
 *
 * @example
 * <Tooltip><TooltipTrigger>...</TooltipTrigger><TooltipContent>Info</TooltipContent></Tooltip>
 *
 * @see TooltipTrigger
 * @see TooltipContent
 */
const Tooltip = TooltipPrimitive.Root;
/**
 * TooltipTrigger binds an interactive element to a tooltip instance.
 *
 * @remarks
 * Purpose:
 * - Wires hover/focus events to show the tooltip content.
 *
 * When to use:
 * - Use around a focusable element that needs a tooltip.
 *
 * When not to use:
 * - Do not use on non-focusable elements without adding `tabIndex`.
 *
 * Parameters:
 * - props.asChild: Whether to treat the child as the trigger element (optional).
 * - props.children: Trigger element (required).
 *
 * Return semantics:
 * - Returns a trigger wrapper for the tooltip.
 *
 * Errors/failure modes:
 * - None; if the child is not focusable, keyboard access may be limited.
 *
 * Side effects:
 * - Attaches pointer/keyboard handlers to control tooltip visibility.
 *
 * Invariants/assumptions:
 * - Should be used with a focusable element (button, link, etc.).
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM hover/focus events.
 *
 * @example
 * <TooltipTrigger asChild><button>Info</button></TooltipTrigger>
 *
 * @see Tooltip
 * @see TooltipContent
 */
const TooltipTrigger = TooltipPrimitive.Trigger;
/**
 * TooltipContent renders the floating tooltip panel in a portal.
 *
 * @remarks
 * Purpose:
 * - Displays tooltip text/content in a portal so it is not clipped by overflow containers.
 *
 * When to use:
 * - Use inside {@link Tooltip} to render short helper text.
 *
 * When not to use:
 * - Do not use for persistent content; use inline text or dialogs.
 *
 * Parameters:
 * - props.className: Tailwind class overrides (optional).
 * - props.side: Preferred side to render (optional).
 * - props.align: Alignment relative to trigger (optional).
 * - props.sideOffset: Offset in pixels from the trigger (optional).
 * - props.children: Tooltip content (required).
 *
 * Return semantics:
 * - Returns a portaled tooltip content element.
 *
 * Errors/failure modes:
 * - None; content is hidden when tooltip is closed.
 *
 * Side effects:
 * - Mounts the tooltip content into a portal (document body).
 *
 * Invariants/assumptions:
 * - Must be nested under TooltipProvider and Tooltip.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; renders in a portal.
 *
 * @example
 * <TooltipContent side="top">Details</TooltipContent>
 *
 * @see Tooltip
 * @see TooltipTrigger
 */
const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (_jsx(TooltipPrimitive.Portal, { children: _jsx(TooltipPrimitive.Content, { ref: ref, sideOffset: sideOffset, className: cn("z-50 overflow-hidden rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", className), ...props }) })));
TooltipContent.displayName = "TooltipContent";
export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
