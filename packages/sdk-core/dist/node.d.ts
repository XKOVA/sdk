import { OAuthServiceOptions } from "./oauth.js";
import { SessionVerificationResult } from "./types.js";
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
export declare const extractBearerToken: (header: string | null | undefined) => string | null;
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
export declare const fetchBootstrapWithAccessToken: (accessToken: string | null | undefined, options: OAuthServiceOptions) => Promise<SessionVerificationResult>;
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
export declare const createAccessTokenVerifier: (options: OAuthServiceOptions) => (accessToken: string | null | undefined) => Promise<SessionVerificationResult>;
