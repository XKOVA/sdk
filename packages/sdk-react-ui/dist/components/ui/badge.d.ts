import * as React from "react";
import { type VariantProps } from "class-variance-authority";
/**
 * Variant class generator for {@link Badge}.
 *
 * @remarks
 * Purpose:
 * - Provide consistent Tailwind classes for badge variants.
 *
 * When to use:
 * - Use when building custom wrappers or extending badge styling.
 *
 * When not to use:
 * - Do not use for arbitrary theming beyond the supported variants.
 *
 * Parameters:
 * - `options`: Variant options (optional).
 *
 * Return semantics:
 * - Returns a className string based on the selected variant.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Variant keys match the configured `variant` options.
 *
 * Data/auth references:
 * - None.
 */
declare const badgeVariants: (props?: ({
    variant?: "default" | "destructive" | "outline" | "secondary" | "success" | "warn" | null | undefined;
} & import("class-variance-authority/dist/types.js").ClassProp) | undefined) => string;
/**
 * Props for {@link Badge}.
 *
 * @remarks
 * Purpose:
 * - Control badge styling and HTML attributes.
 *
 * When to use:
 * - Use for short status or category labels.
 *
 * When not to use:
 * - Do not use for interactive actions; use {@link Button} instead.
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
 * - `variant` matches an entry in {@link badgeVariants}.
 *
 * Data/auth references:
 * - None.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
}
/**
 * Render a styled badge for status or categorization.
 *
 * @remarks
 * Purpose:
 * - Provide a compact visual label with consistent variants.
 *
 * When to use:
 * - Use for statuses, tags, or small highlights.
 *
 * When not to use:
 * - Do not use as a button or link; it is non-interactive by default.
 *
 * Parameters:
 * - `props`: {@link BadgeProps}. Nullable: no.
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
 * - Badge renders as a <div> with inline-flex styling.
 *
 * Data/auth references:
 * - None.
 */
declare function Badge({ className, variant, ...props }: BadgeProps): import("react/jsx-runtime.js").JSX.Element;
export { Badge, badgeVariants };
