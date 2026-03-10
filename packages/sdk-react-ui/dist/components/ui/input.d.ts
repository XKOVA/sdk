import * as React from "react";
/**
 * Styled input element used across SDK UI components.
 *
 * @remarks
 * Purpose:
 * - Provide a consistent text input styling for forms.
 *
 * When to use:
 * - Use for basic text, number, email, or password inputs.
 *
 * When not to use:
 * - Do not use for select-like inputs; use {@link Select} or {@link SelectMenu}.
 *
 * Parameters:
 * - `props`: React input props. Nullable: per React types.
 * - `ref`: Forwards to the underlying <input> element.
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
 * - Applies SDK styling and forwards `type` unchanged.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR; interactive behavior requires client event handlers.
 */
declare const Input: React.ForwardRefExoticComponent<Omit<React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, "ref"> & React.RefAttributes<HTMLInputElement>>;
export { Input };
