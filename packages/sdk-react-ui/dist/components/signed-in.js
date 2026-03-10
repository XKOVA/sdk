"use client";
import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useAuth } from "@xkova/sdk-react";
/**
 * Guard that renders children only when authenticated.
 *
 * @remarks
 * Purpose:
 * - Render authenticated-only UI based on sdk-react auth state.
 *
 * When to use:
 * - Use to conditionally display content for signed-in users.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `children`: Content rendered when authenticated. Nullable: no.
 * - `fallback`: Optional content rendered when not authenticated. Nullable: yes.
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
export const SignedIn = ({ children, fallback }) => {
    const { status } = useAuth();
    if (status === "authenticated")
        return _jsx(_Fragment, { children: children });
    return _jsx(_Fragment, { children: fallback ?? null });
};
