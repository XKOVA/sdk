/**
 * Resolve a fresh access token set with in-flight request deduplication.
 *
 * @remarks
 * Purpose:
 * - Return an existing still-valid token when possible.
 * - Ensure concurrent refresh requests reuse the same promise.
 *
 * Return semantics:
 * - Returns the current token set when still valid and refresh is not forced.
 * - Returns refreshed tokens (or null) when a refresh is required.
 *
 * Side effects:
 * - May invoke `fetchTokens`.
 * - Updates in-flight and current token references via provided callbacks.
 */
export const ensureFreshTokenWithDedupe = async ({ force = false, current, inFlight, fetchTokens, setCurrent, setInFlight, refreshSkewSeconds = 30, }) => {
    const nowSec = Math.floor(Date.now() / 1000);
    if (!force && current && current.expiresAt > nowSec + refreshSkewSeconds) {
        return current;
    }
    if (inFlight) {
        return inFlight;
    }
    const nextInFlight = (async () => {
        try {
            const next = await fetchTokens();
            if (next) {
                setCurrent(next);
            }
            return next;
        }
        finally {
            setInFlight(null);
        }
    })();
    setInFlight(nextInFlight);
    return nextInFlight;
};
