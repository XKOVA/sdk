# @xkova/sdk

Umbrella SDK package that exposes XKOVA core, React, UI, and Node entry points via stable subpath exports.

## Install

```bash
pnpm add @xkova/sdk
# or npm install @xkova/sdk
```

## Requirements

- ESM-only package.
- Minimum supported Node version: 20+.
- CJS consumers must use dynamic `import()`.

## Entry points

- `@xkova/sdk` (re-exports core/headless utilities)
- `@xkova/sdk/core`
- `@xkova/sdk/node`
- `@xkova/sdk/react`
- `@xkova/sdk/ui`
- `@xkova/sdk/ui/styles.css`
- `@xkova/sdk/browser`
- `@xkova/sdk/telemetry`
- `@xkova/sdk/telemetry-adapters`
- `@xkova/sdk/abis`

## React quick start

```tsx
import { XKOVAProvider } from "@xkova/sdk/react";
import { SignedIn, SignedOut, Human } from "@xkova/sdk/ui";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <XKOVAProvider>
          <SignedIn>{children}</SignedIn>
          <SignedOut>
            <Human mode="signin" label="Sign in to XKOVA" />
          </SignedOut>
        </XKOVAProvider>
      </body>
    </html>
  );
}
```

## Headless usage

```ts
import { createServicesFromHosts } from "@xkova/sdk";

const services = createServicesFromHosts({
  oauthBaseUrl: process.env.XKOVA_CORE_URL!,
  apiHost: process.env.XKOVA_CORE_URL!,
  getAccessToken: async () => accessToken,
});
```

## Export Catalog

### Root (`@xkova/sdk`)

#### OAuth + PKCE
- `Scope` — OAuth scope string type.
- `DEFAULT_SCOPES` — default OAuth scopes used by helpers.
- `PKCEBundle` — PKCE bundle produced by `generatePKCE`.
- `generatePKCE` — create a PKCE verifier/challenge/state bundle.
- `BuildAuthorizeUrlParams` — parameters for `buildAuthorizeUrl`.
- `buildAuthorizeUrl` — build `/auth/oauth/authorize` URLs.
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
- `AccountService` — account metadata service (core auth `/auth/*`).
- `TenantConfigService` — tenant config service (core auth `/auth/*`).
- `UserProfileService` — user profile service (core auth `/auth/*`).
- `SessionManagementService` — session list/revoke service (core auth `/auth/*`).

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
- `ContactsService` — contacts service (core API `/api/v1/*`).

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
- `TransfersService` — transfer transactions service (core API `/api/v1/*`).

#### Transactions + history
- `TransactionStatus` — transaction status union.
- `TransactionEventType` — transaction event union.
- `TransactionExecutionMethod` — execution method union.
- `TransactionDirection` — transaction direction union.
- `TransactionCategory` — transaction category union.
- `TransactionHistoryItem` — transaction history item DTO.
- `TransactionHistoryResponse` — transaction history response.
- `TransactionHistoryParams` — query parameters for transaction history.
- `TransactionHistoryService` — transaction history service (core API `/api/v1/*`).
- `formatTransactionAmount` — format transaction amounts for display.

#### Payments
- `SendPayment` — send-payment DTO.
- `SendPaymentsQuery` — send-payment list query.
- `SendPaymentsListResult` — send-payment list response.
- `SendPaymentsService` — send-payment service (core API `/api/v1/*`).
- `PaymentRequest` — payment request DTO.
- `PaymentRequestsQuery` — payment request list query.
- `PaymentRequestsListResponse` — payment request list response.
- `PaymentRequestsService` — payment request service (core API `/api/v1/*`).

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
- `MarketplaceCatalogService` — marketplace catalog service (core auth `/auth/*`).
- `AgentActionsService` — agent install/budget actions service (core auth `/auth/*`).
- `IssueInstallationTokenParams` — input for installation token issuance.
- `issueInstallationToken` — issue/refresh installation tokens.

#### Clients + factories + storage
- `APIClientOptions` — API client configuration.
- `APIClient` — HTTP client for core auth + core API.
- `HeadlessClientOptions` — headless host/client options.
- `createApiClientsFromHosts` — build API clients from explicit hosts.
- `createServicesFromHosts` — build services from explicit hosts.
- `createServices` — build all services from API clients.
- `AuthStorageAdapter` — storage adapter interface.
- `MemoryStorage` — in-memory storage adapter.
- `AuthStorage` — storage wrapper with namespacing.
- `createDefaultStorage` — in-memory AuthStorage factory.
- `API_BASE_URL` — default core host constant.
- `API_VERSION` — default API version constant.
- `normalizeApiHost` — normalize core API host.
- `resolveApiBaseUrl` — build core API base URL.

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

### `@xkova/sdk/core`
- Same exports as `@xkova/sdk` (core/headless surface).

### `@xkova/sdk/node`
- `extractBearerToken` — parse `Authorization: Bearer` headers.
- `fetchBootstrapWithAccessToken` — fetch bootstrap using an access token.
- `createAccessTokenVerifier` — bind a token verifier for server routes.

### `@xkova/sdk/react`

#### Provider + core utilities
- `XKOVAProvider` — React provider for SDK context (OAuth + API clients).
- `XKOVAProviderProps` — provider configuration type.
- `useSDK` — access SDK context, clients, and bootstrap state.
- `useAuth` — auth state plus environment/session metadata.
- `useIeeContext` — tenant/client/user IDs for IEE (SafeApprove) flows.
- `useIeeLauncher` — launch the IEE (SafeApprove) iframe and track status.
- `useIeeReceiptAction` — issue prep tickets + launch IEE (SafeApprove) to return receipts.
- `SDKResource` — resource key union for invalidation.
- `invalidateSDKResource` — emit a resource invalidation signal.
- `useResourceInvalidation` — subscribe to resource invalidation events.
- `normalizeTenantAuthBaseUrl` — normalize tenant auth domains to an origin.

#### Profile + sessions
- `useUserProfile` — load/update user profile data.
- `useUserSessions` — list and revoke user sessions.
- `useHostedEmailChange` — launch the hosted email-change UI.

#### Tenant + account
- `useTenantConfig` — read tenant bootstrap configuration.
- `useTenantReload` — reload tenant bootstrap data.
- `useAccountState` — read account state for the current user.

#### Human auth + balances
- `HumanAuthOptions` — options for `useHumanAuth`.
- `HumanAuthState` — state returned by `useHumanAuth`.
- `useHumanAuth` — human-facing auth flow helper.
- `HumanBalanceOptions` — options for `useHumanBalance`.
- `HumanBalanceDisplay` — display-ready balance payload.
- `HumanBalanceState` — state returned by `useHumanBalance`.
- `useHumanBalance` — aggregate human balance across accounts/tokens.

#### Token balances
- `TokenBalanceEntry` — token balance entry.
- `TokenBalancesOptions` — options for `useTokenBalances`.
- `TokenBalancesState` — state returned by `useTokenBalances`.
- `useTokenBalances` — fetch a list of token balances.
- `TokenBalanceSnapshot` — snapshot of a single token balance.
- `TokenBalanceOptions` — options for `useTokenBalance`.
- `TokenBalanceState` — state returned by `useTokenBalance`.
- `useTokenBalance` — fetch a single token balance.

#### Transfers + payments + transactions
- `useTransactionHistory` — fetch transaction history.
- `useTransactionHistory` supports `view="grouped"` (default, 1 row per agent transaction incl. fee-split) or `view="events"` (raw transfer rows).
- `useAccountTransactions` — account-scoped transaction history.
- `SendPayment` — send-payment DTO.
- `SubmitSendPaymentInput` — input for send-payment submission.
- `PaymentActionResult` — result shape for payment actions.
- `useSendPaymentHistory` — list send payments.
- `useSubmitSendPayment` — submit a send payment.
- `useCancelSendPayment` — cancel a send payment.
- `useRemindSendPayment` — remind a send payment.
- `useVerifySendPaymentTransaction` — verify send-payment transactions.
- `useCancelPendingPaymentOnchain` — cancel on-chain pending payments.
- `useTransferTransactions` — list transfer transactions.
- `useCreateTransferTransaction` — create transfer transactions.
- `useExecuteFaucetTransfer` — execute a faucet transfer.
- `useUpdateTransferTransaction` — update transfer transactions.
- `TransferProviderWidgetSession` — transfer provider widget session payload.
- `CreateTransferProviderWidgetSessionInput` — input for creating widget sessions.
- `useCreateTransferWidgetSession` — create transfer provider widget sessions.
- `PaymentRequest` — payment request DTO.
- `PaymentRequestActionResult` — result shape for payment request actions.
- `TransactionVerificationResult` — result of transaction verification.
- `PaymentRequestsListResponse` — payment request list response.
- `PendingPaymentRequestsInboxOptions` — options for pending request inbox queries.
- `CompletePaymentRequestInput` — input for completing (paying) a request.
- `PayPendingPaymentRequestOptions` — options for paying a pending request in-app.
- `PayPendingPaymentRequestResult` — result for paying a pending request in-app.
- `useIncomingPaymentRequestHistory` — list incoming payment requests.
- `usePendingPaymentRequestsInbox` — list pending incoming payment requests.
- `useOutgoingPaymentRequestHistory` — list outgoing payment requests.
- `useCreatePaymentRequest` — create a payment request.
- `useCompletePaymentRequest` — complete (pay) a payment request.
- `usePayPendingPaymentRequest` — pay a pending request in-app (send + complete).
- `useCancelPaymentRequest` — cancel a payment request.
- `useDeclinePaymentRequest` — decline a payment request.
- `useRemindPaymentRequest` — remind a payment request.
- `usePendingPaymentsContract` — resolve the pending payments contract for a network.

#### Contacts
- `useContacts` — list contacts.
- `useCreateContact` — create contacts.
- `useUpdateContact` — update contacts.
- `useDeleteContact` — delete contacts.

#### Agents + marketplace
- `useAgentInstallations` — deprecated legacy wrapper for agent catalog/installations.
- `useAgentTransactions` — agent-only transaction history.
- `useAgentInstallationsAndTransactions` — aggregate agent installs + transactions.
- `useMarketplaceAgents` — list tenant marketplace agents.
- `useMyAgentInstallations` — list the user’s installations + failure counts.
- `useAgentInstallationActions` — install/uninstall/budget actions.
- `useFaucets` — list tenant faucet providers.

### `@xkova/sdk/ui`

#### Cards + surfaces
- `AccountCard`, `AccountCardProps` — account summary card.
- `TenantCard` — tenant summary card.
- `BalanceCard`, `BalanceCardProps` — balances card.
- `TransfersCard`, `TransfersCardProps` — transfers card.
- `TransferActivityCard`, `TransferActivityCardProps` — transfer activity feed.
- `SendPaymentCard`, `SendPaymentCardProps` — send payment form.
- `TransactionsCard`, `TransactionsCardProps` — transaction history card.
- `PaymentHistoryCard`, `PaymentHistoryCardProps` — payment history card.
- `RequestPaymentCard`, `RequestPaymentCardProps` — create payment request card.
- `RequestHistoryCard` — payment request history card.
- `SessionManagerCard`, `SessionManagerCardProps` — session management card.
- `ContactsCard`, `ContactsCardProps` — contacts management card.
- `HumanIdentity`, `HumanIdentityProps` — human identity panel.

#### Agent UI
- `AgentMarketplaceCard`, `AgentMarketplaceCardProps` — marketplace agent card.
- `InstalledAgentsCard`, `InstalledAgentsCardProps` — installed agents list.
- `AgentInstallFlow`, `AgentInstallFlowProps` — agent install flow.
- `Agent`, `AgentProps` — single agent tile.

#### Auth gating
- `Human`, `HumanProps` — hosted sign-in/sign-up UI.
- `SignedIn` — render children when authenticated.
- `SignedOut` — render children when unauthenticated.

#### UI primitives
- `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent` — card building blocks.
- `CardHeaderRow`, `CardHeaderRowProps` — card header row layout.
- `CardSectionLabel`, `CardSectionLabelProps` — card section label layout.
- `CardEmptyState`, `CardEmptyStateProps` — empty state layout.
- `CardValue`, `CardValueProps` — value emphasis layout.
- `Button`, `ButtonProps`, `buttonVariants` — button component + variants.
- `Badge`, `BadgeProps`, `badgeVariants` — badge component + variants.
- `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` — table primitives.
- `Skeleton` — loading skeleton.
- `Input` — styled input component.
- `Select`, `SelectProps` — select input component.
- `SelectMenu`, `SelectMenuGroup`, `SelectMenuValue`, `SelectMenuTrigger`, `SelectMenuContent`, `SelectMenuLabel`, `SelectMenuItem`, `SelectMenuSeparator` — Radix select menu primitives.
- `Label` — form label component.
- `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogClose`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` — dialog primitives.
- `AlertDialog`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel` — alert dialog primitives.
- `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` — tooltip primitives.
- `XKOVATheme`, `XKOVAThemeMode` — theme wrapper + theme mode type.
- `BalanceText`, `BalanceTextProps` — formatted token balance text.
- `NetworkText`, `NetworkTextProps` — network label with optional logo.

#### Utilities + toasts
- `cn` — className merge helper.
- `getFocusableElements` — list focusable elements in a container.
- `trapFocusWithin` — trap Tab focus within a container.
- `UIErrorTelemetryEvent` — sanitized UI error telemetry payload.
- `setUIErrorTelemetryHandler` — register UI error telemetry handler.
- `createUIErrorTelemetryAdapter` — bridge UI errors into SDK telemetry.
- `Toaster` — Sonner toast container component.

#### Subpaths
- `@xkova/sdk/ui/styles.css` — Tailwind/shadcn styles for SDK UI.

### `@xkova/sdk/browser`
- `LaunchIeeParams` — input parameters for `launchIee`.
- `LaunchIeeResult` — result union from `launchIee`.
- `launchIee` — open the IEE (SafeApprove) iframe and await receipt/cancel/error.
- `BrowserIeeReceiptProviderOptions` — options for `createBrowserIeeReceiptProvider`.
- `createBrowserIeeReceiptProvider` — browser receipt provider for `IeeOrchestrator`.

### `@xkova/sdk/telemetry`
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

### `@xkova/sdk/telemetry-adapters`
- `HeadlessErrorTelemetryEvent` — telemetry event payload for headless errors.
- `createHeadlessErrorTelemetryAdapter` — map SDK errors to telemetry events.
- `createConsoleTelemetry` — console-based telemetry adapter.
- `createOpenTelemetryTelemetry` — OpenTelemetry adapter.
- `createDatadogTraceTelemetry` — Datadog trace adapter.
- `createDatadogRumTelemetry` — Datadog RUM adapter.
- `createSentryTelemetry` — Sentry adapter.

### `@xkova/sdk/abis`
- `FaucetABI` — faucet contract ABI.
