import { useEffect, useRef, useState } from "react";

/**
 * SDK resource identifiers used for cross-hook invalidation.
 *
 * @remarks
 * Purpose:
 * - Provide a shared set of keys for invalidating related hook data.
 * - Define the canonical bridge contract between realtime transport events and SDK hooks.
 *
 * When to use:
 * - Use with invalidateSDKResource or useResourceInvalidation to coordinate refreshes.
 *
 * When not to use:
 * - Do not invent custom strings; use the union values defined here.
 * - Do not bind app-specific websocket payload names directly in app code.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - String literal union only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Captures RPC errors in `error` and returns an empty balance list.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Keys map to SDK hook domains (contacts, payments, etc.).
 * - Transport-to-resource mapping is implemented in `XKOVAProvider`.
 * - Resource-key additions must be coordinated with provider event mapping and hook subscriptions.
 *
 * Data/auth references:
 * - None.
 */
export type SDKResource =
  | "account"
  | "contacts"
  | "payments"
  | "payment-requests"
  | "transfers"
  | "transactions"
  | "agent-installations"
  | "sessions"
  | "balances";

/**
 * Resource invalidation event payload delivered to SDK listeners.
 */
export type SDKResourceInvalidationEvent = {
  resource: SDKResource;
  localEventAt: number;
  remoteEventAt: number | null;
  hints: Record<string, unknown> | null;
  source: string;
};

/**
 * Freshness snapshot for a single SDK resource key.
 */
export type SDKResourceFreshness = {
  resource: SDKResource;
  lastEventAt: number | null;
  lastFetchAt: number | null;
  isStale: boolean;
  lastSource: string | null;
  lastHints: Record<string, unknown> | null;
};

type SDKResourceListener = (event?: SDKResourceInvalidationEvent) => void;
type SDKResourceFreshnessListener = (freshness: SDKResourceFreshness) => void;

const resourceListeners = new Map<SDKResource, Set<SDKResourceListener>>();
const freshnessListeners = new Map<
  SDKResource,
  Set<SDKResourceFreshnessListener>
>();
const resourceFreshness = new Map<SDKResource, SDKResourceFreshness>();

const createFreshness = (resource: SDKResource): SDKResourceFreshness => ({
  resource,
  lastEventAt: null,
  lastFetchAt: null,
  isStale: false,
  lastSource: null,
  lastHints: null,
});

const getFreshnessMutable = (resource: SDKResource): SDKResourceFreshness => {
  const existing = resourceFreshness.get(resource);
  if (existing) return existing;
  const created = createFreshness(resource);
  resourceFreshness.set(resource, created);
  return created;
};

const computeStale = (freshness: SDKResourceFreshness): boolean => {
  if (freshness.lastEventAt === null) return false;
  if (freshness.lastFetchAt === null) return true;
  return freshness.lastFetchAt < freshness.lastEventAt;
};

const publishFreshness = (resource: SDKResource) => {
  const snapshot = getResourceFreshnessSnapshot(resource);
  const listeners = freshnessListeners.get(resource);
  if (!listeners || listeners.size === 0) return;
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // Best-effort: ignore listener errors to avoid breaking the caller.
    }
  }
};

const updateFreshnessFromEvent = (
  resource: SDKResource,
  event: SDKResourceInvalidationEvent,
) => {
  const current = getFreshnessMutable(resource);
  current.lastEventAt = event.localEventAt;
  current.lastSource = event.source;
  current.lastHints = event.hints;
  current.isStale = computeStale(current);
};

const updateFreshnessFromFetch = (resource: SDKResource, fetchedAt: number) => {
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
export const emitResourceUpdate = (
  resource: SDKResource,
  eventInput?: {
    source?: string;
    remoteEventAt?: number | null;
    hints?: Record<string, unknown> | null;
  },
) => {
  const event: SDKResourceInvalidationEvent = {
    resource,
    localEventAt: Date.now(),
    remoteEventAt: eventInput?.remoteEventAt ?? null,
    hints: eventInput?.hints ?? null,
    source: eventInput?.source ?? "local",
  };
  updateFreshnessFromEvent(resource, event);
  publishFreshness(resource);

  const listeners = resourceListeners.get(resource);
  if (!listeners || listeners.size === 0) return;
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
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
export const subscribeResourceUpdate = (resource: SDKResource, listener: SDKResourceListener) => {
  const existing = resourceListeners.get(resource);
  if (existing) {
    existing.add(listener);
  } else {
    resourceListeners.set(resource, new Set([listener]));
  }

  return () => {
    const current = resourceListeners.get(resource);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) resourceListeners.delete(resource);
  };
};

/**
 * Get the latest resource freshness snapshot.
 *
 * @param resource - SDK resource key.
 * @returns Freshness snapshot.
 */
export const getResourceFreshnessSnapshot = (
  resource: SDKResource,
): SDKResourceFreshness => {
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
export const subscribeResourceFreshness = (
  resource: SDKResource,
  listener: SDKResourceFreshnessListener,
) => {
  const existing = freshnessListeners.get(resource);
  if (existing) {
    existing.add(listener);
  } else {
    freshnessListeners.set(resource, new Set([listener]));
  }

  return () => {
    const current = freshnessListeners.get(resource);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) freshnessListeners.delete(resource);
  };
};

/**
 * Mark a resource fetch completion timestamp.
 *
 * @param resource - SDK resource key that was fetched.
 * @param fetchedAt - Optional fetch completion timestamp in ms.
 */
export const markSDKResourceFetched = (
  resource: SDKResource,
  fetchedAt: number = Date.now(),
) => {
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
export const invalidateSDKResource = (
  resource: SDKResource,
  options?: {
    source?: string;
    remoteEventAt?: number | null;
    hints?: Record<string, unknown> | null;
  },
) => {
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
export const useResourceInvalidation = (
  resource: SDKResource,
  handler: (event?: SDKResourceInvalidationEvent) => void,
) => {
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
export const useSDKResourceFreshness = (
  resource: SDKResource,
): SDKResourceFreshness => {
  const [freshness, setFreshness] = useState<SDKResourceFreshness>(() =>
    getResourceFreshnessSnapshot(resource),
  );

  useEffect(() => {
    setFreshness(getResourceFreshnessSnapshot(resource));
  }, [resource]);

  useEffect(() => {
    return subscribeResourceFreshness(resource, setFreshness);
  }, [resource]);

  return freshness;
};
