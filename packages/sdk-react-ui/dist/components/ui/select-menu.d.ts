import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
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
declare function SelectMenu(props: React.ComponentProps<typeof SelectPrimitive.Root>): import("react/jsx-runtime.js").JSX.Element;
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
declare function SelectMenuGroup(props: React.ComponentProps<typeof SelectPrimitive.Group>): import("react/jsx-runtime.js").JSX.Element;
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
declare function SelectMenuValue(props: React.ComponentProps<typeof SelectPrimitive.Value>): import("react/jsx-runtime.js").JSX.Element;
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
declare function SelectMenuTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>): import("react/jsx-runtime.js").JSX.Element;
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
declare function SelectMenuContent({ className, children, position, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>): import("react/jsx-runtime.js").JSX.Element;
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
declare function SelectMenuLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>): import("react/jsx-runtime.js").JSX.Element;
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
declare function SelectMenuItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>): import("react/jsx-runtime.js").JSX.Element;
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
declare function SelectMenuSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>): import("react/jsx-runtime.js").JSX.Element;
export { SelectMenu, SelectMenuGroup, SelectMenuValue, SelectMenuTrigger, SelectMenuContent, SelectMenuLabel, SelectMenuItem, SelectMenuSeparator, };
