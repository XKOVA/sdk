import * as React from "react";
import { type VariantProps } from "class-variance-authority";
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
declare const Label: React.ForwardRefExoticComponent<React.LabelHTMLAttributes<HTMLLabelElement> & VariantProps<(props?: import("class-variance-authority/dist/types.js").ClassProp | undefined) => string> & React.RefAttributes<HTMLLabelElement>>;
export { Label };
