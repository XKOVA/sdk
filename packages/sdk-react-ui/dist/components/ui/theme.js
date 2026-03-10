"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../../utils.js";
/**
 * Wrap SDK UI so shadcn-style CSS variables are defined without requiring the host app
 * to adopt a global theme. Pair with `@xkova/sdk-react-ui/styles.css`.
 *
 * @remarks
 * Purpose:
 * - Apply SDK UI theme classes and scope CSS variables.
 *
 * When to use:
 * - Use once at the root of your SDK UI subtree.
 *
 * When not to use:
 * - Do not wrap multiple times unless you need nested theme scopes.
 *
 * Parameters:
 * - `children`: React children rendered within the theme wrapper. Nullable: no.
 * - `mode`: Theme mode ("light" | "dark"). Nullable: yes.
 * - `className`: Optional className override. Nullable: yes.
 * - `style`: Optional style override. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element that wraps children.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Sets theme-related class names on a wrapper element.
 *
 * Invariants/assumptions:
 * - Requires `@xkova/sdk-react-ui/styles.css` for full theme variables.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client component.
 */
export const XKOVATheme = ({ children, mode = "light", className, style, }) => {
    return (_jsx("div", { className: cn("xkova-theme", mode === "dark" ? "dark" : "", className), style: style, children: children }));
};
