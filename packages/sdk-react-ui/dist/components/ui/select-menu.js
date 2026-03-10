"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "../../utils.js";
/**
 * Root select menu component based on Radix Select.
 *
 * @remarks
 * Purpose:
 * - Provide a customizable select menu with keyboard support.
 *
 * When to use:
 * - Use when you need styled select menus with custom content.
 *
 * When not to use:
 * - Do not use for simple native selects; use {@link Select} instead.
 *
 * Parameters:
 * - `props`: Radix Select Root props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a Radix Select root element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Manages open state and keyboard navigation.
 *
 * Invariants/assumptions:
 * - Should include trigger, value, and content elements.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM portals and events.
 */
function SelectMenu(props) {
    return _jsx(SelectPrimitive.Root, { ...props });
}
/**
 * Group wrapper for related select menu items.
 *
 * @remarks
 * Purpose:
 * - Provide grouping semantics within a select menu.
 *
 * When to use:
 * - Use to group items under a shared label.
 *
 * When not to use:
 * - Do not use if the menu does not require grouping.
 *
 * Parameters:
 * - `props`: Radix Select Group props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a group wrapper element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Should be used with {@link SelectMenuLabel} and {@link SelectMenuItem}.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events.
 */
function SelectMenuGroup(props) {
    return _jsx(SelectPrimitive.Group, { ...props });
}
/**
 * Displayed value element for the select menu.
 *
 * @remarks
 * Purpose:
 * - Render the selected value inside the trigger.
 *
 * When to use:
 * - Use inside {@link SelectMenuTrigger}.
 *
 * When not to use:
 * - Do not use outside a {@link SelectMenu} root.
 *
 * Parameters:
 * - `props`: Radix Select Value props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a value display element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Must be within a {@link SelectMenuTrigger}.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM.
 */
function SelectMenuValue(props) {
    return _jsx(SelectPrimitive.Value, { ...props });
}
/**
 * Trigger element that opens the select menu.
 *
 * @remarks
 * Purpose:
 * - Provide an interactive control to open the select menu.
 *
 * When to use:
 * - Use as the clickable trigger for {@link SelectMenu}.
 *
 * When not to use:
 * - Do not use outside a {@link SelectMenu} root.
 *
 * Parameters:
 * - `props`: Radix Select Trigger props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a trigger element with a down-chevron icon.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Attaches event handlers for open/close behavior.
 *
 * Invariants/assumptions:
 * - Should wrap {@link SelectMenuValue}.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events.
 */
function SelectMenuTrigger({ className, children, ...props }) {
    return (_jsxs(SelectPrimitive.Trigger, { className: cn("flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background", "focus:outline-none focus:ring-1 focus:ring-ring", "disabled:cursor-not-allowed disabled:opacity-50", "[&>span]:line-clamp-1", className), ...props, children: [children, _jsx(SelectPrimitive.Icon, { asChild: true, children: _jsx(ChevronDownIcon, { className: "h-4 w-4 opacity-50" }) })] }));
}
/**
 * Content panel that renders select menu items in a portal.
 *
 * @remarks
 * Purpose:
 * - Render the dropdown list with scrolling and positioning.
 *
 * When to use:
 * - Use inside {@link SelectMenu} alongside a trigger.
 *
 * When not to use:
 * - Do not use outside a {@link SelectMenu} root.
 *
 * Parameters:
 * - `props`: Radix Select Content props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a portal-rendered content panel.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Uses a portal to render outside normal layout flow.
 *
 * Invariants/assumptions:
 * - Includes built-in scroll buttons and viewport sizing.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM portals and events.
 */
function SelectMenuContent({ className, children, position = "popper", ...props }) {
    return (_jsx(SelectPrimitive.Portal, { children: _jsxs(SelectPrimitive.Content, { className: cn("relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", position === "popper" &&
                "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", className), position: position, ...props, children: [_jsx(SelectMenuScrollUpButton, {}), _jsx(SelectPrimitive.Viewport, { className: cn("p-1", position === "popper" &&
                        "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"), children: children }), _jsx(SelectMenuScrollDownButton, {})] }) }));
}
/**
 * Label element for grouped select menu items.
 *
 * @remarks
 * Purpose:
 * - Provide a visual label for a group of items.
 *
 * When to use:
 * - Use inside {@link SelectMenuGroup} above its items.
 *
 * When not to use:
 * - Do not use outside a select menu group.
 *
 * Parameters:
 * - `props`: Radix Select Label props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a label element with consistent typography.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Intended for grouping, not for selectable items.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM.
 */
function SelectMenuLabel({ className, ...props }) {
    return _jsx(SelectPrimitive.Label, { className: cn("px-2 py-1.5 text-sm font-semibold", className), ...props });
}
/**
 * Select menu item for a single selectable option.
 *
 * @remarks
 * Purpose:
 * - Render an option with checkmark indicator and keyboard support.
 *
 * When to use:
 * - Use within {@link SelectMenuContent} for each option.
 *
 * When not to use:
 * - Do not use for non-selectable headers; use {@link SelectMenuLabel}.
 *
 * Parameters:
 * - `props`: Radix Select Item props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a selectable item element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Handles selection and focus state via Radix.
 *
 * Invariants/assumptions:
 * - Renders an item indicator for the selected option.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events.
 */
function SelectMenuItem({ className, children, ...props }) {
    return (_jsxs(SelectPrimitive.Item, { className: cn("relative flex w-full cursor-default items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none", "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className), ...props, children: [_jsx("span", { className: "absolute right-2 flex h-3.5 w-3.5 items-center justify-center", children: _jsx(SelectPrimitive.ItemIndicator, { children: _jsx(CheckIcon, { className: "h-4 w-4" }) }) }), _jsx(SelectPrimitive.ItemText, { children: children })] }));
}
/**
 * Separator element for dividing groups in the select menu.
 *
 * @remarks
 * Purpose:
 * - Visually separate groups of items.
 *
 * When to use:
 * - Use between item groups inside {@link SelectMenuContent}.
 *
 * When not to use:
 * - Do not use as a replacement for labels; use {@link SelectMenuLabel}.
 *
 * Parameters:
 * - `props`: Radix Select Separator props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a separator element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Renders a horizontal hairline separator.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM.
 */
function SelectMenuSeparator({ className, ...props }) {
    return _jsx(SelectPrimitive.Separator, { className: cn("-mx-1 my-1 h-px bg-muted", className), ...props });
}
function SelectMenuScrollUpButton({ className, ...props }) {
    return (_jsx(SelectPrimitive.ScrollUpButton, { className: cn("flex cursor-default items-center justify-center py-1", className), ...props, children: _jsx(ChevronUpIcon, { className: "h-4 w-4" }) }));
}
function SelectMenuScrollDownButton({ className, ...props }) {
    return (_jsx(SelectPrimitive.ScrollDownButton, { className: cn("flex cursor-default items-center justify-center py-1", className), ...props, children: _jsx(ChevronDownIcon, { className: "h-4 w-4" }) }));
}
export { SelectMenu, SelectMenuGroup, SelectMenuValue, SelectMenuTrigger, SelectMenuContent, SelectMenuLabel, SelectMenuItem, SelectMenuSeparator, };
