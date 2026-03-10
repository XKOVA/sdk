import * as React from "react";
/**
 * Props for {@link CardHeaderRow}.
 *
 * @remarks
 * Purpose:
 * - Provide a standard title/description/actions layout for card headers.
 *
 * When to use:
 * - Use when a card needs a left-aligned title and right-aligned actions.
 *
 * When not to use:
 * - Do not use for highly customized header layouts; compose your own markup instead.
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
 * - `title` is required; description and actions are optional.
 *
 * Data/auth references:
 * - None.
 */
export interface CardHeaderRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
}
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
export declare function CardHeaderRow({ title, description, actions, className, ...props }: CardHeaderRowProps): import("react/jsx-runtime.js").JSX.Element;
/**
 * Props for {@link CardSectionLabel}.
 *
 * @remarks
 * Purpose:
 * - Configure the micro-label used for card section headings.
 *
 * When to use:
 * - Use to label sections within a card (e.g. "Details", "Activity").
 *
 * When not to use:
 * - Do not use as a primary heading; use a card title instead.
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
 * - `as` controls the rendered element (div or span).
 *
 * Data/auth references:
 * - None.
 */
export interface CardSectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
    as?: "div" | "span";
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
export declare function CardSectionLabel({ as, className, ...props }: CardSectionLabelProps): import("react/jsx-runtime.js").JSX.Element;
/**
 * Props for {@link CardEmptyState}.
 *
 * @remarks
 * Purpose:
 * - Configure the empty-state presentation for cards.
 *
 * When to use:
 * - Use when a card has no data to display.
 *
 * When not to use:
 * - Do not use for loading states; use {@link Skeleton} instead.
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
 * - Renders muted text centered within the card section.
 *
 * Data/auth references:
 * - None.
 */
export interface CardEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
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
export declare function CardEmptyState({ className, ...props }: CardEmptyStateProps): import("react/jsx-runtime.js").JSX.Element;
/**
 * Props for {@link CardValue}.
 *
 * @remarks
 * Purpose:
 * - Control typography for emphasized or secondary values in cards.
 *
 * When to use:
 * - Use for balances, metrics, or key figures within a card.
 *
 * When not to use:
 * - Do not use for multiline prose or explanatory copy.
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
 * - `variant` must be "primary" or "secondary".
 *
 * Data/auth references:
 * - None.
 */
export interface CardValueProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Render as emphasized primary value. */
    variant?: "primary" | "secondary";
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
export declare function CardValue({ variant, className, ...props }: CardValueProps): import("react/jsx-runtime.js").JSX.Element;
