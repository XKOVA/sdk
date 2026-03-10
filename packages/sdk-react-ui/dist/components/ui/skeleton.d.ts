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
declare function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime.js").JSX.Element;
export { Skeleton };
