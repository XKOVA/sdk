import * as React from "react";
/**
 * Props for {@link Select}.
 *
 * @remarks
 * Purpose:
 * - Configure a styled native select element.
 *
 * When to use:
 * - Use for small option lists where native select behavior is desired.
 *
 * When not to use:
 * - Do not use when you need complex templated options; use {@link SelectMenu}.
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
 * - Children should be valid <option> elements.
 *
 * Data/auth references:
 * - None.
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
}
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
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;
