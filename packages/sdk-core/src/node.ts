import { OAuthService, OAuthServiceOptions } from "./oauth.js";
import { UnauthorizedError, ValidationError } from "./errors.js";
import { MemoryStorage, AuthStorage } from "./storage.js";
import { DEFAULT_SCOPES, SessionVerificationResult, TokenSet } from "./types.js";

/**
 * Decode a base64url-encoded JWT segment with padding normalization.
 *
 * @remarks
 * Purpose:
 * - Normalize base64url payloads to standard base64 before decoding.
 *
 * Parameters:
 * - `input`: Base64url-encoded segment (no padding). Nullable: no.
 *
 * Return semantics:
 * - Returns the decoded UTF-8 string.
 *
 * Errors/failure modes:
 * - Throws ValidationError when no base64 decoder is available.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Input is a URL-safe base64 string.
 *
 * @example
 * const json = decodeBase64Url(payloadSegment);
 */
const decodeBase64Url = (input: string): string => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${"=".repeat(padLength)}`;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  if (typeof atob !== "undefined") {
    return atob(padded);
  }
  throw new ValidationError("No base64 decoder available");
};

/**
 * Decode a JWT payload without signature verification.
 *
 * @remarks
 * Purpose:
 * - Extract exp/scope claims for server-side access token checks.
 *
 * Parameters:
 * - `token`: JWT string in `header.payload.signature` format. Nullable: no.
 *
 * Return semantics:
 * - Returns payload with `exp`/`scope` or null on failure.
 *
 * Errors/failure modes:
 * - Swallows decode/parse errors and returns null.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Does not verify token signatures; caller must validate token source.
 *
 * @example
 * const payload = decodeJwtPayload(accessToken);
 */
const decodeJwtPayload = (token: string): { exp?: number; scope?: string | string[] } | null => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = decodeBase64Url(payload);
    return JSON.parse(json) as { exp?: number; scope?: string | string[] };
  } catch {
    return null;
  }
};

/**
 * Extract a Bearer token from an Authorization header value.
 *
 * @remarks
 * Purpose:
 * - Normalize `Authorization: Bearer <token>` parsing in server handlers.
 *
 * When to use:
 * - Use in server middleware or API routes to read inbound Authorization headers.
 *
 * When not to use:
 * - Do not parse or log headers in client-side code.
 *
 * Parameters:
 * - `header`: Raw Authorization header value. Nullable: yes.
 *
 * Return semantics:
 * - Returns the bearer token string or null when absent/invalid.
 *
 * Errors/failure modes:
 * - None; returns null on malformed input.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Scheme must be `Bearer` (case-insensitive).
 *
 * Security notes:
 * - Treat the header as sensitive; do not log raw values.
 *
 * @advanced
 */
export const extractBearerToken = (header: string | null | undefined): string | null => {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
};

/**
 * Resolve bootstrap data (user, tenant, tokens) using an access token.
 *
 * @remarks
 * Purpose:
 * - Provide a server-side verification helper that turns an access token into bootstrap payloads.
 *
 * When to use:
 * - Use in backend routes that need to validate a bearer token and load user/tenant context.
 *
 * When not to use:
 * - Do not call from browser contexts; this is intended for server-side verification.
 *
 * Parameters:
 * - `accessToken`: Bearer access token string. Nullable: yes (throws if missing).
 * - `options`: OAuthServiceOptions for the target tenant. Nullable: no.
 *
 * Return semantics:
 * - Returns SessionVerificationResult with user/tenant context and derived token metadata.
 *
 * Errors/failure modes:
 * - Throws UnauthorizedError when `accessToken` is missing.
 * - Propagates OAuthService errors for invalid tokens or network failures.
 *
 * Side effects:
 * - Performs OAuth network requests to fetch bootstrap data.
 *
 * Invariants/assumptions:
 * - Uses MemoryStorage; no persistence across calls.
 * - Falls back to DEFAULT_SCOPES if the JWT lacks scope claims.
 *
 * Data/auth references:
 * - Access token is used as the sole credential; refresh tokens are not used.
 *
 * Security notes:
 * - Never expose access tokens to the client or logs.
 *
 * @advanced
 */
export const fetchBootstrapWithAccessToken = async (
  accessToken: string | null | undefined,
  options: OAuthServiceOptions
): Promise<SessionVerificationResult> => {
  if (!accessToken) {
    throw new UnauthorizedError("access token is required");
  }

  const oauth = new OAuthService({
    ...options,
    storage: new AuthStorage(new MemoryStorage())
  });

  const payload = decodeJwtPayload(accessToken);
  const expiresAt = payload?.exp ?? Math.floor(Date.now() / 1000) + 60;
  const scope =
    Array.isArray(payload?.scope)
      ? payload?.scope
      : typeof payload?.scope === "string"
        ? payload.scope.split(" ")
        : DEFAULT_SCOPES;

  const tokens: TokenSet = {
    accessToken,
    refreshToken: undefined,
    expiresAt,
    scope,
    tokenType: "bearer"
  };

  const bootstrap = await oauth.fetchBootstrap(tokens);
  return {
    user: bootstrap.user,
    tenant: bootstrap.tenant,
    accountState: bootstrap.accountState ?? null,
    tokens,
    issuedAt: Date.now()
  };
};

/**
 * Create a reusable access-token verifier for server handlers.
 *
 * @remarks
 * Purpose:
 * - Bind OAuthServiceOptions once and reuse a verifier across requests.
 *
 * When to use:
 * - Use in server frameworks to wire a consistent verification function.
 *
 * When not to use:
 * - Avoid in client-side code; use OAuthService or SDK providers instead.
 *
 * Parameters:
 * - `options`: OAuthServiceOptions used for verification. Nullable: no.
 *
 * Return semantics:
 * - Returns a function that accepts an access token and resolves SessionVerificationResult.
 *
 * Errors/failure modes:
 * - Propagates errors from fetchBootstrapWithAccessToken when invoked.
 *
 * Side effects:
 * - None when creating the verifier; network calls occur on invocation.
 *
 * Invariants/assumptions:
 * - Uses the provided options for every invocation.
 *
 * @advanced
 */
export const createAccessTokenVerifier =
  (options: OAuthServiceOptions) =>
  async (accessToken: string | null | undefined): Promise<SessionVerificationResult> =>
    fetchBootstrapWithAccessToken(accessToken, options);
