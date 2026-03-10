import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../utils.js";
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
export function NetworkText({ name, logoUrl, className, ...props }) {
    return (_jsxs("span", { className: cn("inline-flex items-center gap-2", className), ...props, children: [logoUrl ? (_jsx("img", { src: logoUrl, alt: `${name} logo`, className: "inline-block h-[1em] w-[1em] shrink-0 rounded-sm object-contain" })) : null, _jsx("span", { children: name })] }));
}
