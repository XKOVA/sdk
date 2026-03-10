import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../utils.js";
/**
 * Header row layout for cards with title/description and optional actions.
 *
 * @remarks
 * Purpose:
 * - Aligns title/description on the left and keeps actions pinned top-right (including on mobile).
 *
 * When to use:
 * - Use inside a card header area for consistent spacing.
 *
 * When not to use:
 * - Do not use when header content needs a custom grid or non-standard layout.
 *
 * Parameters:
 * - `props`: {@link CardHeaderRowProps}. Nullable: no.
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
 * - Actions stay top-right; action content should handle its own wrapping if needed.
 *
 * Data/auth references:
 * - None.
 */
export function CardHeaderRow({ title, description, actions, className, ...props }) {
    return (_jsxs("div", { className: cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2", className), ...props, children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "min-w-0", children: title }), description ? _jsx("div", { className: "mt-1", children: description }) : null] }), actions ? _jsx("div", { className: "shrink-0 max-w-full justify-self-end", children: actions }) : null] }));
}
/**
 * Standard micro-label for card section headers.
 *
 * @remarks
 * Purpose:
 * - Provide consistent typography for small section headings.
 *
 * When to use:
 * - Use within cards to separate or annotate subsections.
 *
 * When not to use:
 * - Do not use for long-form body text.
 *
 * Parameters:
 * - `props`: {@link CardSectionLabelProps}. Nullable: no.
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
 * - Text is rendered uppercase with tracking for emphasis.
 *
 * Data/auth references:
 * - None.
 */
export function CardSectionLabel({ as = "div", className, ...props }) {
    const Comp = as;
    return _jsx(Comp, { className: cn("text-xs text-muted-foreground uppercase tracking-wide", className), ...props });
}
/**
 * Empty-state styling for card sections.
 *
 * @remarks
 * Purpose:
 * - Provide a consistent empty-state message presentation.
 *
 * When to use:
 * - Use when an optional dataset is empty.
 *
 * When not to use:
 * - Do not use for errors; show an error banner instead.
 *
 * Parameters:
 * - `props`: {@link CardEmptyStateProps}. Nullable: no.
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
 * - Text is centered with muted styling.
 *
 * Data/auth references:
 * - None.
 */
export function CardEmptyState({ className, ...props }) {
    return _jsx("div", { className: cn("text-sm text-muted-foreground py-4 text-center", className), ...props });
}
/**
 * Value styling for key numbers or metrics in cards.
 *
 * @remarks
 * Purpose:
 * - Render numeric values with consistent size and weight.
 *
 * When to use:
 * - Use for primary balances or secondary supporting values.
 *
 * When not to use:
 * - Do not use for interactive elements; use buttons or links instead.
 *
 * Parameters:
 * - `props`: {@link CardValueProps}. Nullable: no.
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
 * - Primary values render larger than secondary values.
 *
 * Data/auth references:
 * - None.
 */
export function CardValue({ variant = "primary", className, ...props }) {
    return (_jsx("div", { className: cn(variant === "primary" ? "text-3xl font-semibold tracking-tight" : "text-sm font-medium", className), ...props }));
}
