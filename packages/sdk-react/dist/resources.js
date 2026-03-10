import { useEffect, useRef, useState } from "react";
const resourceListeners = new Map();
const freshnessListeners = new Map();
const resourceFreshness = new Map();
const createFreshness = (resource) => ({
    resource,
    lastEventAt: null,
    lastFetchAt: null,
    isStale: false,
    lastSource: null,
    lastHints: null,
});
const getFreshnessMutable = (resource) => {
    const existing = resourceFreshness.get(resource);
    if (existing)
        return existing;
    const created = createFreshness(resource);
    resourceFreshness.set(resource, created);
    return created;
};
const computeStale = (freshness) => {
    if (freshness.lastEventAt === null)
        return false;
    if (freshness.lastFetchAt === null)
        return true;
    return freshness.lastFetchAt < freshness.lastEventAt;
};
const publishFreshness = (resource) => {
    const snapshot = getResourceFreshnessSnapshot(resource);
    const listeners = freshnessListeners.get(resource);
    if (!listeners || listeners.size === 0)
        return;
    for (const listener of listeners) {
        try {
            listener(snapshot);
        }
        catch {
            // Best-effort: ignore listener errors to avoid breaking the caller.
        }
    }
};
const updateFreshnessFromEvent = (resource, event) => {
    const current = getFreshnessMutable(resource);
    current.lastEventAt = event.localEventAt;
    current.lastSource = event.source;
    current.lastHints = event.hints;
    current.isStale = computeStale(current);
};
const updateFreshnessFromFetch = (resource, fetchedAt) => {
    const current = getFreshnessMutable(resource);
    current.lastFetchAt = fetchedAt;
    current.isStale = computeStale(current);
};
/**
 * Emit an SDK resource update for cross-hook refresh.
 *
 * @remarks
 * - Notifies listeners registered via `useResourceInvalidation`.
 * - Errors in listeners are swallowed to avoid cascading failures.
 *
 * @param resource - SDK resource key to invalidate.
 * @param eventInput - Optional event metadata (source, remote timestamp, and hints).
 */
export const emitResourceUpdate = (resource, eventInput) => {
    const event = {
        resource,
        localEventAt: Date.now(),
        remoteEventAt: eventInput?.remoteEventAt ?? null,
        hints: eventInput?.hints ?? null,
        source: eventInput?.source ?? "local",
    };
    updateFreshnessFromEvent(resource, event);
    publishFreshness(resource);
    const listeners = resourceListeners.get(resource);
    if (!listeners || listeners.size === 0)
        return;
    for (const listener of listeners) {
        try {
            listener(event);
        }
        catch {
            // Best-effort: ignore listener errors to avoid breaking the caller.
        }
    }
};
/**
 * Subscribe to SDK resource updates.
 *
 * @remarks
 * - Returns an unsubscribe function to remove the listener.
 *
 * @param resource - SDK resource key to listen for.
 * @param listener - Callback invoked on resource invalidation.
 * @returns Unsubscribe function.
 */
export const subscribeResourceUpdate = (resource, listener) => {
    const existing = resourceListeners.get(resource);
    if (existing) {
        existing.add(listener);
    }
    else {
        resourceListeners.set(resource, new Set([listener]));
    }
    return () => {
        const current = resourceListeners.get(resource);
        if (!current)
            return;
        current.delete(listener);
        if (current.size === 0)
            resourceListeners.delete(resource);
    };
};
/**
 * Get the latest resource freshness snapshot.
 *
 * @param resource - SDK resource key.
 * @returns Freshness snapshot.
 */
export const getResourceFreshnessSnapshot = (resource) => {
    const freshness = getFreshnessMutable(resource);
    return {
        ...freshness,
        lastHints: freshness.lastHints ? { ...freshness.lastHints } : null,
    };
};
/**
 * Subscribe to freshness changes for a resource key.
 *
 * @param resource - SDK resource key.
 * @param listener - Callback fired when freshness changes.
 * @returns Unsubscribe function.
 */
export const subscribeResourceFreshness = (resource, listener) => {
    const existing = freshnessListeners.get(resource);
    if (existing) {
        existing.add(listener);
    }
    else {
        freshnessListeners.set(resource, new Set([listener]));
    }
    return () => {
        const current = freshnessListeners.get(resource);
        if (!current)
            return;
        current.delete(listener);
        if (current.size === 0)
            freshnessListeners.delete(resource);
    };
};
/**
 * Mark a resource fetch completion timestamp.
 *
 * @param resource - SDK resource key that was fetched.
 * @param fetchedAt - Optional fetch completion timestamp in ms.
 */
export const markSDKResourceFetched = (resource, fetchedAt = Date.now()) => {
    updateFreshnessFromFetch(resource, fetchedAt);
    publishFreshness(resource);
};
/**
 * Manually invalidate an SDK resource to prompt refetches.
 *
 * @remarks
 * Purpose:
 * - Emit an invalidation signal for resource-scoped hooks.
 * - Useful when a multi-step UI flow completes and list hooks should refresh.
 * - Keeps app consumers decoupled from transport details (websocket/polling).
 *
 * When to use:
 * - Use after successful mutations to trigger best-effort refreshes.
 *
 * When not to use:
 * - Do not use as a replacement for server-side cache invalidation.
 *
 * Parameters:
 * - resource: SDK resource key to invalidate (string union, required).
 *
 * Return semantics:
 * - Returns void.
 *
 * Errors/failure modes:
 * - None; listener errors are swallowed by the dispatcher.
 *
 * Side effects:
 * - Notifies in-memory listeners registered for the resource.
 *
 * Invariants/assumptions:
 * - Invalidation is best-effort and only affects in-process subscribers.
 *
 * Data/auth references:
 * - None.
 *
 * @example
 * invalidateSDKResource("contacts");
 */
export const invalidateSDKResource = (resource, options) => {
    emitResourceUpdate(resource, options);
};
/**
 * Subscribe to SDK resource invalidations.
 *
 * @remarks
 * Purpose:
 * - Register a handler that runs when a resource is invalidated.
 * - Useful for UI components that manage local state (e.g., balances).
 *
 * When to use:
 * - Use when you need to refresh local state after SDK mutations.
 *
 * When not to use:
 * - Do not use as a persistent cache invalidation mechanism.
 *
 * Parameters:
 * - resource: SDK resource key to listen for (string union, required).
 * - handler: Callback invoked on invalidation (function, required).
 *
 * Return semantics:
 * - Returns void; cleanup is handled on unmount.
 *
 * Errors/failure modes:
 * - None; handler errors are swallowed by the dispatcher.
 *
 * Side effects:
 * - Registers an in-memory listener and removes it on unmount.
 *
 * Invariants/assumptions:
 * - Handler should be idempotent; invalidations may fire multiple times.
 *
 * Data/auth references:
 * - None.
 *
 * @example
 * useResourceInvalidation("balances", () => setRefreshKey((k) => k + 1));
 */
export const useResourceInvalidation = (resource, handler) => {
    const handlerRef = useRef(handler);
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);
    useEffect(() => {
        return subscribeResourceUpdate(resource, (event) => {
            handlerRef.current(event);
        });
    }, [resource]);
};
/**
 * Subscribe to freshness metadata for a specific SDK resource.
 *
 * @param resource - SDK resource key.
 * @returns Freshness metadata (`lastEventAt`, `lastFetchAt`, `isStale`).
 */
export const useSDKResourceFreshness = (resource) => {
    const [freshness, setFreshness] = useState(() => getResourceFreshnessSnapshot(resource));
    useEffect(() => {
        setFreshness(getResourceFreshnessSnapshot(resource));
    }, [resource]);
    useEffect(() => {
        return subscribeResourceFreshness(resource, setFreshness);
    }, [resource]);
    return freshness;
};
