import * as React from "react";
/**
 * Props for {@link NetworkText}.
 *
 * @remarks
 * Purpose:
 * - Configure display of a balance network name and optional logo.
 *
 * When to use:
 * - Use when rendering network identifiers in UI.
 *
 * When not to use:
 * - Do not use for non-React environments.
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
 * - `name` is required and should be human-readable.
 *
 * Data/auth references:
 * - None (presentation only).
 */
export interface NetworkTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    name: string;
    logoUrl?: string | null;
}
/**
 * Renders a network name with an optional logo icon.
 *
 * @remarks
 * Purpose:
 * - Show a network name with an optional logo.
 *
 * When to use:
 * - Use in tables or cards where network labels appear.
 *
 * When not to use:
 * - Do not use when you need a full network selector.
 *
 * Parameters:
 * - `props`: NetworkTextProps. Nullable: no.
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
 * - Logo is sized to text height (1em) and vertically centered.
 *
 * Data/auth references:
 * - None.
 */
export declare function NetworkText({ name, logoUrl, className, ...props }: NetworkTextProps): import("react/jsx-runtime.js").JSX.Element;
