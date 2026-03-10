# @xkova/sdk-core

Headless (non-React) SDK for XKOVA OAuth and apps/api. This package provides typed services, OAuth helpers, transport utilities, and network helpers for server or headless browser integrations.

## Install

```bash
pnpm add @xkova/sdk-core
# or npm install @xkova/sdk-core
```

## Requirements

- ESM-only package.
- Minimum supported Node version: 20+.
- CJS consumers must use dynamic `import()`.

## Base URL model (explicit hosts)

The SDK uses two different hosts and they must not be confused:

- **OAuth base URL**: OAuth protocol host origin (no path). Example: `https://auth.xkova.com`.
- **Apps API host**: apps/api host origin (no path). Example: `https://api.xkova.com`.

Headless helpers **require explicit hosts**. They do not auto-default the API host.

### Safe apps/api base URL

```ts
import { resolveApiBaseUrl } from "@xkova/sdk-core";

const apiBaseUrl = resolveApiBaseUrl({
  apiHost: "https://api.xkova.com",
  // apiVersion defaults to API_VERSION (v1)
});
// -> https://api.xkova.com/api/v1
```

## Headless services (recommended)

```ts
import { createServicesFromHosts } from "@xkova/sdk-core";

const services = createServicesFromHosts({
  oauthBaseUrl: process.env.XKOVA_BASE_URL!,
  apiHost: process.env.XKOVA_API_URL!,
  getAccessToken: async () => accessToken,
});

const profile = await services.userProfile.updateProfile({
  firstName: "New",
  lastName: "Name",
});
```

If you only need raw clients:

```ts
import { createApiClientsFromHosts } from "@xkova/sdk-core";

const { api, auth } = createApiClientsFromHosts({
  oauthBaseUrl: process.env.XKOVA_BASE_URL!,
  apiHost: process.env.XKOVA_API_URL!,
  getAccessToken: async () => accessToken,
});
```

## Agent install questions (headless)

Headless apps should fetch the question schema, validate inputs locally, and then pass
`installInputs` + `installQuestionsVersion` into the install request.

```ts
import {
  createServicesFromHosts,
  normalizeInstallInputs,
} from "@xkova/sdk-core";

const services = createServicesFromHosts({
  oauthBaseUrl: process.env.XKOVA_BASE_URL!,
  apiHost: process.env.XKOVA_API_URL!,
  getAccessToken: async () => accessToken,
});

const catalog = await services.marketplace.listTenantAgents();
const agent = catalog.find((a) => a.agentServiceId === targetAgentId);
if (!agent || !agent.installQuestions?.length) {
  throw new Error("Agent has no install questions");
}

const userInputs = {
  amount_usdc: "10",
};

const validation = normalizeInstallInputs(agent.installQuestions, userInputs, {
  mode: "install",
});

if (Object.keys(validation.errors).length > 0) {
  throw new Error(`Invalid inputs: ${JSON.stringify(validation.errors)}`);
}

await services.agents.prepareInstallation({
  agentServiceId: agent.agentServiceId,
  budget: "1000000",
  permissions: [],
  installInputs: validation.normalized,
  installQuestionsVersion: agent.installQuestionsVersion ?? null,
});
```

Updating a live installation uses the same validation helper:

```ts
const update = normalizeInstallInputs(agent.installQuestions, userInputs, {
  mode: "update",
  existingInputs: installation.installInputs ?? {},
});

if (Object.keys(update.errors).length === 0) {
  await services.agents.updateInstallationConfig(
    installation.installationId,
    update.normalized,
    { installQuestionsVersion: installation.installQuestionsVersion ?? null },
  );
}
```

## APIClient (direct)

```ts
import { APIClient, resolveApiBaseUrl } from "@xkova/sdk-core";

const api = new APIClient({
  baseUrl: resolveApiBaseUrl({ apiHost: "https://api.xkova.com" }),
  getAccessToken: async () => accessToken,
});

const profile = await api.get("/profile");
```

**Warning:** `APIClient` never injects `X-XKOVA-IEE-Receipt`. For write operations in third-party apps, use the orchestrated services (with `IeeOrchestrator`) or pass the receipt header manually.

## Headless IEE (SafeApprove) receipts (non-React)

An IEE (SafeApprove) receipt is a signed approval artifact returned by the oauth-server IEE (SafeApprove) UI. It is required for receipt-gated write operations (methods that mention “Requires an IEE (SafeApprove) receipt header” in their JSDoc). The SDK sends the receipt in the `X-XKOVA-IEE-Receipt` header.

Non-React flows must obtain the receipt in a browser and pass it explicitly into headless service calls.

```ts
import { APIClient, createServicesFromHosts, IeeOrchestrator } from "@xkova/sdk-core";
import { createBrowserIeeReceiptProvider } from "@xkova/sdk-browser";

// Browser-only: requires window/document + postMessage.
const authApi = new APIClient({
  baseUrl: "https://auth.example.com",
  getAccessToken: async () => accessToken,
});

const receiptProvider = createBrowserIeeReceiptProvider({
  ieeUrl: "https://auth.example.com/iee",
  authApi,
});

const iee = new IeeOrchestrator({
  receiptProvider,
  contextProvider: () => ({
    tenantId,
    clientId,
    userId,
  }),
});

const services = createServicesFromHosts({
  oauthBaseUrl: "https://auth.example.com",
  apiHost: "https://api.example.com",
  getAccessToken: async () => accessToken,
});

// Acquire a receipt and pass it into the headless call.
const approval = await iee.ensureReceipt({
  actionType: "contact_create",
  payload: { email: "user@example.com", name: "Jane Doe" },
});

await services.contacts.createContact(
  { email: "user@example.com", name: "Jane Doe" },
  { receipt: approval.receipt },
);
```

Notes:
- `createBrowserIeeReceiptProvider` is browser-only; Node/SSR must obtain receipts elsewhere and pass them explicitly.
- The `contextProvider` must return `tenantId`, `clientId`, and `userId` so the IEE (SafeApprove) flow can bind the receipt.
- Alternatively, pass `iee` into `createServicesFromHosts` to let services auto-request receipts.

### Headless IEE (SafeApprove): Complete Example

Every SDK write method that mutates user state (send payment, create contact, install agent, etc.)
requires an IEE (SafeApprove) receipt in third-party contexts. In React, this is handled automatically.
In headless mode, you have two options:

#### Option A: Pass receipts explicitly

If you already have a receipt (e.g., from your own approval UI), pass it directly:

```typescript
import { createServicesFromHosts } from "@xkova/sdk-core";

const { sendPayments } = createServicesFromHosts({
  oauthBaseUrl: process.env.XKOVA_BASE_URL!,
  apiHost: process.env.XKOVA_API_URL!,
  getAccessToken: () => myTokenStore.getToken(),
});

// Pass the receipt you obtained from your approval flow
await sendPayments.submitSendPayment(paymentInput, {
  receipt: myReceipt,
});
```

#### Option B: Use IeeOrchestrator with a custom receipt provider

For browser-based headless apps (vanilla JS, Vue, Svelte, etc.),
use `createBrowserIeeReceiptProvider` from `@xkova/sdk-browser`:

```typescript
import { createServicesFromHosts, IeeOrchestrator } from "@xkova/sdk-core";
import { createBrowserIeeReceiptProvider } from "@xkova/sdk-browser";

const iee = new IeeOrchestrator({
  receiptProvider: createBrowserIeeReceiptProvider({
    ieeBaseUrl: process.env.XKOVA_BASE_URL!,
  }),
  contextProvider: () => ({
    tenantId: myApp.tenantId,
    clientId: myApp.clientId,
    userId: myApp.userId,
  }),
});

const { sendPayments } = createServicesFromHosts({
  oauthBaseUrl: process.env.XKOVA_BASE_URL!,
  apiHost: process.env.XKOVA_API_URL!,
  getAccessToken: () => myTokenStore.getToken(),
  iee,  // Services will use this orchestrator automatically
});

// No explicit receipt needed - orchestrator opens approval popup
await sendPayments.submitSendPayment(paymentInput);
```

The browser receipt provider opens an iframe/popup to the IEE (SafeApprove) approval page,
waits for user approval via `postMessage`, and returns the signed receipt.

#### IEE (SafeApprove) error handling

If the user cancels or the receipt fails, an `IeeError` is thrown:

```typescript
import { IeeError } from "@xkova/sdk-core";

try {
  await sendPayments.submitSendPayment(input);
} catch (err) {
  if (err instanceof IeeError) {
    switch (err.code) {
      case "IEE_CANCELLED": // User cancelled approval
      case "IEE_REQUIRED":  // No receipt provider configured
      case "IEE_FAILED":    // Receipt verification failed server-side
    }
  }
}
```

## OAuth helpers

```ts
import { buildAuthorizeUrl, exchangeAuthorizationCode, generatePKCE } from "@xkova/sdk-core";

const pkce = await generatePKCE();
const authorizeUrl = buildAuthorizeUrl({
  baseUrl: process.env.XKOVA_BASE_URL!,
  clientId: process.env.XKOVA_CLIENT_ID!,
  redirectUri: process.env.XKOVA_REDIRECT_URI!,
  scopes: ["openid", "profile", "email", "offline_access", "account:read"],
  state: pkce.state,
  codeChallenge: pkce.codeChallenge,
});

const tokens = await exchangeAuthorizationCode({
  baseUrl: process.env.XKOVA_BASE_URL!,
  clientId: process.env.XKOVA_CLIENT_ID!,
  clientSecret: process.env.XKOVA_CLIENT_SECRET!,
  code,
  codeVerifier: pkce.codeVerifier,
  redirectUri: process.env.XKOVA_REDIRECT_URI!,
});
```

## Transport rule (headless)

- **Default:** use `APIClient` for HTTP calls.
- **Exception:** OAuth token exchange (`exchangeAuthorizationCode`, refresh token flows) uses `fetchWithPolicy` directly as a protocol-level helper.

## Retry-After (opt-in)

`fetchWithPolicy` and `APIClient` use backoff-only retries by default. To honor `Retry-After`:

```ts
const api = new APIClient({
  baseUrl: resolveApiBaseUrl({ apiHost: "https://api.xkova.com" }),
  retry: { respectRetryAfter: true },
});
```

## Export Catalog

### Root (`@xkova/sdk-core`)

#### OAuth + PKCE
- `Scope` — OAuth scope string type.
- `DEFAULT_SCOPES` — default OAuth scopes used by helpers.
- `PKCEBundle` — PKCE bundle produced by `generatePKCE`.
- `generatePKCE` — create a PKCE verifier/challenge/state bundle.
- `BuildAuthorizeUrlParams` — parameters for `buildAuthorizeUrl`.
- `buildAuthorizeUrl` — build `/oauth/authorize` URLs.
- `OAuthCallbackParams` — parameters for `parseOAuthCallback`.
- `parseOAuthCallback` — parse OAuth redirect callback parameters.
- `ExchangeAuthorizationCodeParams` — parameters for `exchangeAuthorizationCode`.
- `exchangeAuthorizationCode` — exchange an authorization code for tokens.
- `OAuthServiceOptions` — configuration for `OAuthService`.
- `TokenValidationService` — server-side token validation helper.
- `OAuthService` — OAuth client for bootstrap, token exchange, and session flows.

#### Auth + session types
- `SDKConfig` — base OAuth SDK configuration shape.
- `AuthState` — auth state exposed by SDK providers.
- `TokenSet` — access/refresh token bundle.
- `UserInfo` — user profile/identity payload.
- `UserSession` — session DTO.
- `UserSessionListResult` — list response for sessions.
- `RevokeUserSessionResult` — result for revoking a session.
- `RevokeOtherSessionsResult` — result for revoking other sessions.
- `SessionDeviceType` — device type union.
- `SessionDeviceInfo` — device metadata.
- `SessionLocationInfo` — location metadata.
- `SessionActivityInfo` — session activity metadata.
- `SessionSecurityInfo` — session security metadata.
- `SessionVerificationResult` — bootstrap verification payload.

#### Account + tenant
- `AccountKind` — account kind literal.
- `AccountDescriptor` — account descriptor payload.
- `AccountState` — account state payload.
- `TenantBranding` — tenant branding metadata.
- `TenantNetwork` — tenant network metadata.
- `TenantConfig` — tenant config payload.
- `BootstrapPayload` — bootstrap response payload.
- `UpdateProfileInput` — input for profile updates.
- `AccountService` — account metadata service (oauth-server).
- `TenantConfigService` — tenant config service (oauth-server).
- `UserProfileService` — user profile service (oauth-server).
- `SessionManagementService` — session list/revoke service (oauth-server).

#### Contacts
- `Contact` — contact DTO.
- `CreateContactInput` — input for contact creation.
- `UpdateContactInput` — input for contact updates.
- `ContactsListQuery` — list filter options.
- `ContactsListResponse` — list response.
- `DeleteContactResult` — delete response.
- `BulkContactsOperation` — supported bulk operations.
- `BulkContactsOperationInput` — bulk operation input.
- `BulkContactsOperationResult` — bulk operation result.
- `ContactsService` — contacts service (apps/api).

#### Transfers + assets
- `TokenAsset` — token metadata.
- `TransferProvider` — transfer provider metadata.
- `TransferTransactionType` — transfer type union.
- `TransferTransactionStatus` — transfer status union.
- `TransferPaymentMethod` — transfer payment method union.
- `TransferTransaction` — transfer transaction DTO.
- `TransferTransactionsQuery` — transfer list query.
- `TransferTransactionsListResult` — transfer list response.
- `CreateTransferTransactionInput` — input for creating transfer transactions.
- `ExecuteFaucetTransferInput` — input for executing faucet transfers.
- `UpdateTransferTransactionInput` — input for updating transfer transactions.
- `TransfersService` — transfer transactions service (apps/api).

#### Transactions + history
- `TransactionStatus` — transaction status union.
- `TransactionEventType` — transaction event union.
- `TransactionExecutionMethod` — execution method union.
- `TransactionDirection` — transaction direction union.
- `TransactionCategory` — transaction category union.
- `TransactionHistoryItem` — transaction history item DTO.
- `TransactionHistoryResponse` — transaction history response.
- `TransactionHistoryParams` — query parameters for transaction history.
- `TransactionHistoryService` — transaction history service (apps/api).
- `formatTransactionAmount` — format transaction amounts for display.

#### Payments
- `SendPayment` — send-payment DTO.
- `SendPaymentsQuery` — send-payment list query.
- `SendPaymentsListResult` — send-payment list response.
- `SendPaymentsService` — send-payment service (apps/api).
- `PaymentRequest` — payment request DTO.
- `PaymentRequestsQuery` — payment request list query.
- `PaymentRequestsListResponse` — payment request list response.
- `PaymentRequestsService` — payment request service (apps/api).

#### Agents
- `AgentDescriptor` — agent descriptor payload.
- `AgentInstallation` — agent installation DTO.
- `AgentCategory` — agent category union.
- `MarketplaceAgent` — marketplace agent DTO.
- `AgentInstallationDetails` — installation detail payload.
- `UninstallAgentResult` — uninstall result payload.
- `AgentInstallationFailure` — installation failure record.
- `AgentInstallationFailuresResponse` — installation failures response.
- `AgentInstallationFailureCountResponse` — per-installation failure counts.
- `AgentInstallationFailureCountsResponse` — failure counts response.
- `PrepareInstallationRequest` — input for agent installation prepare.
- `PrepareInstallationResponse` — prepare response payload.
- `ConfirmInstallationRequest` — input for agent installation confirm.
- `ConfirmInstallationResponse` — confirm response payload.
- `MarketplaceCatalogService` — marketplace catalog service (oauth-server).
- `AgentActionsService` — agent install/budget actions service (oauth-server).
- `IssueInstallationTokenParams` — input for installation token issuance.
- `issueInstallationToken` — issue/refresh installation tokens.

#### Clients + factories + storage
- `APIClientOptions` — API client configuration.
- `APIClient` — HTTP client for oauth-server/apps/api.
- `HeadlessClientOptions` — headless host/client options.
- `createApiClientsFromHosts` — build API clients from explicit hosts.
- `createServicesFromHosts` — build services from explicit hosts.
- `createServices` — build all services from API clients.
- `AuthStorageAdapter` — storage adapter interface.
- `MemoryStorage` — in-memory storage adapter.
- `AuthStorage` — storage wrapper with namespacing.
- `createDefaultStorage` — in-memory AuthStorage factory.
- `API_BASE_URL` — default apps/api host constant.
- `API_VERSION` — default apps/api version constant.
- `normalizeApiHost` — normalize apps/api host.
- `resolveApiBaseUrl` — build apps/api base URL.

#### IEE (SafeApprove) orchestration
- `CANONICAL_SERVER_ACTION_TYPES` — canonical server action list.
- `CanonicalServerActionType` — server action type union.
- `SdkActionType` — SDK action type string.
- `IeeActionContext` — tenant/client/user context for IEE (SafeApprove).
- `IeeActionSpec` — IEE (SafeApprove) action mapping spec.
- `IeeReceiptProviderApproved` — approved receipt payload.
- `IeeReceiptProviderResult` — receipt provider result union.
- `IeeReceiptProviderParams` — receipt provider request params.
- `IeeReceiptProvider` — receipt provider interface.
- `IeeReceiptApproval` — approved receipt with SDK metadata.
- `IeeOrchestratorConfig` — orchestrator configuration.
- `resolveIeeActionSpec` — resolve action spec for an SDK/server action.
- `prepareIeeActionPayload` — normalize/validate IEE (SafeApprove) payloads.
- `IeeOrchestrator` — receipt orchestration helper.
- `iee` — convenience namespace for IEE (SafeApprove) helpers.
- `CreateIeePrepTicketInput` — input for IEE (SafeApprove) prep ticket issuance.
- `IeePrepTicket` — IEE (SafeApprove) prep ticket payload.
- `IeeService` — service for issuing IEE (SafeApprove) prep tickets.

#### Blockchain + RPC
- `NetworkClientConfig` — network client configuration.
- `EVMClient` — EVM client wrapper.
- `SmartAccountHandle` — smart account handle type.
- `createOAuthEOAAccount` — create an EOA via OAuth.
- `disconnectSmartAccount` — disconnect a smart account session.
- `reportSmartAccountToBackend` — report a smart account to backend.
- `installAgentPass` — install an agent pass on-chain.
- `reportAgentPassToBackend` — report an agent pass to backend.
- `getNativeTokenBalance` — fetch native token balance.
- `getErc20TokenBalance` — fetch ERC-20 token balance.
- `formatTokenAmount` — format token amounts for display.
- `parseTokenAmount` — parse human token amounts into bigint.
- `createTenantNetworkClient` — network client factory for tenant networks.
- `selectTenantNetwork` — select a tenant network from config.

#### HTTP helpers
- `RetryOptions` — retry configuration options.
- `RequestPolicy` — per-request policy options.
- `fetchWithPolicy` — fetch wrapper with retries/timeouts.

#### Errors
- `SDKErrorCode` — SDK error code union.
- `IeeErrorCode` — IEE (SafeApprove) error code union.
- `IeeErrorDetails` — IEE (SafeApprove) error detail payload.
- `SDKErrorMeta` — SDK error metadata.
- `SDKError` — base SDK error.
- `IeeError` — IEE (SafeApprove)-specific error.
- `NetworkError` — network error.
- `TimeoutError` — timeout error.
- `AbortedError` — aborted request error.
- `OAuthError` — OAuth error.
- `ValidationError` — validation error.
- `UnauthorizedError` — unauthorized error.
- `NotFoundError` — not-found error.
- `RateLimitedError` — rate-limited error.
- `ServerError` — server error.
- `BadResponseError` — bad-response error.

### Subpath exports

#### `@xkova/sdk-core/abis`
- `FaucetABI` — faucet contract ABI.

#### `@xkova/sdk-core/telemetry`
- `SDKTelemetryEventName` — telemetry event name union.
- `SDKTelemetryBase` — base telemetry payload.
- `SDKTelemetryRequest` — request telemetry payload.
- `SDKTelemetryResponse` — response telemetry payload.
- `SDKTelemetryRetry` — retry telemetry payload.
- `SDKTelemetryError` — error telemetry payload.
- `SDKTelemetryRedactor` — redaction function type.
- `SDKTelemetry` — telemetry interface for SDK clients.
- `generateRequestId` — create a request correlation id.
- `headersToRecord` — convert `Headers` to a record.
- `defaultRedact` — default redaction helper.

#### `@xkova/sdk-core/telemetry-adapters`
- `HeadlessErrorTelemetryEvent` — telemetry event payload for headless errors.
- `createHeadlessErrorTelemetryAdapter` — map SDK errors to telemetry events.
- `createConsoleTelemetry` — console-based telemetry adapter.
- `createOpenTelemetryTelemetry` — OpenTelemetry adapter.
- `createDatadogTraceTelemetry` — Datadog trace adapter.
- `createDatadogRumTelemetry` — Datadog RUM adapter.
- `createSentryTelemetry` — Sentry adapter.

#### `@xkova/sdk-core/node`
- `extractBearerToken` — parse `Authorization: Bearer` headers.
- `fetchBootstrapWithAccessToken` — fetch bootstrap using an access token.
- `createAccessTokenVerifier` — bind a token verifier for server routes.

## Error handling

Headless SDK surfaces throw `SDKError` subclasses with machine-readable `code` values.
Use `err instanceof SDKError` and `err.code` for control flow.

## Headless error policy / error codes

Headless integrations should treat `SDKError.code` as the primary contract. Common codes include:

- Transport: `network`, `timeout`, `aborted`, `rate_limited`, `server_error`
- Auth/validation: `unauthorized`, `oauth`, `validation`, `not_found`, `bad_response`
- IEE (SafeApprove) orchestration: `IEE_REQUIRED`, `IEE_CANCELLED`, `IEE_FAILED`, `IEE_ACTION_MAPPING_MISSING`, `THIRD_PARTY_ACTION_UNSUPPORTED`

Minimal handling example:

```ts
import { SDKError } from "@xkova/sdk-core";

try {
  await services.contacts.createContact({ email: "user@example.com", name: "Jane Doe" });
} catch (err) {
  if (err instanceof SDKError) {
    if (err.code === "IEE_REQUIRED") {
      // Browser receipt required: run an IEE flow or pass a receipt explicitly.
    }
    if (err.code === "THIRD_PARTY_ACTION_UNSUPPORTED") {
      // Block server-denied actions in third-party contexts.
    }
  }
  throw err;
}
```
