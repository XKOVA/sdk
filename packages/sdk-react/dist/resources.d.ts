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
export type SDKResource = "account" | "contacts" | "payments" | "payment-requests" | "transfers" | "transactions" | "agent-installations" | "sessions" | "balances";
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
export declare const emitResourceUpdate: (resource: SDKResource, eventInput?: {
    source?: string;
    remoteEventAt?: number | null;
    hints?: Record<string, unknown> | null;
}) => void;
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
export declare const subscribeResourceUpdate: (resource: SDKResource, listener: SDKResourceListener) => () => void;
/**
 * Get the latest resource freshness snapshot.
 *
 * @param resource - SDK resource key.
 * @returns Freshness snapshot.
 */
export declare const getResourceFreshnessSnapshot: (resource: SDKResource) => SDKResourceFreshness;
/**
 * Subscribe to freshness changes for a resource key.
 *
 * @param resource - SDK resource key.
 * @param listener - Callback fired when freshness changes.
 * @returns Unsubscribe function.
 */
export declare const subscribeResourceFreshness: (resource: SDKResource, listener: SDKResourceFreshnessListener) => () => void;
/**
 * Mark a resource fetch completion timestamp.
 *
 * @param resource - SDK resource key that was fetched.
 * @param fetchedAt - Optional fetch completion timestamp in ms.
 */
export declare const markSDKResourceFetched: (resource: SDKResource, fetchedAt?: number) => void;
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
export declare const invalidateSDKResource: (resource: SDKResource, options?: {
    source?: string;
    remoteEventAt?: number | null;
    hints?: Record<string, unknown> | null;
}) => void;
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
export declare const useResourceInvalidation: (resource: SDKResource, handler: (event?: SDKResourceInvalidationEvent) => void) => void;
/**
 * Subscribe to freshness metadata for a specific SDK resource.
 *
 * @param resource - SDK resource key.
 * @returns Freshness metadata (`lastEventAt`, `lastFetchAt`, `isStale`).
 */
export declare const useSDKResourceFreshness: (resource: SDKResource) => SDKResourceFreshness;
export {};
