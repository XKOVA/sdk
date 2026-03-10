import * as React from "react";
import { cn } from "../../utils.js";

/**
 * Card container component with border, background, and shadow.
 *
 * @remarks
 * Purpose:
 * - Provide the base visual surface for SDK cards.
 *
 * When to use:
 * - Use as the outer wrapper for card layouts and sections.
 *
 * When not to use:
 * - Do not use when you need a purely invisible layout wrapper.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <div> element.
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
 * - Applies card background, border, and shadow classes.
 *
 * Data/auth references:
 * - None.
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
        className
      )}
      {...props}
    />
));
Card.displayName = "Card";

/**
 * Card header wrapper for titles and actions.
 *
 * @remarks
 * Purpose:
 * - Provide consistent padding and vertical spacing for card headers.
 *
 * When to use:
 * - Use at the top of a card to contain headings and actions.
 *
 * When not to use:
 * - Do not use for full-width content sections; use {@link CardContent}.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <div> element.
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
 * - Uses standard header padding.
 *
 * Data/auth references:
 * - None.
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/**
 * Card title element with emphasis styling.
 *
 * @remarks
 * Purpose:
 * - Render a heading within a card header.
 *
 * When to use:
 * - Use inside {@link CardHeader} for the primary title.
 *
 * When not to use:
 * - Do not use for long-form body text.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <div> element.
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
 * - Applies font weight and tracking for headings.
 *
 * Data/auth references:
 * - None.
 */
const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/**
 * Card description element for supporting text.
 *
 * @remarks
 * Purpose:
 * - Provide secondary text under a card title.
 *
 * When to use:
 * - Use inside {@link CardHeader} below {@link CardTitle}.
 *
 * When not to use:
 * - Do not use for primary copy or long paragraphs.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <div> element.
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
 * - Uses muted foreground styling.
 *
 * Data/auth references:
 * - None.
 */
const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/**
 * Card content section with standard padding.
 *
 * @remarks
 * Purpose:
 * - Provide the main content container within a card.
 *
 * When to use:
 * - Use for primary content blocks or lists within a card.
 *
 * When not to use:
 * - Do not use for headers or footers; use {@link CardHeader} or {@link CardFooter}.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <div> element.
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
 * - Applies standard padding and spacing rules.
 *
 * Data/auth references:
 * - None.
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

/**
 * Card footer section for actions or summary content.
 *
 * @remarks
 * Purpose:
 * - Provide consistent layout and padding for footer actions.
 *
 * When to use:
 * - Use at the bottom of a card for buttons or totals.
 *
 * When not to use:
 * - Do not use for the main content area; use {@link CardContent}.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <div> element.
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
 * - Aligns items horizontally by default.
 *
 * Data/auth references:
 * - None.
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
