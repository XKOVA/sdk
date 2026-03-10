import { APIClient } from './api-client.js';
import { NetworkError, OAuthError, AbortedError, TimeoutError, UnauthorizedError, ValidationError, } from './errors.js';
import { fetchWithPolicy } from './http.js';
import { defaultRedact, generateRequestId, headersToRecord } from './telemetry.js';
import { createDefaultStorage } from './storage.js';
import { DEFAULT_SCOPES, } from './types.js';
const TOKEN_KEY = 'tokens';
const encoder = new TextEncoder();
const isLocalhostHostname = (hostname) => {
    const lower = hostname.toLowerCase();
    return (lower === 'localhost' ||
        lower === '127.0.0.1' ||
        lower === '::1' ||
        lower.endsWith('.localhost'));
};
/**
 * Decode a base64url-encoded string, applying padding as needed.
 *
 * @remarks
 * Purpose:
 * - Normalize base64url input and decode UTF-8 JSON segments safely.
 *
 * Parameters:
 * - `input`: Base64url-encoded string (no padding). Nullable: no.
 *
 * Return semantics:
 * - Returns the decoded UTF-8 string.
 *
 * Errors/failure modes:
 * - Throws ValidationError when no decoder is available.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Input is URL-safe base64 (no `+` or `/`).
 *
 * @example
 * const json = decodeBase64Url(payloadSegment);
 *
 * @see parseJWT
 */
const decodeBase64Url = (input) => {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = `${normalized}${'='.repeat(padLength)}`;
    if (typeof atob !== 'undefined')
        return atob(padded);
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(padded, 'base64').toString('utf8');
    }
    throw new ValidationError('No base64 decoder available in this runtime');
};
/**
 * Parse a JWT payload without signature verification.
 *
 * @remarks
 * Purpose:
 * - Extract non-sensitive claims for local validation (e.g., nonce).
 *
 * Parameters:
 * - `token`: JWT string in `header.payload.signature` format. Nullable: no.
 *
 * Return semantics:
 * - Returns the parsed payload object or null on failure.
 *
 * Errors/failure modes:
 * - Swallows decode/parse errors and returns null.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Does not verify signatures; use only for local, non-authoritative checks.
 *
 * @example
 * const payload = parseJWT(idToken);
 *
 * @see decodeBase64Url
 */
const parseJWT = (token) => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = parts[1];
        const json = decodeBase64Url(payload);
        return JSON.parse(json);
    }
    catch {
        return null;
    }
};
/**
 * Normalize requested scopes for OAuth flows.
 *
 * @remarks
 * Purpose:
 * - Ensures a stable, non-empty scopes array.
 *
 * Parameters:
 * - `scopes`: Requested scope list. Nullable: yes.
 *
 * Return semantics:
 * - Returns the provided scopes or DEFAULT_SCOPES when absent.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Returned list excludes falsy values.
 *
 * Data/auth references:
 * - DEFAULT_SCOPES from SDK types.
 */
const normalizeScopes = (scopes) => {
    const list = scopes ?? DEFAULT_SCOPES;
    return list.filter((scope) => Boolean(scope));
};
/**
 * Determine whether OIDC nonce is required.
 *
 * @remarks
 * Purpose:
 * - Treat `openid` scope as a nonce-required signal.
 *
 * Parameters:
 * - `scopes`: Granted scopes list. Nullable: no.
 *
 * Return semantics:
 * - Returns true when `openid` is present.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Scope comparison is case-sensitive.
 */
const scopesRequireNonce = (scopes) => {
    return scopes.includes('openid');
};
/**
 * Normalize an optional nonce string.
 *
 * @remarks
 * Purpose:
 * - Trim and validate nonce inputs for OIDC validation.
 *
 * Parameters:
 * - `value`: Raw nonce string. Nullable: yes.
 *
 * Return semantics:
 * - Returns a trimmed nonce or null when missing/empty.
 *
 * Errors/failure modes:
 * - None; invalid input returns null.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Returned nonce is non-empty.
 */
const normalizeNonce = (value) => {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};
/**
 * Assert that an ID token contains the expected nonce.
 *
 * @remarks
 * Purpose:
 * - Enforces OIDC nonce validation to prevent replay/mix-up attacks.
 *
 * Parameters:
 * - `tokens`: Parsed token response. Nullable: no.
 * - `expectedNonce`: Nonce stored during authorize flow. Nullable: yes.
 *
 * Return semantics:
 * - Returns void; throws on validation failure.
 *
 * Errors/failure modes:
 * - Throws ValidationError when nonce is missing or mismatched.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Nonce is required whenever an id_token is returned.
 *
 * Data/auth references:
 * - id_token payload nonce claim.
 */
const assertIdTokenNonce = (tokens, expectedNonce) => {
    const resolvedNonce = normalizeNonce(expectedNonce);
    if (!tokens.idToken) {
        if (resolvedNonce) {
            throw new ValidationError('Missing id_token for OpenID Connect flow');
        }
        return;
    }
    if (!resolvedNonce) {
        throw new ValidationError('Missing nonce for OpenID Connect flow');
    }
    const payload = parseJWT(tokens.idToken);
    const tokenNonce = payload && typeof payload.nonce === 'string' ? payload.nonce : null;
    if (!tokenNonce) {
        throw new ValidationError('Missing nonce in id_token');
    }
    if (tokenNonce !== resolvedNonce) {
        throw new ValidationError('Invalid nonce in id_token');
    }
};
/**
 * @internal
 * Normalize and validate the OAuth protocol base URL.
 *
 * @remarks
 * Purpose:
 * - Enforce that the configured base URL points to the OAuth protocol host origin.
 *
 * When to use:
 * - Internal SDK normalization before calling OAuth endpoints.
 *
 * When not to use:
 * - Do not call this from application code.
 * - Use OAuthService or buildAuthorizeUrl instead.
 *
 * Parameters:
 * - `input`: OAuth protocol host as an absolute URL. Nullable: no.
 *
 * Return semantics:
 * - Returns the normalized origin string (scheme + host).
 *
 * Errors/failure modes:
 * - Throws ValidationError when input is empty or not a valid OAuth host.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - The returned value is always an origin string with no path.
 *
 * Data/auth references:
 * - Validates OAuth protocol host URLs used for /oauth endpoints.
 */
export const normalizeOAuthBaseUrl = (input) => {
    if (!input) {
        throw new ValidationError('baseUrl is required');
    }
    let url;
    try {
        url = new URL(input);
    }
    catch {
        throw new ValidationError('baseUrl must be a valid absolute URL');
    }
    const trimmedPath = url.pathname.replace(/\/+$/, '');
    const withoutOauth = trimmedPath.endsWith('/oauth')
        ? trimmedPath.slice(0, -'/oauth'.length)
        : trimmedPath;
    if (withoutOauth && withoutOauth !== '/') {
        throw new ValidationError('baseUrl must point to the OAuth protocol host (origin only)');
    }
    const hostname = url.hostname.toLowerCase();
    // XKOVA protocol host naming: environments use `auth-*.xkova.com` (e.g. auth-local.xkova.com),
    // and some deployments may use `oauth-*.xkova.com`. Accept both.
    if (!isLocalhostHostname(hostname) &&
        !hostname.startsWith('oauth') &&
        !hostname.startsWith('auth')) {
        throw new ValidationError('baseUrl must be the OAuth protocol host (AUTH_SERVER_URL), not a tenant auth domain');
    }
    return `${url.protocol}//${url.host}`;
};
/**
 * @internal
 * Determine whether the SDK should treat the environment as test/dev.
 *
 * @remarks
 * Purpose:
 * - Classify a base URL into test vs production based on host naming.
 *
 * When to use:
 * - Internal environment classification during OAuth configuration.
 *
 * When not to use:
 * - Do not call this from application code.
 * - Use explicit environment configuration (pass environment explicitly) instead.
 *
 * Parameters:
 * - `config.baseUrl`: OAuth protocol host (origin). Nullable: no.
 * - `config.environment`: Optional override (test/production/auto). Nullable: yes.
 *
 * Return semantics:
 * - Returns true when environment is explicitly test or when the base URL
 *   hostname indicates localhost or a `-test.` suffix.
 *
 * Errors/failure modes:
 * - Throws ValidationError if baseUrl is invalid.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Uses baseUrl host only; does not inspect browser globals.
 */
export function shouldUseDevMode(config) {
    if (config.environment === 'test')
        return true;
    if (config.environment === 'production')
        return false;
    const normalized = normalizeOAuthBaseUrl(config.baseUrl);
    const hostname = new URL(normalized).hostname.toLowerCase();
    if (isLocalhostHostname(hostname))
        return true;
    return normalized.includes('-test.');
}
/**
 * @internal
 * Resolve the runtime environment mode from an OAuth base URL.
 *
 * @remarks
 * Purpose:
 * - Provide a stable test/production label for SDK consumers.
 *
 * When to use:
 * - Internal configuration for OAuthService and SDK initialization.
 *
 * When not to use:
 * - Do not call this from application code.
 * - Use XKOVAProvider configuration (or pass environment explicitly) instead.
 *
 * Parameters:
 * - `baseUrl`: OAuth protocol host (origin). Nullable: no.
 *
 * Return semantics:
 * - Returns "test" when shouldUseDevMode is true; otherwise "production".
 *
 * Errors/failure modes:
 * - Throws ValidationError if baseUrl is invalid.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Delegates to shouldUseDevMode for classification.
 */
export function detectEnvironment(baseUrl) {
    return shouldUseDevMode({ baseUrl, environment: 'auto' })
        ? 'test'
        : 'production';
}
/**
 * Resolve WebCrypto for PKCE generation.
 *
 * @remarks
 * Purpose:
 * - Provide a WebCrypto implementation for random bytes and SHA-256.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns a WebCrypto-compatible `Crypto` object.
 *
 * Errors/failure modes:
 * - Throws ValidationError when `globalThis.crypto` is unavailable.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - WebCrypto is provided by the runtime (browser or Node 18+).
 */
const getCrypto = () => {
    const fromGlobal = globalThis.crypto;
    if (fromGlobal?.getRandomValues && fromGlobal?.subtle)
        return fromGlobal;
    throw new ValidationError('No WebCrypto implementation available. Provide globalThis.crypto for PKCE support.');
};
const base64UrlEncode = (input) => {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    const base64 = typeof btoa !== 'undefined'
        ? btoa(binary)
        : typeof Buffer !== 'undefined'
            ? Buffer.from(binary, 'binary').toString('base64')
            : null;
    if (!base64) {
        throw new ValidationError('No base64 encoder available in this runtime');
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
/**
 * Base64-encode an input string for HTTP Basic auth.
 *
 * @remarks
 * Purpose:
 * - Provide a runtime-safe base64 encoder across browser/Node.
 *
 * Parameters:
 * - `input`: Raw string to encode. Nullable: no.
 *
 * Return semantics:
 * - Returns a base64-encoded string.
 *
 * Errors/failure modes:
 * - Throws ValidationError when no base64 encoder is available.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Uses UTF-8 encoding in Node runtimes.
 */
const base64Encode = (input) => {
    if (typeof btoa !== 'undefined') {
        return btoa(input);
    }
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(input, 'utf8').toString('base64');
    }
    throw new ValidationError('No base64 encoder available in this runtime');
};
/**
 * Build an HTTP Basic authorization header for client credentials.
 *
 * @remarks
 * Purpose:
 * - Supports client_secret_basic for OAuth token requests.
 *
 * Parameters:
 * - `clientId`: OAuth client_id. Nullable: no.
 * - `clientSecret`: OAuth client_secret. Nullable: no.
 *
 * Return semantics:
 * - Returns the full Authorization header value.
 *
 * Errors/failure modes:
 * - Throws ValidationError when encoding fails.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are URI-encoded before base64 encoding.
 */
const buildBasicAuthHeader = (clientId, clientSecret) => {
    const encoded = base64Encode(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`);
    return `Basic ${encoded}`;
};
const randomString = (length = 64) => {
    const crypto = getCrypto();
    const buffer = new Uint8Array(length);
    crypto.getRandomValues(buffer);
    return base64UrlEncode(buffer).slice(0, length);
};
const codeChallengeForVerifier = async (verifier) => {
    const crypto = getCrypto();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
};
/**
 * Generate a PKCE bundle with state and nonce.
 *
 * @remarks
 * Purpose:
 * - Produces PKCE verifier/challenge plus state and nonce for OIDC flows.
 *
 * When to use:
 * - Use before redirecting to `/oauth/authorize` to create a fresh PKCE bundle.
 *
 * When not to use:
 * - Do not reuse PKCE bundles across login attempts or users.
 *
 * Parameters:
 * - `options.state`: Optional pre-generated state. Nullable: yes.
 * - `options.codeVerifier`: Optional pre-generated PKCE verifier. Nullable: yes.
 * - `options.nonce`: Optional pre-generated OIDC nonce. Nullable: yes.
 *
 * Return semantics:
 * - Returns a PKCEBundle containing code_verifier, code_challenge, state, and nonce.
 *
 * Errors/failure modes:
 * - Throws ValidationError when crypto is unavailable.
 *
 * Side effects:
 * - Uses cryptographically secure randomness.
 *
 * Invariants/assumptions:
 * - Nonce is always generated even if the caller does not use openid scopes.
 *
 * Data/auth references:
 * - Used for PKCE and OIDC nonce validation in OAuth flows.
 */
export const generatePKCE = async (options) => {
    const codeVerifier = options?.codeVerifier ?? randomString(96);
    const codeChallenge = await codeChallengeForVerifier(codeVerifier);
    const state = options?.state ?? randomString(32);
    const nonce = options?.nonce ?? randomString(32);
    return { codeVerifier, codeChallenge, state, nonce };
};
/**
 * Build an OAuth authorization URL with PKCE and optional nonce.
 *
 * @remarks
 * Purpose:
 * - Generates the `/oauth/authorize` URL with required PKCE parameters.
 *
 * When to use:
 * - Use when you need to redirect the browser to the OAuth authorize endpoint manually.
 *
 * When not to use:
 * - Prefer OAuthService helpers when you want storage-backed flows.
 *
 * Parameters:
 * - `baseUrl`: OAuth protocol host (origin). Nullable: no.
 * - `clientId`: OAuth client_id. Nullable: no.
 * - `redirectUri`: Redirect URI for callbacks. Nullable: no.
 * - `scopes`: Requested scopes. Nullable: yes.
 * - `state`: CSRF state value. Nullable: no.
 * - `codeChallenge`: PKCE S256 challenge. Nullable: no.
 * - `tenantSlug`: Optional tenant slug. Nullable: yes.
 * - `prompt`: Optional prompt hint. Nullable: yes.
 * - `loginHint`: Optional login hint. Nullable: yes.
 * - `nonce`: OIDC nonce (required when openid scope is present). Nullable: yes.
 *
 * Return semantics:
 * - Returns a fully qualified authorize URL.
 *
 * Errors/failure modes:
 * - Throws ValidationError when nonce is missing for openid requests.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - PKCE S256 is always enforced.
 *
 * Data/auth references:
 * - /oauth/authorize parameters, OIDC nonce.
 */
export const buildAuthorizeUrl = (params) => {
    const base = normalizeOAuthBaseUrl(params.baseUrl);
    const url = new URL(`${base}/oauth/authorize`);
    const scopes = normalizeScopes(params.scopes);
    const needsNonce = scopesRequireNonce(scopes);
    const nonce = normalizeNonce(params.nonce);
    if (needsNonce && !nonce) {
        throw new ValidationError('nonce is required when openid scope is requested');
    }
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', params.state);
    url.searchParams.set('client_id', params.clientId);
    if (nonce)
        url.searchParams.set('nonce', nonce);
    if (params.tenantSlug)
        url.searchParams.set('tenant', params.tenantSlug);
    if (params.prompt)
        url.searchParams.set('prompt', params.prompt);
    if (params.loginHint)
        url.searchParams.set('login_hint', params.loginHint);
    return url.toString();
};
/**
 * Parse an OAuth callback URL or query string into structured fields.
 *
 * @remarks
 * Purpose:
 * - Normalize callback parameters for downstream token exchange and error handling.
 *
 * When to use:
 * - Use in server or browser callback handlers to extract `code` and `state`.
 *
 * When not to use:
 * - Do not parse untrusted input without validation of `state` against stored values.
 *
 * Parameters:
 * - `input`: URL, URLSearchParams, or raw string containing query parameters. Nullable: no.
 *
 * Return semantics:
 * - Returns OAuthCallbackParams with undefined fields when not present.
 *
 * Errors/failure modes:
 * - Throws when input cannot be parsed as a URL or query string.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Does not validate `state` or `code`; callers must validate separately.
 *
 * Runtime constraints:
 * - Works in browser and Node.js (no DOM dependencies).
 *
 * Security notes:
 * - Treat `errorDescription` and `errorUri` as untrusted input.
 */
export const parseOAuthCallback = (input) => {
    let params;
    if (input instanceof URLSearchParams) {
        params = input;
    }
    else if (input instanceof URL) {
        params = input.searchParams;
    }
    else {
        const value = input.trim();
        const queryStart = value.indexOf('?');
        if (queryStart >= 0) {
            params = new URLSearchParams(value.slice(queryStart));
        }
        else if (value.includes('=')) {
            params = new URLSearchParams(`?${value}`);
        }
        else {
            params = new URL(value).searchParams;
        }
    }
    return {
        code: params.get('code') ?? undefined,
        state: params.get('state') ?? undefined,
        error: params.get('error') ?? undefined,
        errorDescription: params.get('error_description') ?? undefined,
        errorUri: params.get('error_uri') ?? undefined,
    };
};
/**
 * Exchange a PKCE authorization code for OAuth tokens.
 *
 * @remarks
 * Purpose:
 * - Completes the authorization_code flow and validates OIDC nonce when applicable.
 *
 * When to use:
 * - Use after receiving a valid `code`/`state` callback when handling the OAuth flow manually.
 *
 * When not to use:
 * - Prefer OAuthService.exchangeAuthorizationCode when using the SDK service layer.
 *
 * Parameters:
 * - `baseUrl`: OAuth protocol host (origin). Nullable: no.
 * - `code`: Authorization code. Nullable: no.
 * - `codeVerifier`: PKCE verifier. Nullable: no.
 * - `redirectUri`: Redirect URI used during authorize. Nullable: no.
 * - `clientId`: OAuth client_id. Nullable: no.
 * - `clientSecret`: Optional client_secret for confidential clients. Nullable: yes.
 * - `nonce`: Expected OIDC nonce. Nullable: yes.
 * - `clientAuthMethod`: Optional client auth method override. Nullable: yes.
 * - `tokenEndpoint`: Optional token endpoint override. Nullable: yes.
 * - `fetch`: Optional fetch implementation. Nullable: yes.
 * - `timeoutMs`: Total timeout budget. Nullable: yes.
 * - `attemptTimeoutMs`: Per-attempt timeout. Nullable: yes.
 * - `retry`: Retry policy. Nullable: yes.
 *
 * Return semantics:
 * - Returns a TokenSet on success.
 *
 * Errors/failure modes:
 * - Throws OAuthError/ValidationError on failed exchanges or nonce mismatches.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Nonce is required when openid scope is granted.
 * - Caller must supply nonce when storage is not persisted across redirects.
 *
 * Data/auth references:
 * - /oauth/token response, id_token nonce claim.
 */
export const exchangeAuthorizationCode = async (params) => {
    const endpoint = params.tokenEndpoint ?? '/oauth/token';
    const base = normalizeOAuthBaseUrl(params.baseUrl);
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const fetchImpl = params.fetch ??
        ((...args) => {
            const f = globalThis.fetch;
            if (!f) {
                throw new ValidationError('No fetch implementation available');
            }
            return f.apply(globalThis, args);
        });
    const retry = params.retry ?? { retries: 0 };
    const policy = {
        timeoutMs: params.timeoutMs ?? 30000,
        attemptTimeoutMs: params.attemptTimeoutMs ?? 10000,
        retry: { ...retry, retries: retry.retries ?? 0 },
    };
    const clientAuthMethod = params.clientAuthMethod ?? 'client_secret_post';
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    const bodyPayload = {
        grant_type: 'authorization_code',
        code: params.code,
        code_verifier: params.codeVerifier,
        redirect_uri: params.redirectUri,
        client_id: params.clientId,
    };
    if (params.clientSecret) {
        if (clientAuthMethod === 'client_secret_basic') {
            headers.Authorization = buildBasicAuthHeader(params.clientId, params.clientSecret);
        }
        else {
            bodyPayload.client_secret = params.clientSecret;
        }
    }
    // OAuth token exchange is the only protocol-level exception to APIClient usage.
    const response = await fetchWithPolicy(fetchImpl, url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
    }, policy);
    const tokens = await parseTokenResponse(response);
    const expectedNonce = normalizeNonce(params.nonce);
    assertIdTokenNonce(tokens, expectedNonce);
    return tokens;
};
/**
 * @internal
 * Token guard that encapsulates expiry and scope checks.
 *
 * @remarks
 * Purpose:
 * - Provide reusable checks for token expiry and scope validation.
 *
 * When to use:
 * - Internal use by OAuthService and SDK helpers.
 *
 * When not to use:
 * - Do not call this from application code.
 * - Use OAuthService instead.
 *
 * Security notes:
 * - Token values are sensitive; do not log or persist without care.
 *
 * Parameters:
 * - `clockSkewSeconds`: Optional expiry skew in seconds (defaults to 30). Nullable: yes.
 *
 * Return semantics:
 * - Provides helper methods that throw on invalid tokens/scopes.
 *
 * Errors/failure modes:
 * - Methods throw UnauthorizedError on missing/insufficient scopes.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `expiresAt` values are unix seconds.
 *
 * Data/auth references:
 * - TokenSet access tokens and scope lists.
 */
export class TokenValidationService {
    constructor(clockSkewSeconds = 30) {
        this.clockSkewSeconds = clockSkewSeconds;
    }
    /**
     * Determine whether a token is expired or within the configured skew window.
     *
     * @remarks
     * Purpose:
     * - Provide a conservative expiry check for refresh decisions.
     *
     * Parameters:
     * - `tokens`: TokenSet to inspect. Nullable: yes.
     *
     * Return semantics:
     * - Returns true when tokens are missing or near expiry.
     *
     * Errors/failure modes:
     * - None.
     *
     * Side effects:
     * - None.
     *
     * Invariants/assumptions:
     * - `expiresAt` is in unix seconds.
     *
     * Data/auth references:
     * - Uses TokenSet.expiresAt.
     */
    isExpired(tokens) {
        if (!tokens)
            return true;
        const now = Math.floor(Date.now() / 1000);
        return now >= tokens.expiresAt - this.clockSkewSeconds;
    }
    /**
     * Assert that the provided tokens include required scopes.
     *
     * @remarks
     * Purpose:
     * - Guard sensitive operations behind explicit OAuth scopes.
     *
     * Parameters:
     * - `tokens`: TokenSet to validate. Nullable: yes.
     * - `required`: Scope or list of scopes that must be present. Nullable: no.
     *
     * Return semantics:
     * - Returns void; throws when scopes are missing.
     *
     * Errors/failure modes:
     * - Throws UnauthorizedError when tokens are missing or scopes are absent.
     *
     * Side effects:
     * - None.
     *
     * Invariants/assumptions:
     * - Token scopes are stored as a string array in TokenSet.scope.
     *
     * Data/auth references:
     * - TokenSet.scope values.
     */
    assertScopes(tokens, required) {
        if (!tokens)
            throw new UnauthorizedError('No active token');
        const requiredList = Array.isArray(required) ? required : [required];
        const missing = requiredList.filter((scope) => !tokens.scope.includes(scope));
        if (missing.length > 0) {
            throw new UnauthorizedError(`Missing required scopes: ${missing.join(', ')}`);
        }
    }
}
/**
 * High-level OAuth helper for token storage, refresh, and bootstrap calls.
 *
 * @remarks
 * Purpose:
 * - Encapsulate OAuth token exchange/refresh and bootstrap identity/tenant data.
 *
 * When to use:
 * - Use in headless or server-driven integrations that manage OAuth flows directly.
 *
 * When not to use:
 * - Prefer XKOVAProvider and sdk-react hooks when working in React apps.
 *
 * Security notes:
 * - Handles access and refresh tokens; keep secrets and storage secure.
 *
 * Runtime constraints:
 * - Requires a fetch implementation and storage adapter; works in browser or Node.js.
 *
 * Parameters:
 * - `options`: OAuthServiceOptions configuration. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; network calls occur when methods are invoked.
 *
 * Errors/failure modes:
 * - Constructor throws ValidationError when baseUrl is invalid.
 * - Methods throw SDKError subclasses on network/auth failures.
 *
 * Side effects:
 * - Performs network requests and persists tokens in storage.
 *
 * Invariants/assumptions:
 * - `baseUrl` points to the OAuth protocol host.
 *
 * Data/auth references:
 * - Uses /oauth/token, /oauth/user, /oauth/tenant, and /account endpoints.
 */
export class OAuthService {
    constructor(options) {
        this.validator = new TokenValidationService();
        this.accountEndpoint = '/account';
        this.storage =
            options.storage ?? createDefaultStorage(undefined, options.tenantId);
        this.baseUrl = normalizeOAuthBaseUrl(options.baseUrl);
        this.tokenEndpoint = options.tokenEndpoint ?? '/oauth/token';
        this.userEndpoint = options.userinfoEndpoint ?? '/oauth/user';
        this.tenantEndpoint = options.userinfoEndpoint
            ? options.userinfoEndpoint.replace(/user$/, 'tenant')
            : '/oauth/tenant';
        this.environment = options.environment ?? 'auto';
        // Always call fetch with the correct global binding to avoid "Illegal invocation" in some browsers.
        this.fetchImpl =
            options.fetch ??
                ((...args) => {
                    const f = globalThis.fetch;
                    return f.apply(globalThis, args);
                });
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.clientAuthMethod = options.clientAuthMethod ?? 'client_secret_post';
        this.requestPolicy = {
            timeoutMs: options.timeoutMs ?? 30000,
            attemptTimeoutMs: options.attemptTimeoutMs ?? 10000,
            retry: options.retry,
        };
        this.telemetry = options.telemetry;
    }
    createOAuthClient(accessToken) {
        return new APIClient({
            baseUrl: this.baseUrl,
            fetch: this.fetchImpl,
            timeoutMs: this.requestPolicy.timeoutMs,
            attemptTimeoutMs: this.requestPolicy.attemptTimeoutMs,
            retry: this.requestPolicy.retry,
            telemetry: this.telemetry,
            getAccessToken: async () => accessToken,
        });
    }
    async fetchWithObservability(url, init, opts) {
        const headers = {};
        // Normalize headers to a mutable record while preserving passed values.
        if (init.headers) {
            const h = init.headers;
            if (typeof h.forEach === "function") {
                h.forEach((v, k) => (headers[k] = v));
            }
            else if (Array.isArray(h)) {
                for (const [k, v] of h)
                    headers[k] = v;
            }
            else {
                Object.assign(headers, h);
            }
        }
        const requestId = opts?.requestId ?? headers["x-request-id"] ?? headers["X-Request-ID"] ?? generateRequestId();
        headers["x-request-id"] = requestId;
        const startedAt = Date.now();
        const redactor = this.telemetry?.redact ?? ((i) => defaultRedact(i));
        const redacted = redactor({ url, method: init.method, headers, body: opts?.redactBody });
        this.telemetry?.onRequestStart?.({
            requestId,
            url,
            method: init.method,
            startedAt,
            headers: redacted.headers,
            body: redacted.body,
            attempt: 0,
            maxRetries: (opts?.policy?.retry?.retries ?? this.requestPolicy.retry?.retries ?? 2),
        });
        let response;
        try {
            response = await fetchWithPolicy(this.fetchImpl, url, { ...init, headers }, {
                ...(opts?.policy ?? this.requestPolicy),
                hooks: {
                    onRetry: (ctx) => {
                        this.telemetry?.onRequestRetry?.({
                            requestId,
                            url,
                            method: init.method,
                            startedAt,
                            attempt: ctx.attempt,
                            maxRetries: ctx.maxRetries,
                            waitMs: ctx.waitMs,
                            reason: ctx.reason,
                        });
                    },
                },
            });
        }
        catch (err) {
            const durationMs = Date.now() - startedAt;
            const meta = { requestId, url, method: init.method };
            if (err?.name === "AbortError") {
                const abortedByCaller = init.signal?.aborted === true;
                const e = abortedByCaller
                    ? new AbortedError("Request aborted", { cause: err }, meta)
                    : new TimeoutError("Request timed out", { cause: err }, meta);
                this.telemetry?.onRequestError?.({ requestId, url, method: init.method, startedAt, durationMs, error: e });
                throw e;
            }
            const e = new NetworkError("Network request failed", { cause: err }, meta);
            this.telemetry?.onRequestError?.({ requestId, url, method: init.method, startedAt, durationMs, error: e });
            throw e;
        }
        const serverRequestId = response.headers.get("x-request-id") ?? response.headers.get("X-Request-ID");
        if (response.ok) {
            this.telemetry?.onRequestSuccess?.({
                requestId,
                url,
                method: init.method,
                startedAt,
                durationMs: Date.now() - startedAt,
                status: response.status,
                headers: headersToRecord(response.headers),
            });
        }
        return { response, requestId, serverRequestId, startedAt };
    }
    /** Returns the configured base URL for convenience. */
    getBaseUrl() {
        return this.baseUrl;
    }
    /** Returns configured client id if provided. */
    getClientId() {
        return this.clientId;
    }
    /** Returns configured client secret if provided. (Server-side only) */
    getClientSecret() {
        return this.clientSecret;
    }
    /** Loads cached tokens if present. */
    async getTokens() {
        return this.storage.read(TOKEN_KEY);
    }
    /** Clears stored tokens. */
    async clearTokens() {
        await this.storage.write(TOKEN_KEY, null);
    }
    /**
     * Clears local tokens. BYOD apps should revoke refresh tokens server-side.
     *
   * @remarks
   * - SDK core does not perform browser redirects; callers must handle any redirect.
   * - `postLogoutRedirectUri` and `useRedirect` are accepted for parity but ignored here.
   */
    async logout(params) {
        await this.clearTokens();
    }
    /** Fetches bootstrap data from `/oauth/user` + `/oauth/tenant` using the current access token. */
    async fetchBootstrap(tokens, signal) {
        const activeTokens = tokens ?? (await this.getTokens());
        if (!activeTokens)
            throw new UnauthorizedError('Cannot fetch bootstrap without tokens');
        const client = this.createOAuthClient(activeTokens.accessToken);
        const userPayload = await client.get(this.userEndpoint, signal);
        const tenantPayload = await client.get(this.tenantEndpoint, signal);
        let accountState = null;
        try {
            const raw = await client.get(this.accountEndpoint, signal);
            accountState = mapAccountState(raw);
        }
        catch {
            accountState = null;
        }
        const mappedTenant = mapTenantResponse(tenantPayload);
        return {
            user: mapUserResponse(userPayload),
            tenant: mappedTenant,
            networks: mappedTenant.networks,
            tokens: mappedTenant.tokens,
            accountState,
            tokenMeta: {
                scope: Array.isArray(userPayload?.scope)
                    ? userPayload.scope
                    : (userPayload?.scope?.split?.(' ') ?? []),
            },
        };
    }
    /**
     * Refresh tokens when necessary and persist the refreshed set.
     *
     * @remarks
     * Purpose:
     * - Keeps access tokens valid by attempting a refresh when they expire or when forced.
     *
     * Parameters:
     * - `force`: When true, refreshes even if the token is not expired. Nullable: no.
     * - `signal`: Optional AbortSignal to cancel the refresh request. Nullable: yes.
     *
     * Return semantics:
     * - Returns the refreshed token set, the current valid set, or null when no valid tokens remain.
     *
     * Errors/failure modes:
     * - Swallows refresh errors and returns the current token set when still valid.
     * - Clears stored tokens and returns null when expired and refresh fails.
     *
     * Side effects:
     * - May call `/oauth/token` with `refresh_token`.
     * - Writes updated tokens to storage.
     *
     * Invariants/assumptions:
     * - Refresh requires a `refresh_token` and `clientId`.
     *
     * Data/auth references:
     * - OAuth `/oauth/token` refresh_token grant.
     */
    async refreshTokensIfNeeded(force = false, signal) {
        const current = await this.getTokens();
        if (!current)
            return null;
        const isExpired = this.validator.isExpired(current);
        if (!force && !isExpired)
            return current;
        // Try refresh token first (confidential clients)
        if (current.refreshToken && this.clientId) {
            try {
                const refreshed = await this.refreshWithRefreshToken(current.refreshToken, signal);
                return refreshed;
            }
            catch {
                if (!isExpired)
                    return current;
            }
        }
        if (isExpired) {
            await this.clearTokens();
            return null;
        }
        return current;
    }
    /**
     * Check whether a valid token set is currently stored.
     *
     * @remarks
     * Purpose:
     * - Provides a lightweight authenticated/unauthenticated signal without network calls.
     *
     * Parameters:
     * - None.
     *
     * Return semantics:
     * - Returns true when a non-expired token set exists in storage; otherwise false.
     *
     * Errors/failure modes:
     * - Returns false when tokens are missing or expired.
     *
     * Side effects:
     * - Reads token storage.
     *
     * Invariants/assumptions:
     * - Tokens are stored via OAuth flows handled by this service.
     *
     * Data/auth references:
     * - Local token storage (`TOKEN_KEY`).
     */
    async isAuthenticated() {
        const tokens = await this.getTokens();
        if (!tokens)
            return false;
        return !this.validator.isExpired(tokens);
    }
    async refreshWithRefreshToken(refreshToken, signal) {
        const clientId = this.clientId;
        const clientSecret = this.clientSecret;
        if (!clientId) {
            throw new ValidationError('clientId is required to refresh tokens');
        }
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        const bodyPayload = {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
        };
        if (clientSecret) {
            if (this.clientAuthMethod === 'client_secret_basic') {
                headers.Authorization = buildBasicAuthHeader(clientId, clientSecret);
            }
            else {
                bodyPayload.client_secret = clientSecret;
            }
        }
        // OAuth token refresh is a protocol-level exception to APIClient usage.
        const { response } = await this.fetchWithObservability(this.urlFor(this.tokenEndpoint), {
            method: 'POST',
            headers,
            signal,
            body: JSON.stringify(bodyPayload),
        }, {
            policy: { ...this.requestPolicy, retry: { ...(this.requestPolicy.retry ?? {}), retries: 0 } },
            redactBody: { grant_type: "refresh_token" },
        });
        return this.handleTokenResponse(response);
    }
    /** Utility to generate a full URL from a base-relative endpoint. */
    urlFor(endpoint) {
        return endpoint.startsWith('http')
            ? endpoint
            : `${this.baseUrl}${endpoint}`;
    }
    /**
     * Parse and persist an OAuth token response.
     *
     * @remarks
     * Purpose:
     * - Converts a raw token response into a TokenSet and stores it.
     *
     * Parameters:
     * - `response`: Fetch response from the token endpoint. Nullable: no.
     *
     * Return semantics:
     * - Returns the parsed TokenSet on success.
     *
     * Errors/failure modes:
     * - Throws when the response is non-OK or missing required fields.
     *
     * Side effects:
     * - Writes tokens to storage.
     *
     * Invariants/assumptions:
     * - Response follows OAuth token response shape.
     *
     * Data/auth references:
     * - OAuth `/oauth/token` response.
     */
    async handleTokenResponse(response) {
        const tokens = await parseTokenResponse(response);
        await this.storage.write(TOKEN_KEY, tokens);
        return tokens;
    }
}
const parseTokenResponse = async (response) => {
    let payload = null;
    try {
        payload = await response.json();
    }
    catch {
        /* ignore */
    }
    if (!response.ok) {
        if (response.status === 401) {
            throw new UnauthorizedError('Invalid token', response.status, payload);
        }
        throw new OAuthError('Token exchange failed', response.status, payload);
    }
    if (!payload?.access_token || !payload?.expires_in) {
        throw new ValidationError('Malformed token response', payload);
    }
    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in),
        scope: Array.isArray(payload.scope)
            ? payload.scope
            : typeof payload.scope === 'string'
                ? payload.scope.split(' ')
                : DEFAULT_SCOPES,
        tokenType: (payload.token_type ?? 'bearer').toLowerCase(),
        idToken: payload.id_token,
        sessionId: payload.session_id,
    };
};
const mapAccountDescriptor = (payload) => ({
    name: payload?.name ?? '',
    kind: payload?.kind ?? 'account',
    account: payload?.account ?? '',
    providerInstanceId: payload?.provider_instance_id ?? null,
    aaProviderMetadata: payload?.aa_provider_metadata ?? {},
    metadata: payload?.metadata ?? {},
});
const mapUserResponse = (payload) => ({
    id: payload?.sub ?? '',
    email: payload?.email ?? '',
    emailVerified: Boolean(payload?.email_verified),
    firstName: payload?.first_name ?? null,
    lastName: payload?.last_name ?? null,
    name: payload?.name ?? null,
    handle: payload?.handle ?? null,
    avatarUrl: payload?.avatar_url ?? null,
    completeProfile: Boolean(payload?.complete_profile),
    account: mapAccountDescriptor(payload?.account ?? {}),
    tenantId: payload?.tenant_id ?? null,
    tenantSlug: payload?.tenant_slug ?? null,
    tenantName: payload?.tenant_name ?? null,
    scope: typeof payload?.scope === 'string' ? payload.scope : null,
    createdAt: payload?.created_at ?? null,
    updatedAt: payload?.updated_at ?? null,
});
/**
 * @internal
 * Normalize OAuth tenant config payload into SDK TenantConfig.
 *
 * @remarks
 * Purpose:
 * - Map raw tenant payloads into the SDK TenantConfig shape.
 *
 * When to use:
 * - Internal use by OAuthService during bootstrap.
 *
 * When not to use:
 * - Do not call this from application code.
 * - Use OAuthService instead.
 *
 * Parameters:
 * - `payload`: Raw tenant config payload (snake_case or camelCase). Nullable: yes.
 *
 * Return semantics:
 * - Returns a normalized TenantConfig with defaults for missing fields.
 *
 * Errors/failure modes:
 * - None; best-effort mapping.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `networkId` values are normalized to string identifiers.
 * - `supportedTypes` uses canonical values (`deposit`/`withdraw`) when present.
 *
 * Data/auth references:
 * - Consumes tenant config response payload; no network requests are made.
 */
export const mapTenantResponse = (payload) => {
    const authDomain = (() => {
        const raw = typeof payload?.auth_domain === "string"
            ? payload.auth_domain
            : typeof payload?.authDomain === "string"
                ? payload.authDomain
                : null;
        const trimmed = typeof raw === "string" ? raw.trim() : "";
        return trimmed.length > 0 ? trimmed : null;
    })();
    const mapNetwork = (n) => {
        const networkIdRaw = n?.network_id ?? n?.networkId;
        return {
            id: n?.id ?? '',
            name: n?.name ?? '',
            symbol: n?.symbol ?? undefined,
            networkId: networkIdRaw !== undefined && networkIdRaw !== null
                ? String(networkIdRaw)
                : '',
            networkFamily: n?.network_family ?? n?.networkFamily,
            accountFormat: n?.account_format ?? n?.accountFormat,
            rpcUrl: n?.rpc_url ??
                n?.rpcUrl ??
                n?.rpcs?.find?.((r) => r.is_primary)?.url ??
                n?.rpcs?.[0]?.url,
            rpcs: n?.rpcs ?? undefined,
            explorerUrl: n?.explorer_url ?? n?.explorerUrl ?? null,
            isTestnet: n?.is_testnet ?? n?.testnet ?? false,
            nativeCurrency: n?.native_currency ?? n?.nativeCurrency,
            nativeCurrencySymbol: n?.native_currency_symbol ?? n?.nativeCurrencySymbol,
            nativeCurrencyDecimals: n?.native_currency_decimals ?? n?.nativeCurrencyDecimals,
            nativeTokenStandard: n?.native_token_standard ?? n?.nativeTokenStandard,
            logoUrl: n?.logo_url ?? n?.logoUrl ?? null,
            pendingPaymentsContract: n?.pending_payments_contract ?? n?.pendingPaymentsContract ?? null,
        };
    };
    const mapToken = (t) => {
        const networkIdRaw = t?.network_id ?? t?.networkId;
        return {
            id: t?.id,
            contract: t?.contract ?? null,
            networkId: networkIdRaw !== undefined && networkIdRaw !== null
                ? String(networkIdRaw)
                : '',
            symbol: t?.symbol ?? '',
            decimals: t?.decimals ?? 0,
            tokenType: t?.token_standard ?? t?.tokenType,
            isStable: t?.is_stable ?? t?.isStable,
            isPrimary: t?.is_primary ?? t?.isPrimary,
            isUtility: t?.is_utility ?? t?.isUtility,
            isDefault: t?.is_default ?? t?.isDefault,
            logoUrl: t?.logo_url ?? t?.logoUrl ?? null,
        };
    };
    const mapTransferProvider = (p) => {
        const provider = p?.provider ?? {};
        const contracts = Array.isArray(p?.contracts) ? p.contracts : [];
        const faucetContractEntry = contracts.find((c) => (c?.contract_type ?? c?.contractType) === 'faucet');
        const faucetContract = p?.config_metadata?.faucetContract ?? faucetContractEntry?.contract ?? null;
        const faucetNetworkIdRaw = faucetContractEntry?.network_id ?? faucetContractEntry?.networkId;
        const faucetNetworkId = faucetNetworkIdRaw !== undefined && faucetNetworkIdRaw !== null
            ? Number(faucetNetworkIdRaw)
            : undefined;
        const supportedTypesRaw = provider?.supported_types ??
            provider?.supportedTypes ??
            (typeof provider?.type === 'string' ? [provider.type] : []);
        const normalizeTransferType = (value) => {
            if (typeof value !== 'string')
                return null;
            const lower = value.toLowerCase();
            if (lower === 'onramp')
                return 'deposit';
            if (lower === 'offramp')
                return 'withdraw';
            return lower;
        };
        const supportedTypes = Array.isArray(supportedTypesRaw)
            ? supportedTypesRaw
                .map(normalizeTransferType)
                .filter((value) => Boolean(value))
            : [];
        const supportedPaymentMethods = provider?.supported_payment_methods ?? provider?.supportedPaymentMethods ?? [];
        const supportedCrypto = provider?.supported_crypto ?? provider?.supportedCrypto ?? [];
        const minAmountUsdRaw = p?.custom_min_amount_usd ?? provider?.min_amount_usd ?? provider?.minAmountUsd;
        const maxAmountUsdRaw = p?.custom_max_amount_usd ?? provider?.max_amount_usd ?? provider?.maxAmountUsd;
        const baseFeePercentRaw = p?.custom_fee_percent ?? provider?.base_fee_percent ?? provider?.baseFeePercent;
        return {
            id: provider.id ?? p?.provider_id ?? p?.id,
            providerId: provider.id ?? p?.provider_id,
            configId: p?.id,
            name: p?.custom_name ?? provider.name,
            logoUrl: p?.custom_logo_url ?? provider.logo_url ?? null,
            integrationMethod: provider.type ??
                p?.config_metadata?.integrationMethod ??
                p?.config_metadata?.integration_method,
            supportedTypes,
            supportedPaymentMethods: Array.isArray(supportedPaymentMethods)
                ? supportedPaymentMethods
                : [],
            supportedCrypto: Array.isArray(supportedCrypto) ? supportedCrypto : [],
            minAmountUsd: minAmountUsdRaw !== undefined && minAmountUsdRaw !== null
                ? Number(minAmountUsdRaw)
                : undefined,
            maxAmountUsd: maxAmountUsdRaw !== undefined && maxAmountUsdRaw !== null
                ? Number(maxAmountUsdRaw)
                : undefined,
            baseFeePercent: baseFeePercentRaw !== undefined && baseFeePercentRaw !== null
                ? Number(baseFeePercentRaw)
                : undefined,
            websiteUrl: provider?.website_url ?? provider?.websiteUrl ?? null,
            faucetContract,
            networkId: faucetNetworkId,
            supportedNetworks: contracts
                .map((c) => c?.network_id ?? c?.networkId)
                .filter((id) => id !== undefined && id !== null)
                .map((id) => ({ networkId: Number(id) })),
            metadata: {
                ...(provider.metadata ?? {}),
                ...(p?.config_metadata ?? {}),
                supportedTypes,
                supportedPaymentMethods,
                supportedCrypto,
                minAmountUsd: minAmountUsdRaw,
                maxAmountUsd: maxAmountUsdRaw,
                baseFeePercent: baseFeePercentRaw,
                faucetContract,
            },
        };
    };
    return {
        id: payload?.tenant_id ?? '',
        slug: payload?.tenant_slug ?? null,
        name: payload?.tenant_name ?? null,
        authDomain,
        environment: payload?.environment === 'test'
            ? 'test'
            : payload?.environment === 'live'
                ? 'live'
                : null,
        version: payload?.config_version ?? '1',
        networks: (payload?.networks ?? []).map(mapNetwork),
        tokens: (payload?.tokens ?? []).map(mapToken),
        transferProviders: (payload?.transfer_providers ?? []).map(mapTransferProvider),
    };
};
const mapAccountState = (payload) => ({
    account: mapAccountDescriptor(payload?.account ?? {}),
});
