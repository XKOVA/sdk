import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../../utils.js";
/**
 * Skeleton placeholder for loading states.
 *
 * @remarks
 * Purpose:
 * - Render a pulsing placeholder while content is loading.
 *
 * When to use:
 * - Use for async data surfaces to reduce layout shift.
 *
 * When not to use:
 * - Do not use to represent errors; use an error message or banner.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
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
 * - Uses an animate-pulse background for visual loading feedback.
 *
 * Data/auth references:
 * - None.
 */
function Skeleton({ className, ...props }) {
    return (_jsx("div", { className: cn("animate-pulse rounded-md bg-primary/10", className), ...props }));
}
export { Skeleton };
