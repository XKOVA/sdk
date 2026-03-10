import { useSDK } from "./provider.js";
import { useSDKResourceFreshness, } from "./resources.js";
/**
 * Access the SDK real-time connection status.
 *
 * @remarks
 * Purpose:
 * - Expose Socket.IO connection state used for resource invalidation.
 * - Use to decide whether to enable polling fallbacks.
 *
 * When to use:
 * - Use in UI apps to display connection state or decide on auto-refresh.
 *
 * Return semantics:
 * - Returns the current realtime status from the SDK provider.
 */
export const useRealtimeStatus = () => {
    const { realtime } = useSDK();
    return realtime;
};
/**
 * Resolve an auto-refresh interval to polling fallback behavior.
 *
 * @remarks
 * Purpose:
 * - Keep polling behavior consistent across SDK hooks.
 * - Disable polling while realtime is healthy (`connected`/`connecting`).
 *
 * Return semantics:
 * - Returns the requested interval when realtime is unavailable.
 * - Returns `null` when polling should be disabled.
 */
export const resolvePollingFallbackMs = (intervalMs, realtime) => {
    if (typeof intervalMs !== "number" || !Number.isFinite(intervalMs) || intervalMs <= 0) {
        return null;
    }
    if (realtime.status === "connected" || realtime.status === "connecting") {
        return null;
    }
    return intervalMs;
};
/**
 * Access freshness metadata for a specific SDK resource.
 *
 * @remarks
 * Purpose:
 * - Expose resource-level freshness (`lastEventAt`, `lastFetchAt`, `isStale`) for UI status badges.
 * - Pair with `useRealtimeStatus` to render Live/Reconnecting/Stale states.
 *
 * @param resource - SDK resource key.
 * @returns Resource freshness metadata.
 */
export const useResourceFreshness = (resource) => {
    return useSDKResourceFreshness(resource);
};
