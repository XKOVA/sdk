# @xkova/sdk-react

React provider, hooks, and agent helpers for the XKOVA SDK. This package is intended for browser-based React apps.

## Install

```bash
pnpm add @xkova/sdk-react
# or npm install @xkova/sdk-react
```

## Requirements

- React 16.8+.
- ESM-only package.

## Usage

```tsx
import { XKOVAProvider, useAuth } from "@xkova/sdk-react";

function AppShell({ children }: { children: React.ReactNode }) {
  return <XKOVAProvider>{children}</XKOVAProvider>;
}

function Profile() {
  const { user, status } = useAuth();
  if (status === "loading") return null;
  return <div>{user?.email}</div>;
}
```

### Base URL configuration

`XKOVAProvider` expects an OAuth protocol host (origin). Provide one of:

- `baseUrl` prop, or
- `NEXT_PUBLIC_XKOVA_BASE_URL`, `NEXT_PUBLIC_XKOVA_OAUTH_URL`, or `XKOVA_BASE_URL`.

For apps/api calls, the provider resolves an API host from:

- `apiBaseUrl` prop, or
- `NEXT_PUBLIC_XKOVA_API_URL` / `XKOVA_API_URL`, or
- the default production host.

## Error Handling

All hooks that perform network calls may throw or return errors from `@xkova/sdk-core`:

- `SDKError` — base class with `.code` for programmatic handling
- `NetworkError`, `TimeoutError`, `UnauthorizedError` — transport-level
- `IeeError` — IEE (SafeApprove) receipt failures (`IEE_REQUIRED`, `IEE_CANCELLED`, `IEE_FAILED`)

Use `getUserFriendlyErrorMessage()` from `@xkova/sdk-react-ui` to convert errors to user-safe strings.

## IEE (SafeApprove) (Interactive Execution Environment)

Hooks marked with IEE (SafeApprove) requirements need an IEE (SafeApprove) receipt before performing write operations. The SDK handles this automatically when `XKOVAProvider` is configured with an IEE (SafeApprove) receipt provider (typically `createBrowserIeeReceiptProvider` from `@xkova/sdk-browser`).

IEE (SafeApprove)-gated hooks: `useUserProfile`, `useUserSessions`, `useSubmitSendPayment`, `useCancelSendPayment`, `useRemindSendPayment`, `useCreateTransferTransaction`, `useExecuteFaucetTransfer`, `useCreateContact`, `useUpdateContact`, `useDeleteContact`, `useAgentInstallationActions`, `useCreatePaymentRequest`, `useCancelPaymentRequest`, `useDeclinePaymentRequest`, `useRemindPaymentRequest`, `useVerifySendPaymentTransaction`, `useCancelPendingPaymentOnchain`, `usePayPendingPaymentRequest`.

## Export Catalog

### Provider + core utilities (`@xkova/sdk-react`)
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

### Profile + sessions
- `useUserProfile` — load/update user profile data.
- `useUserSessions` — list and revoke user sessions.
- `useHostedEmailChange` — launch the hosted email-change UI.

### Tenant + account
- `useTenantConfig` — read tenant bootstrap configuration.
- `useTenantReload` — reload tenant bootstrap data.
- `useAccountState` — read account state for the current user.

### Human auth + balances
- `HumanAuthOptions` — options for `useHumanAuth`.
- `HumanAuthState` — state returned by `useHumanAuth`.
- `useHumanAuth` — human-facing auth flow helper.
- `HumanBalanceOptions` — options for `useHumanBalance`.
- `HumanBalanceDisplay` — display-ready balance payload.
- `HumanBalanceState` — state returned by `useHumanBalance`.
- `useHumanBalance` — aggregate human balance across accounts/tokens.

### Token balances
- `TokenBalanceEntry` — token balance entry.
- `TokenBalancesOptions` — options for `useTokenBalances`.
- `TokenBalancesState` — state returned by `useTokenBalances`.
- `useTokenBalances` — fetch a list of token balances.
- `TokenBalanceSnapshot` — snapshot of a single token balance.
- `TokenBalanceOptions` — options for `useTokenBalance`.
- `TokenBalanceState` — state returned by `useTokenBalance`.
- `useTokenBalance` — fetch a single token balance.

### Transfers + payments + transactions
- `useTransactionHistory` — fetch transaction history.
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

### Contacts
- `useContacts` — list contacts.
- `useCreateContact` — create contacts.
- `useUpdateContact` — update contacts.
- `useDeleteContact` — delete contacts.

### Agents + marketplace
- `useAgentInstallations` — deprecated legacy wrapper for agent catalog/installations.
- `useAgentTransactions` — agent-only transaction history.
- `useAgentInstallationsAndTransactions` — aggregate agent installs + transactions.
- `useMarketplaceAgents` — list tenant marketplace agents.
- `useMyAgentInstallations` — list the user’s installations + failure counts.
- `useAgentInstallationActions` — install/uninstall/budget actions.
- `useInstallationToken` — issue and auto-refresh installation tokens.
- `useFaucets` — list tenant faucet providers.
