import { useCallback, useMemo } from "react";
import { resolveHostedHandleChangeUrl } from "@xkova/sdk-core";
import { useTenantConfig } from "./tenant.js";
/**
 * Hosted handle-change launcher.
 *
 * @remarks
 * Purpose:
 * - Provide a simple client-side entry point to the hosted handle-change page.
 *
 * When to use:
 * - Use when you want to send users to the XKOVA-hosted handle-change UI.
 *
 * When not to use:
 * - Do not use on the server; this hook triggers browser navigation.
 *
 * Parameters:
 * - `options.returnTo`: Optional return URL (passed as `return_to`).
 * - `options.onError`: Optional error callback.
 *
 * Return semantics:
 * - Returns `{ url, launch, isAvailable }`.
 *
 * Errors/failure modes:
 * - `launch` throws when authDomain is missing or during SSR (unless onError handles it).
 *
 * Side effects:
 * - Navigates the browser to the hosted handle-change page.
 *
 * Invariants/assumptions:
 * - Requires tenant authDomain from bootstrap.
 */
export const useHostedHandleChange = (options) => {
    const { tenant } = useTenantConfig();
    const returnTo = options?.returnTo;
    const onError = options?.onError;
    const authDomain = tenant?.authDomain ?? tenant?.auth_domain ?? null;
    const defaultProtocol = typeof window !== "undefined" && (window.location?.protocol ?? "").length > 0
        ? window.location.protocol
        : undefined;
    const url = useMemo(() => {
        if (!authDomain)
            return null;
        try {
            return resolveHostedHandleChangeUrl({
                authDomain,
                returnTo: returnTo ?? null,
                defaultProtocol,
            });
        }
        catch {
            return null;
        }
    }, [authDomain, returnTo, defaultProtocol]);
    const launch = useCallback((override) => {
        try {
            if (!authDomain) {
                throw new Error("Tenant authDomain is not configured.");
            }
            const target = resolveHostedHandleChangeUrl({
                authDomain,
                returnTo: override?.returnTo ?? returnTo ?? null,
                defaultProtocol,
            });
            if (typeof window === "undefined") {
                throw new Error("Cannot redirect during server-side rendering. Use client-side navigation.");
            }
            window.location.assign(target);
        }
        catch (err) {
            if (onError) {
                onError(err);
                return;
            }
            throw err;
        }
    }, [authDomain, defaultProtocol, onError, returnTo]);
    return { url, launch, isAvailable: Boolean(url) };
};
