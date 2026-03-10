import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from "class-variance-authority";
import { cn } from "../../utils.js";
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
const badgeVariants = cva("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
    variants: {
        variant: {
            default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
            secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
            success: "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
            warn: "border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
            destructive: "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20",
            outline: "text-foreground",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
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
function Badge({ className, variant, ...props }) {
    return (_jsx("div", { className: cn(badgeVariants({ variant }), className), ...props }));
}
export { Badge, badgeVariants };
