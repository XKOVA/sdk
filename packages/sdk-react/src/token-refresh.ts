import type { TokenSet } from "@xkova/sdk-core";

/**
 * Inputs for token refresh deduplication.
 *
 * @remarks
 * - Encapsulates in-flight dedupe so concurrent consumers share one token refresh request.
 * - Intended for internal sdk-react provider usage.
 */
export interface EnsureFreshTokenWithDedupeParams {
  /** Force refresh even when the current access token is still valid. */
  force?: boolean;
  /** Current token set from provider state/ref. */
  current: TokenSet | null;
  /** Current in-flight refresh promise (if any). */
  inFlight: Promise<TokenSet | null> | null;
  /** Fetches a fresh token set from the app-owned token endpoint. */
  fetchTokens: () => Promise<TokenSet | null>;
  /** Persists the latest token set to provider refs/state. */
  setCurrent: (next: TokenSet) => void;
  /** Stores/clears the in-flight promise reference. */
  setInFlight: (next: Promise<TokenSet | null> | null) => void;
  /**
   * Refresh skew in seconds.
   * Tokens expiring within this window are treated as stale.
   */
  refreshSkewSeconds?: number;
}

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
export const ensureFreshTokenWithDedupe = async ({
  force = false,
  current,
  inFlight,
  fetchTokens,
  setCurrent,
  setInFlight,
  refreshSkewSeconds = 30,
}: EnsureFreshTokenWithDedupeParams): Promise<TokenSet | null> => {
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
    } finally {
      setInFlight(null);
    }
  })();

  setInFlight(nextInFlight);
  return nextInFlight;
};

