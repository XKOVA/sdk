import * as React from "react";
import { cn } from "../../utils.js";

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
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
