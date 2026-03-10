import { APIClient, type APIClientOptions } from "./api-client.js";
import { type IeeOrchestrator } from "./iee-orchestration.js";
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
export declare const createApiClientsFromHosts: (options: HeadlessClientOptions) => {
    api: APIClient;
    auth: APIClient;
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
export declare const createServicesFromHosts: (options: HeadlessClientOptions & {
    iee?: IeeOrchestrator;
}) => {
    contacts: import("./services.js").ContactsService;
    transfers: import("./services.js").TransfersService;
    transactions: import("./services.js").TransactionHistoryService;
    account: import("./services.js").AccountService;
    tenantConfig: import("./services.js").TenantConfigService;
    userProfile: import("./services.js").UserProfileService;
    iee: import("./services.js").IeeService;
    sessions: import("./services.js").SessionManagementService;
    marketplace: import("./services.js").MarketplaceCatalogService;
    agentActions: import("./services.js").AgentActionsService;
};
