"use client";
import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useAuth } from "@xkova/sdk-react";
/**
 * Guard that renders children only when signed out.
 *
 * @remarks
 * Purpose:
 * - Render signed-out UI based on sdk-react auth state.
 *
 * When to use:
 * - Use to display login prompts or public content.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `children`: Content rendered when unauthenticated. Nullable: no.
 *
 * Return semantics:
 * - Returns a React element or null.
 *
 * Errors/failure modes:
 * - None; relies on useAuth state.
 *
 * Side effects:
 * - Reads auth state from useAuth.
 *
 * Invariants/assumptions:
 * - Requires XKOVAProvider in the React tree.
 *
 * Data/auth references:
 * - Uses sdk-react auth state derived from OAuth bootstrap.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 */
export const SignedOut = ({ children }) => {
    const { status } = useAuth();
    if (status === "unauthenticated" || status === "error")
        return _jsx(_Fragment, { children: children });
    return null;
};
