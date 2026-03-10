import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../utils.js";
const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");
/**
 * Form label component with consistent typography.
 *
 * @remarks
 * Purpose:
 * - Provide accessible label styling for form controls.
 *
 * When to use:
 * - Use alongside inputs, selects, and other form fields.
 *
 * When not to use:
 * - Do not use as a general text element; use <span> or <p>.
 *
 * Parameters:
 * - `props`: React label attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <label> element.
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
 * - Works with `htmlFor` or wraps the target input element.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR; interactive behavior requires client event handlers.
 */
const Label = React.forwardRef(({ className, ...props }, ref) => (_jsx("label", { ref: ref, className: cn(labelVariants(), className), ...props })));
Label.displayName = "Label";
export { Label };
