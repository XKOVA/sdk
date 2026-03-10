import { APIClient } from "./api-client.js";
import { resolveApiBaseUrl } from "./api-url.js";
import { normalizeOAuthBaseUrl } from "./oauth.js";
import { createServices } from "./services.js";
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
export const createApiClientsFromHosts = (options) => {
    const apiBaseUrl = resolveApiBaseUrl({
        apiHost: options.apiHost,
        apiVersion: options.apiVersion,
    });
    const oauthBaseUrl = normalizeOAuthBaseUrl(options.oauthBaseUrl);
    const shared = {
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
export const createServicesFromHosts = (options) => {
    const { api, auth } = createApiClientsFromHosts(options);
    return createServices({ api, auth, iee: options.iee });
};
