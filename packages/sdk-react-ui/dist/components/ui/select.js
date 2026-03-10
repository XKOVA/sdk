import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "../../utils.js";
/**
 * Render a styled native select element.
 *
 * @remarks
 * Purpose:
 * - Provide consistent styling for basic selects.
 *
 * When to use:
 * - Use when native keyboard/mouse behavior is sufficient.
 *
 * When not to use:
 * - Do not use when you need a searchable or grouped menu; use {@link SelectMenu}.
 *
 * Parameters:
 * - `props`: {@link SelectProps}. Nullable: no.
 * - `ref`: Forwards to the underlying <select> element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Applies SDK styling classes and passes through native attributes.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR; interactive behavior requires client event handlers.
 */
export const Select = React.forwardRef(({ className, children, ...props }, ref) => (_jsx("select", { ref: ref, className: cn("flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm", "ring-offset-background", "focus:outline-none focus:ring-1 focus:ring-ring", "disabled:cursor-not-allowed disabled:opacity-50", "[&>span]:line-clamp-1", className), ...props, children: children })));
Select.displayName = "Select";
