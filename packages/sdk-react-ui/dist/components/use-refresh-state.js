"use client";
import { useEffect, useRef, useState } from "react";
/**
 * Track initial loading vs refresh states for UI components.
 *
 * @remarks
 * Purpose:
 * - Prevent skeleton flashes on background or manual refresh.
 *
 * When to use:
 * - Use when you have an `isLoading` flag but want skeletons only for the first load.
 *
 * Parameters:
 * - `isLoading`: Loading flag from a data hook.
 * - `hasData`: Optional signal that there is already renderable data.
 *
 * Return semantics:
 * - Returns `{ hasLoaded, isInitialLoading, isRefreshing }`.
 *
 * Invariants/assumptions:
 * - `isInitialLoading` is true only before the first completed load.
 * - `isRefreshing` is true when loading after at least one completed load.
 */
export function useRefreshState(isLoading, hasData = false) {
    const [hasLoaded, setHasLoaded] = useState(Boolean(hasData));
    const prevLoadingRef = useRef(isLoading);
    useEffect(() => {
        if (hasData) {
            setHasLoaded(true);
        }
    }, [hasData]);
    useEffect(() => {
        if (prevLoadingRef.current && !isLoading) {
            setHasLoaded(true);
        }
        prevLoadingRef.current = isLoading;
    }, [isLoading]);
    const isInitialLoading = isLoading && !hasLoaded;
    const isRefreshing = isLoading && hasLoaded;
    return { hasLoaded, isInitialLoading, isRefreshing };
}
