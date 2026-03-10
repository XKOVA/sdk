# @xkova/sdk-browser

Vanilla browser helpers for launching the XKOVA Isolated Execution Environment (IEE (SafeApprove)) iframe and receiving an IEE (SafeApprove) receipt via a strict `postMessage` handshake.

## Requirements

Runtime: Browser only (DOM required). Not compatible with SSR/Node.js.

## Usage

```ts
import { launchIee } from "@xkova/sdk-browser";

const result = await launchIee({
  ieeUrl: "https://auth.example.com/iee",
  expectedIeeOrigin: "https://auth.example.com",
  receiptRequestId: crypto.randomUUID(),
  ticketId: "<prep_ticket_id>",
  draftId: "<optional_draft_id>",
  timeoutMs: 60_000,
});

if (result.status === "approved") {
  console.log(result.receipt);
}
```

## Browser receipt provider (non-React)

This is the canonical receipt provider for non-React browser usage.

```ts
import { APIClient, IeeOrchestrator, createServicesFromHosts } from "@xkova/sdk-core";
import { createBrowserIeeReceiptProvider } from "@xkova/sdk-browser";

const authApi = new APIClient({
  baseUrl: "https://auth.example.com",
  getAccessToken: async () => accessToken,
});

const receiptProvider = createBrowserIeeReceiptProvider({
  ieeUrl: "https://auth.example.com/iee",
  authApi,
});

const iee = new IeeOrchestrator({ receiptProvider });

const services = createServicesFromHosts({
  oauthBaseUrl: "https://auth.example.com",
  apiHost: "https://api.example.com",
  getAccessToken: async () => accessToken,
  iee,
});

await services.contacts.createContact({ email: "user@example.com", name: "Jane Doe" });
```

## Export Catalog

### IEE (SafeApprove) launcher
- `LaunchIeeParams` — input parameters for `launchIee`.
- `LaunchIeeResult` — result union from `launchIee`.
- `launchIee` — open the IEE (SafeApprove) iframe and await receipt/cancel/error.

### Receipt provider
- `BrowserIeeReceiptProviderOptions` — options for `createBrowserIeeReceiptProvider`.
- `createBrowserIeeReceiptProvider` — browser receipt provider for `IeeOrchestrator`.

## Notes

- Enforces exact `event.origin === expectedIeeOrigin` and `receipt_request_id` matches.
- Performs a startup `ready` handshake and fails fast when the IEE window never becomes visible (for blocked iframe/embed cases).
- Uses `targetOrigin` when posting back to the caller (no wildcard `*`).
- No React/Next/UI dependencies; browser-only helper.
