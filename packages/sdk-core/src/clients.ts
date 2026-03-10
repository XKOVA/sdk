import { APIClient, type APIClientOptions } from "./api-client.js";
import { resolveApiBaseUrl } from "./api-url.js";
import { type IeeOrchestrator } from "./iee-orchestration.js";
import { normalizeOAuthBaseUrl } from "./oauth.js";
import { createServices } from "./services.js";

/**
 * Headless client factory options for apps/api and oauth-server.
 *
 * @remarks
 * Purpose:
 * - Require explicit host origins and construct API clients with consistent policies.
 *
 * When to use:
 * - Use in headless or server-side integrations to avoid manual URL concatenation.
 *
 * When not to use:
 * - Do not use in React providers; use XKOVAProvider which resolves defaults.
 *
 * Parameters:
 * - `oauthBaseUrl`: OAuth protocol host (origin). Nullable: no.
 * - `apiHost`: apps/api host origin (no path). Nullable: no.
 * - `apiVersion`: Optional API version segment (defaults to API_VERSION). Nullable: yes.
 *
 * Return semantics:
 * - Options shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None at the type level; runtime errors occur during normalization.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Host values must be absolute URLs with no path (or /api[/vN] for apiHost).
 */
export type HeadlessClientOptions = Omit<APIClientOptions, "baseUrl"> & {
  oauthBaseUrl: string;
  apiHost: string;
  apiVersion?: string;
};

/**
 * Create API clients for apps/api and oauth-server using explicit host origins.
 *
 * @remarks
 * Purpose:
 * - Provide a safe, explicit factory for headless environments.
 *
 * When to use:
 * - Use to construct APIClient instances without manual base URL concatenation.
 *
 * When not to use:
 * - Do not call without explicit host origins; defaults are not applied here.
 *
 * Parameters:
 * - `options`: HeadlessClientOptions. Nullable: no.
 *
 * Return semantics:
 * - Returns `{ api, auth }` APIClient instances.
 *
 * Errors/failure modes:
 * - Throws ValidationError when the provided hosts are invalid.
 *
 * Side effects:
 * - None; clients are lazy until used.
 *
 * Invariants/assumptions:
 * - apps/api base URL always includes `/api/{version}`.
 */
export const createApiClientsFromHosts = (options: HeadlessClientOptions) => {
  const apiBaseUrl = resolveApiBaseUrl({
    apiHost: options.apiHost,
    apiVersion: options.apiVersion,
  });
  const oauthBaseUrl = normalizeOAuthBaseUrl(options.oauthBaseUrl);

  const shared: Omit<APIClientOptions, "baseUrl"> = {
    fetch: options.fetch,
    timeoutMs: options.timeoutMs,
    attemptTimeoutMs: options.attemptTimeoutMs,
    retry: options.retry,
    telemetry: options.telemetry,
    getAccessToken: options.getAccessToken,
    onUnauthorized: options.onUnauthorized,
  };

  return {
    api: new APIClient({ baseUrl: apiBaseUrl, ...shared }),
    auth: new APIClient({ baseUrl: oauthBaseUrl, ...shared }),
  };
};

/**
 * Create SDK services from explicit host origins.
 *
 * @remarks
 * Purpose:
 * - Provide a one-shot factory for headless integrations.
 *
 * When to use:
 * - Use when you need the full suite of typed services.
 *
 * When not to use:
 * - Avoid in React providers; use XKOVAProvider instead.
 *
 * Parameters:
 * - `options`: HeadlessClientOptions + optional IEE (SafeApprove) orchestrator. Nullable: no.
 *
 * Return semantics:
 * - Returns a services object with apps/api + oauth-server service instances.
 *
 * Errors/failure modes:
 * - Throws ValidationError when host normalization fails.
 *
 * Side effects:
 * - None during construction; network calls occur on method invocation.
 */
export const createServicesFromHosts = (
  options: HeadlessClientOptions & { iee?: IeeOrchestrator },
) => {
  const { api, auth } = createApiClientsFromHosts(options);
  return createServices({ api, auth, iee: options.iee });
};
