import { APIClient } from './api-client.js';
import {
  NetworkError,
  OAuthError,
  AbortedError,
  TimeoutError,
  type SDKErrorMeta,
  UnauthorizedError,
  ValidationError,
} from './errors.js';
import { fetchWithPolicy, type RequestPolicy, type RetryOptions } from './http.js';
import { defaultRedact, generateRequestId, headersToRecord, type SDKTelemetry } from './telemetry.js';
import { AuthStorage, createDefaultStorage } from './storage.js';
import {
  AccountDescriptor,
  AccountState,
  BootstrapPayload,
  DEFAULT_SCOPES,
  SDKConfig,
  Scope,
  TenantConfig,
  TenantNetwork,
  TokenAsset,
  TokenSet,
  UserInfo,
  TransferProvider,
} from './types.js';

const TOKEN_KEY = 'tokens';

const encoder = new TextEncoder();

const isLocalhostHostname = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower.endsWith('.localhost')
  );
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
const decodeBase64Url = (input: string): string => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${'='.repeat(padLength)}`;
  if (typeof atob !== 'undefined') return atob(padded);
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
const parseJWT = (token: string): any => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json = decodeBase64Url(payload);
    return JSON.parse(json);
  } catch {
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
const normalizeScopes = (scopes?: Scope[]): Scope[] => {
  const list = scopes ?? DEFAULT_SCOPES;
  return list.filter((scope) => Boolean(scope)) as Scope[];
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
const scopesRequireNonce = (scopes: Scope[]): boolean => {
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
const normalizeNonce = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
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
const assertIdTokenNonce = (
  tokens: TokenSet,
  expectedNonce: string | null,
): void => {
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
  const tokenNonce =
    payload && typeof payload.nonce === 'string' ? payload.nonce : null;
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
export const normalizeOAuthBaseUrl = (input: string): string => {
  if (!input) {
    throw new ValidationError('baseUrl is required');
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ValidationError('baseUrl must be a valid absolute URL');
  }

  const trimmedPath = url.pathname.replace(/\/+$/, '');
  const withoutOauth = trimmedPath.endsWith('/oauth')
    ? trimmedPath.slice(0, -'/oauth'.length)
    : trimmedPath;

  if (withoutOauth && withoutOauth !== '/') {
    throw new ValidationError(
      'baseUrl must point to the OAuth protocol host (origin only)',
    );
  }

  const hostname = url.hostname.toLowerCase();
  // XKOVA protocol host naming: environments use `auth-*.xkova.com` (e.g. auth-local.xkova.com),
  // and some deployments may use `oauth-*.xkova.com`. Accept both.
  if (
    !isLocalhostHostname(hostname) &&
    !hostname.startsWith('oauth') &&
    !hostname.startsWith('auth')
  ) {
    throw new ValidationError(
      'baseUrl must be the OAuth protocol host (AUTH_SERVER_URL), not a tenant auth domain',
    );
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
export function shouldUseDevMode(config: {
  baseUrl: string;
  environment?: 'test' | 'production' | 'auto';
}): boolean {
  if (config.environment === 'test') return true;
  if (config.environment === 'production') return false;

  const normalized = normalizeOAuthBaseUrl(config.baseUrl);
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (isLocalhostHostname(hostname)) return true;
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
export function detectEnvironment(baseUrl: string): 'test' | 'production' {
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
const getCrypto = (): Crypto => {
  const fromGlobal = (globalThis as any).crypto as Crypto | undefined;
  if (fromGlobal?.getRandomValues && fromGlobal?.subtle) return fromGlobal;
  throw new ValidationError(
    'No WebCrypto implementation available. Provide globalThis.crypto for PKCE support.',
  );
};

const base64UrlEncode = (input: ArrayBuffer | Uint8Array) => {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 =
    typeof btoa !== 'undefined'
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
const base64Encode = (input: string): string => {
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
const buildBasicAuthHeader = (clientId: string, clientSecret: string): string => {
  const encoded = base64Encode(
    `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`,
  );
  return `Basic ${encoded}`;
};

const randomString = (length = 64) => {
  const crypto = getCrypto();
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer).slice(0, length);
};

const codeChallengeForVerifier = async (verifier: string) => {
  const crypto = getCrypto();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
};

/**
 * PKCE and OIDC nonce bundle for OAuth authorization flows.
 *
 * @remarks
 * Purpose:
 * - Captures verifier/challenge plus state and nonce values needed across redirects.
 *
 * When to use:
 * - Use as the output of generatePKCE or when persisting PKCE data between redirects.
 *
 * When not to use:
 * - Do not construct manually unless you must restore previously stored values.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - All fields are non-empty strings when generated by the SDK.
 *
 * Data/auth references:
 * - PKCE and OIDC nonce parameters for `/oauth/authorize` and `/oauth/token`.
 *
 * @property codeVerifier - PKCE verifier (high-entropy base64url string).
 * @property codeChallenge - PKCE S256 challenge derived from verifier.
 * @property state - CSRF state value for the authorize request.
 * @property nonce - OIDC nonce for id_token validation.
 */
export interface PKCEBundle {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  nonce: string;
}

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
export const generatePKCE = async (options?: {
  state?: string;
  codeVerifier?: string;
  nonce?: string;
}): Promise<PKCEBundle> => {
  const codeVerifier = options?.codeVerifier ?? randomString(96);
  const codeChallenge = await codeChallengeForVerifier(codeVerifier);
  const state = options?.state ?? randomString(32);
  const nonce = options?.nonce ?? randomString(32);
  return { codeVerifier, codeChallenge, state, nonce };
};

/**
 * Input parameters for building an OAuth authorize URL.
 *
 * @remarks
 * Purpose:
 * - Supply required inputs for `/oauth/authorize` with PKCE and optional OIDC nonce.
 *
 * When to use:
 * - Use with buildAuthorizeUrl when you are orchestrating the OAuth redirect manually.
 *
 * When not to use:
 * - Prefer OAuthService or higher-level helpers when available.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `state` and `codeChallenge` must be non-empty strings.
 *
 * Data/auth references:
 * - `/oauth/authorize` parameters for OAuth authorize requests.
 *
 * @property baseUrl - OAuth protocol host (origin).
 * @property clientId - OAuth client identifier.
 * @property redirectUri - Redirect URI registered for the client.
 * @property scopes - Optional scopes (defaults apply when omitted).
 * @property state - CSRF state value.
 * @property codeChallenge - PKCE S256 challenge.
 * @property tenantSlug - Optional tenant slug for multi-tenant routing.
 * @property prompt - Optional OAuth prompt hint.
 * @property loginHint - Optional login hint.
 * @property nonce - Optional OIDC nonce (required for openid scope).
 */
export interface BuildAuthorizeUrlParams {
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  scopes?: Scope[];
  state: string;
  codeChallenge: string;
  tenantSlug?: string;
  prompt?: string;
  loginHint?: string;
  nonce?: string;
}

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
export const buildAuthorizeUrl = (params: BuildAuthorizeUrlParams): string => {
  const base = normalizeOAuthBaseUrl(params.baseUrl);
  const url = new URL(`${base}/oauth/authorize`);
  const scopes = normalizeScopes(params.scopes);
  const needsNonce = scopesRequireNonce(scopes);
  const nonce = normalizeNonce(params.nonce);
  if (needsNonce && !nonce) {
    throw new ValidationError(
      'nonce is required when openid scope is requested',
    );
  }
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('client_id', params.clientId);
  if (nonce) url.searchParams.set('nonce', nonce);
  if (params.tenantSlug) url.searchParams.set('tenant', params.tenantSlug);
  if (params.prompt) url.searchParams.set('prompt', params.prompt);
  if (params.loginHint) url.searchParams.set('login_hint', params.loginHint);
  return url.toString();
};

/**
 * Parsed OAuth callback parameters from an authorize redirect.
 *
 * @remarks
 * Purpose:
 * - Provide a normalized view of `code`, `state`, and error fields from the callback.
 *
 * When to use:
 * - Use as the return type of parseOAuthCallback in server or browser handlers.
 *
 * When not to use:
 * - Do not construct manually; rely on parseOAuthCallback for normalization.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Fields are undefined when not present in the callback.
 *
 * Data/auth references:
 * - OAuth authorize redirect query parameters.
 *
 * @property code - Authorization code (present on success).
 * @property state - Echoed state value (present on success).
 * @property error - OAuth error code (present on failure).
 * @property errorDescription - OAuth error description (present on failure).
 * @property errorUri - Optional error reference URI (present on failure).
 */
export interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  errorUri?: string;
}

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
export const parseOAuthCallback = (
  input: string | URL | URLSearchParams,
): OAuthCallbackParams => {
  let params: URLSearchParams;
  if (input instanceof URLSearchParams) {
    params = input;
  } else if (input instanceof URL) {
    params = input.searchParams;
  } else {
    const value = input.trim();
    const queryStart = value.indexOf('?');
    if (queryStart >= 0) {
      params = new URLSearchParams(value.slice(queryStart));
    } else if (value.includes('=')) {
      params = new URLSearchParams(`?${value}`);
    } else {
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
 * Parameters for exchanging an authorization code for tokens.
 *
 * @remarks
 * Purpose:
 * - Provide all inputs required for the OAuth `authorization_code` exchange.
 *
 * When to use:
 * - Use with exchangeAuthorizationCode when performing the OAuth callback step manually.
 *
 * When not to use:
 * - Prefer OAuthService.exchangeAuthorizationCode when using the SDK service layer.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `code` and `codeVerifier` must be non-empty strings.
 *
 * Data/auth references:
 * - `/oauth/token` authorization_code exchange parameters.
 *
 * @property baseUrl - OAuth protocol host (origin).
 * @property code - Authorization code from the callback.
 * @property codeVerifier - PKCE verifier created during authorization.
 * @property redirectUri - Redirect URI used during authorization.
 * @property clientId - OAuth client identifier.
 * @property clientSecret - Optional client secret for confidential clients.
 * @property nonce - Optional expected OIDC nonce.
 * @property clientAuthMethod - Optional client auth method override.
 * @property tokenEndpoint - Optional token endpoint override.
 * @property fetch - Optional fetch implementation.
 * @property timeoutMs - Optional total timeout budget.
 * @property attemptTimeoutMs - Optional per-attempt timeout.
 * @property retry - Optional retry policy.
 */
export interface ExchangeAuthorizationCodeParams {
  baseUrl: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
  nonce?: string;
  clientAuthMethod?: 'client_secret_post' | 'client_secret_basic';
  tokenEndpoint?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  attemptTimeoutMs?: number;
  retry?: RetryOptions;
}

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
export const exchangeAuthorizationCode = async (
  params: ExchangeAuthorizationCodeParams,
): Promise<TokenSet> => {
  const endpoint = params.tokenEndpoint ?? '/oauth/token';
  const base = normalizeOAuthBaseUrl(params.baseUrl);
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
  const fetchImpl =
    params.fetch ??
    ((...args: Parameters<typeof fetch>) => {
      const f = (globalThis as any).fetch as typeof fetch | undefined;
      if (!f) {
        throw new ValidationError('No fetch implementation available');
      }
      return f.apply(globalThis, args as any);
    });

  const retry = params.retry ?? { retries: 0 };
  const policy: RequestPolicy = {
    timeoutMs: params.timeoutMs ?? 30_000,
    attemptTimeoutMs: params.attemptTimeoutMs ?? 10_000,
    retry: { ...retry, retries: retry.retries ?? 0 },
  };

  const clientAuthMethod =
    params.clientAuthMethod ?? 'client_secret_post';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const bodyPayload: Record<string, string> = {
    grant_type: 'authorization_code',
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
  };
  if (params.clientSecret) {
    if (clientAuthMethod === 'client_secret_basic') {
      headers.Authorization = buildBasicAuthHeader(
        params.clientId,
        params.clientSecret,
      );
    } else {
      bodyPayload.client_secret = params.clientSecret;
    }
  }

  // OAuth token exchange is the only protocol-level exception to APIClient usage.
  const response = await fetchWithPolicy(
    fetchImpl,
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
    },
    policy,
  );

  const tokens = await parseTokenResponse(response);
  const expectedNonce = normalizeNonce(params.nonce);
  assertIdTokenNonce(tokens, expectedNonce);
  return tokens;
};

/**
 * Options for configuring the OAuthService instance.
 *
 * @remarks
 * Purpose:
 * - Configure OAuth endpoints, storage, retry/timeouts, and credentials.
 *
 * When to use:
 * - Use when instantiating OAuthService.
 *
 * When not to use:
 * - Avoid passing client secrets from browser-only contexts.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `baseUrl` must be a valid OAuth protocol host.
 *
 * Data/auth references:
 * - Used to configure `/oauth/authorize`, `/oauth/token`, and bootstrap calls.
 *
 * Security notes:
 * - `clientSecret` and refresh tokens should remain server-side.
 * - Storage may persist tokens depending on the adapter; treat contents as sensitive.
 *
 * Runtime constraints:
 * - Works in browser and Node.js when a compatible `fetch` and storage adapter are provided.
 */
export interface OAuthServiceOptions extends SDKConfig {
  storage?: AuthStorage;
  environment?: 'test' | 'production' | 'auto';
  tenantId?: string;
  /**
   * Total timeout budget for the whole request (including retries/backoff), in ms.
   * Default: 30000.
   */
  timeoutMs?: number;
  /**
   * Per-attempt timeout in ms. Default: 10000.
   */
  attemptTimeoutMs?: number;
  /**
   * Retry policy (idempotent-only by default). Default: { retries: 2, backoffMs: 300 }.
   */
  retry?: RetryOptions;
  /**
   * Optional observability hooks. No logging is performed by default.
   */
  telemetry?: SDKTelemetry;
}

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
  constructor(private clockSkewSeconds = 30) {}

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
  isExpired(tokens: TokenSet | null): boolean {
    if (!tokens) return true;
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
  assertScopes(tokens: TokenSet | null, required: Scope | Scope[]) {
    if (!tokens) throw new UnauthorizedError('No active token');
    const requiredList = Array.isArray(required) ? required : [required];
    const missing = requiredList.filter(
      (scope) => !tokens.scope.includes(scope),
    );
    if (missing.length > 0) {
      throw new UnauthorizedError(
        `Missing required scopes: ${missing.join(', ')}`,
      );
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
  private storage: AuthStorage;
  private validator = new TokenValidationService();
  private tokenEndpoint: string;
  private userEndpoint: string;
  private tenantEndpoint: string;
  private baseUrl: string;
  private fetchImpl: typeof fetch;
  private clientId?: string;
  private clientSecret?: string;
  private clientAuthMethod: 'client_secret_post' | 'client_secret_basic';
  private accountEndpoint = '/account';
  private environment: 'test' | 'production' | 'auto';
  private requestPolicy: RequestPolicy;
  private telemetry?: SDKTelemetry;

  constructor(options: OAuthServiceOptions) {
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
        const f = (globalThis as any).fetch;
        return f.apply(globalThis, args as any);
      });
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.clientAuthMethod = options.clientAuthMethod ?? 'client_secret_post';
    this.requestPolicy = {
      timeoutMs: options.timeoutMs ?? 30_000,
      attemptTimeoutMs: options.attemptTimeoutMs ?? 10_000,
      retry: options.retry,
    };
    this.telemetry = options.telemetry;
  }

  private createOAuthClient(accessToken: string): APIClient {
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

  private async fetchWithObservability(
    url: string,
    init: RequestInit & { method: string },
    opts?: {
      requestId?: string;
      policy?: RequestPolicy;
      redactBody?: unknown;
    },
  ): Promise<{ response: Response; requestId: string; serverRequestId: string | null; startedAt: number }> {
    const headers: Record<string, string> = {};
    // Normalize headers to a mutable record while preserving passed values.
    if (init.headers) {
      const h = init.headers as any;
      if (typeof h.forEach === "function") {
        (h as Headers).forEach((v, k) => (headers[k] = v));
      } else if (Array.isArray(h)) {
        for (const [k, v] of h) headers[k] = v;
      } else {
        Object.assign(headers, h);
      }
    }

    const requestId = opts?.requestId ?? headers["x-request-id"] ?? headers["X-Request-ID"] ?? generateRequestId();
    headers["x-request-id"] = requestId;

    const startedAt = Date.now();
    const redactor = this.telemetry?.redact ?? ((i: any) => defaultRedact(i));
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

    let response: Response;
    try {
      response = await fetchWithPolicy(
        this.fetchImpl,
        url,
        { ...init, headers },
        {
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
        },
      );
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const meta: SDKErrorMeta = { requestId, url, method: init.method };
      if ((err as any)?.name === "AbortError") {
        const abortedByCaller = (init.signal as any)?.aborted === true;
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
  async getTokens(): Promise<TokenSet | null> {
    return this.storage.read<TokenSet>(TOKEN_KEY);
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
  async logout(params?: {
    postLogoutRedirectUri?: string;
    clientId?: string;
    useRedirect?: boolean;
  }) {
    await this.clearTokens();
  }

  /** Fetches bootstrap data from `/oauth/user` + `/oauth/tenant` using the current access token. */
  async fetchBootstrap(
    tokens?: TokenSet | null,
    signal?: AbortSignal,
  ): Promise<BootstrapPayload> {
    const activeTokens = tokens ?? (await this.getTokens());
    if (!activeTokens)
      throw new UnauthorizedError('Cannot fetch bootstrap without tokens');

    const client = this.createOAuthClient(activeTokens.accessToken);

    const userPayload = await client.get<UserInfo>(this.userEndpoint, signal);
    const tenantPayload = await client.get<TenantConfig>(
      this.tenantEndpoint,
      signal,
    );

    let accountState: AccountState | null = null;
    try {
      const raw = await client.get<AccountState>(this.accountEndpoint, signal);
      accountState = mapAccountState(raw);
    } catch {
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
  async refreshTokensIfNeeded(
    force: boolean = false,
    signal?: AbortSignal,
  ): Promise<TokenSet | null> {
    const current = await this.getTokens();
    if (!current) return null;
    const isExpired = this.validator.isExpired(current);
    if (!force && !isExpired) return current;

    // Try refresh token first (confidential clients)
    if (current.refreshToken && this.clientId) {
      try {
        const refreshed = await this.refreshWithRefreshToken(
          current.refreshToken,
          signal,
        );
        return refreshed;
      } catch {
        if (!isExpired) return current;
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
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getTokens();
    if (!tokens) return false;
    return !this.validator.isExpired(tokens);
  }

  private async refreshWithRefreshToken(
    refreshToken: string,
    signal?: AbortSignal,
  ): Promise<TokenSet> {
    const clientId = this.clientId;
    const clientSecret = this.clientSecret;
    if (!clientId) {
      throw new ValidationError('clientId is required to refresh tokens');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const bodyPayload: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    };
    if (clientSecret) {
      if (this.clientAuthMethod === 'client_secret_basic') {
        headers.Authorization = buildBasicAuthHeader(clientId, clientSecret);
      } else {
        bodyPayload.client_secret = clientSecret;
      }
    }

    // OAuth token refresh is a protocol-level exception to APIClient usage.
    const { response } = await this.fetchWithObservability(
      this.urlFor(this.tokenEndpoint),
      {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify(bodyPayload),
      },
      {
        policy: { ...this.requestPolicy, retry: { ...(this.requestPolicy.retry ?? {}), retries: 0 } },
        redactBody: { grant_type: "refresh_token" },
      },
    );

    return this.handleTokenResponse(response);
  }

  /** Utility to generate a full URL from a base-relative endpoint. */
  private urlFor(endpoint: string) {
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
  private async handleTokenResponse(response: Response): Promise<TokenSet> {
    const tokens = await parseTokenResponse(response);
    await this.storage.write(TOKEN_KEY, tokens);
    return tokens;
  }
}

const parseTokenResponse = async (response: Response): Promise<TokenSet> => {
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
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


const mapAccountDescriptor = (payload: any): AccountDescriptor => ({
  name: payload?.name ?? '',
  kind: payload?.kind ?? 'account',
  account: payload?.account ?? '',
  providerInstanceId: payload?.provider_instance_id ?? null,
  aaProviderMetadata: payload?.aa_provider_metadata ?? {},
  metadata: payload?.metadata ?? {},
});

const mapUserResponse = (payload: any): UserInfo => ({
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
export const mapTenantResponse = (payload: any): TenantConfig => {
  const authDomain = (() => {
    const raw =
      typeof payload?.auth_domain === "string"
        ? payload.auth_domain
        : typeof payload?.authDomain === "string"
          ? payload.authDomain
          : null;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed.length > 0 ? trimmed : null;
  })();

  const mapNetwork = (n: any): TenantNetwork => {
    const networkIdRaw = n?.network_id ?? n?.networkId;
    return {
      id: n?.id ?? '',
      name: n?.name ?? '',
      symbol: n?.symbol ?? undefined,
      networkId:
        networkIdRaw !== undefined && networkIdRaw !== null
          ? String(networkIdRaw)
          : '',
      networkFamily: n?.network_family ?? n?.networkFamily,
      accountFormat: n?.account_format ?? n?.accountFormat,
      rpcUrl:
        n?.rpc_url ??
        n?.rpcUrl ??
        n?.rpcs?.find?.((r: any) => r.is_primary)?.url ??
        n?.rpcs?.[0]?.url,
      rpcs: n?.rpcs ?? undefined,
      explorerUrl: n?.explorer_url ?? n?.explorerUrl ?? null,
      isTestnet: n?.is_testnet ?? n?.testnet ?? false,
      nativeCurrency: n?.native_currency ?? n?.nativeCurrency,
      nativeCurrencySymbol: n?.native_currency_symbol ?? n?.nativeCurrencySymbol,
      nativeCurrencyDecimals:
        n?.native_currency_decimals ?? n?.nativeCurrencyDecimals,
      nativeTokenStandard: n?.native_token_standard ?? n?.nativeTokenStandard,
      logoUrl: n?.logo_url ?? n?.logoUrl ?? null,
      pendingPaymentsContract:
        n?.pending_payments_contract ?? n?.pendingPaymentsContract ?? null,
    };
  };

  const mapToken = (t: any): TokenAsset => {
    const networkIdRaw = t?.network_id ?? t?.networkId;
    return {
      id: t?.id,
      contract: t?.contract ?? null,
      networkId:
        networkIdRaw !== undefined && networkIdRaw !== null
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

  const mapTransferProvider = (p: any): TransferProvider => {
    const provider = p?.provider ?? {};
    const contracts = Array.isArray(p?.contracts) ? p.contracts : [];
    const faucetContractEntry = contracts.find(
      (c: any) => (c?.contract_type ?? c?.contractType) === 'faucet',
    );
    const faucetContract =
      p?.config_metadata?.faucetContract ?? faucetContractEntry?.contract ?? null;

    const faucetNetworkIdRaw =
      faucetContractEntry?.network_id ?? faucetContractEntry?.networkId;
    const faucetNetworkId =
      faucetNetworkIdRaw !== undefined && faucetNetworkIdRaw !== null
        ? Number(faucetNetworkIdRaw)
        : undefined;

    const supportedTypesRaw =
      provider?.supported_types ??
      provider?.supportedTypes ??
      (typeof provider?.type === 'string' ? [provider.type] : []);
    const normalizeTransferType = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const lower = value.toLowerCase();
      if (lower === 'onramp') return 'deposit';
      if (lower === 'offramp') return 'withdraw';
      return lower;
    };
    const supportedTypes = Array.isArray(supportedTypesRaw)
      ? supportedTypesRaw
          .map(normalizeTransferType)
          .filter((value): value is string => Boolean(value))
      : [];
    const supportedPaymentMethods =
      provider?.supported_payment_methods ?? provider?.supportedPaymentMethods ?? [];
    const supportedCrypto =
      provider?.supported_crypto ?? provider?.supportedCrypto ?? [];

    const minAmountUsdRaw =
      p?.custom_min_amount_usd ?? provider?.min_amount_usd ?? provider?.minAmountUsd;
    const maxAmountUsdRaw =
      p?.custom_max_amount_usd ?? provider?.max_amount_usd ?? provider?.maxAmountUsd;
    const baseFeePercentRaw =
      p?.custom_fee_percent ?? provider?.base_fee_percent ?? provider?.baseFeePercent;

    return {
      id: provider.id ?? p?.provider_id ?? p?.id,
      providerId: provider.id ?? p?.provider_id,
      configId: p?.id,
      name: p?.custom_name ?? provider.name,
      logoUrl: p?.custom_logo_url ?? provider.logo_url ?? null,
      integrationMethod:
        provider.type ??
        p?.config_metadata?.integrationMethod ??
        p?.config_metadata?.integration_method,
      supportedTypes,
      supportedPaymentMethods: Array.isArray(supportedPaymentMethods)
        ? supportedPaymentMethods
        : [],
      supportedCrypto: Array.isArray(supportedCrypto) ? supportedCrypto : [],
      minAmountUsd:
        minAmountUsdRaw !== undefined && minAmountUsdRaw !== null
          ? Number(minAmountUsdRaw)
          : undefined,
      maxAmountUsd:
        maxAmountUsdRaw !== undefined && maxAmountUsdRaw !== null
          ? Number(maxAmountUsdRaw)
          : undefined,
      baseFeePercent:
        baseFeePercentRaw !== undefined && baseFeePercentRaw !== null
          ? Number(baseFeePercentRaw)
          : undefined,
      websiteUrl: provider?.website_url ?? provider?.websiteUrl ?? null,
      faucetContract,
      networkId: faucetNetworkId,
      supportedNetworks: contracts
        .map((c: any) => c?.network_id ?? c?.networkId)
        .filter((id: any) => id !== undefined && id !== null)
        .map((id: any) => ({ networkId: Number(id) })),
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
    environment:
      payload?.environment === 'test'
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

const mapAccountState = (payload: any): AccountState => ({
  account: mapAccountDescriptor(payload?.account ?? {}),
});
