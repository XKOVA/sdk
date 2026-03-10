import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils.js";

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
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

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
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

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
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // Default to type="button" so buttons used inside forms don't accidentally submit.
        type={type ?? "button"}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
