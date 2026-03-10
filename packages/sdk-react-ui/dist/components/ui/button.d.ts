import * as React from "react";
import { type VariantProps } from "class-variance-authority";
/**
 * Variant class generator for {@link Button}.
 *
 * @remarks
 * Purpose:
 * - Provide consistent Tailwind classes for button variants and sizes.
 *
 * When to use:
 * - Use when composing custom button wrappers or alternate elements.
 *
 * When not to use:
 * - Do not use as a general class generator outside button-like elements.
 *
 * Parameters:
 * - `options`: Variant options (optional).
 *
 * Return semantics:
 * - Returns a className string for the selected variant and size.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Variant and size keys are limited to the configured options.
 *
 * Data/auth references:
 * - None.
 */
declare const buttonVariants: (props?: ({
    variant?: "link" | "default" | "destructive" | "outline" | "secondary" | "ghost" | null | undefined;
    size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | null | undefined;
} & import("class-variance-authority/dist/types.js").ClassProp) | undefined) => string;
/**
 * Props for {@link Button}.
 *
 * @remarks
 * Purpose:
 * - Configure button styling, size, and HTML attributes.
 *
 * When to use:
 * - Use for primary and secondary actions in the UI.
 *
 * When not to use:
 * - Do not use when a link element is semantically required; use an <a>.
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
 * - `variant` and `size` match the configured options in {@link buttonVariants}.
 *
 * Data/auth references:
 * - None.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
}
/**
 * Render a styled button with variant and size support.
 *
 * @remarks
 * Purpose:
 * - Provide a consistent button component with accessible focus styles.
 *
 * When to use:
 * - Use for clickable actions, form submits, or toolbar controls.
 *
 * When not to use:
 * - Do not use for purely decorative elements; use a <div> or <span> instead.
 *
 * Parameters:
 * - `props`: {@link ButtonProps}. Nullable: no.
 * - `ref`: Forwards to the underlying <button> element.
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
 * - Defaults to `type="button"` to avoid accidental form submission.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR; interactive behavior requires client event handlers.
 */
declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
export { Button, buttonVariants };
