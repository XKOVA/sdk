import * as React from "react";
/**
 * Theme mode selector for sdk-react-ui.
 *
 * @remarks
 * Purpose:
 * - Represent supported theme modes for the SDK UI wrapper.
 *
 * When to use:
 * - Use when configuring the `XKOVATheme` wrapper.
 *
 * When not to use:
 * - Do not invent new values; only "light" and "dark" are supported.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - None.
 */
export type XKOVAThemeMode = "light" | "dark";
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
export declare const XKOVATheme: ({ children, mode, className, style, }: {
    children: React.ReactNode;
    mode?: XKOVAThemeMode;
    className?: string;
    style?: React.CSSProperties;
}) => import("react/jsx-runtime.js").JSX.Element;
