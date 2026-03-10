# @xkova/sdk-agent

Primitive helpers for XKOVA service-credential agents.

This package intentionally exposes low-level building blocks only. It does not own your agent's business loop (polling cadence, payment conditions, retry policy, or subscription logic).

## Install

```bash
pnpm add @xkova/sdk-agent
```

## Requirements

- ESM-only package
- Node 20+

## Exports

- `buildErc20TransferTx(params)`
- `XKOVA_ENV_TO_AUTH_URL`
- `DEFAULT_XKOVA_ENV`
- `resolveXkovaEnvironment(rawValue)`
- `resolveAgentpassBaseUrl(rawValue)`
- `resolveJwksUrl(options?)`
- `getInstallInputNumber(inputs, key, fallback, constraints?)`
- `normalizeInstallationPayload(payload)`
- `normalizeTransactionLifecyclePayload(payload)`
- `parseAgentWebhookPayload(input)`
- `listServiceInstallations(params)`
- `issueInstallationToken(params)`
- `signManagedTransaction(params)`
- `shouldRefreshToken(expiresAt, now?, refreshWindowMs?)`
- `createJwksWebhookVerifier(options)`
- `HttpError`

`normalizeInstallationPayload(payload)` preserves agent install token metadata when present:
- `selected_token_pool_id`
- `available_operating_tokens`
- `token_budgets_by_token_pool_id`
- `token_budget_mode`
- `install_inputs`

## Quick Start

```js
import {
  buildErc20TransferTx,
  createJwksWebhookVerifier,
  issueInstallationToken,
  listServiceInstallations,
  resolveInstallationToken,
  resolveAgentpassBaseUrl,
  signManagedTransaction,
} from "@xkova/sdk-agent";

const agentpassBaseUrl = resolveAgentpassBaseUrl(process.env.XKOVA_ENV);
const serviceId = process.env.SERVICE_ID;
const serviceCredential = process.env.SERVICE_CREDENTIAL;

const installations = await listServiceInstallations({
  agentpassBaseUrl,
  serviceId,
  serviceCredential,
});

for (const installation of installations) {
  const installationToken = await issueInstallationToken({
    agentpassBaseUrl,
    serviceId,
    installationId: installation.installationId,
    serviceCredential,
  });

  const token = resolveInstallationToken({ installation });

  const tx = buildErc20TransferTx({
    network: installation.network,
    token,
    installInputs: installation.install_inputs,
    targetAccount: process.env.TARGET_ACCOUNT,
    defaultAmountTokenUnits: Number(process.env.AMOUNT_TOKEN_UNITS || "1"),
    amountInputKey: "amount_token_units",
  });

  await signManagedTransaction({
    agentpassBaseUrl,
    agentActorId: installation.agentActorId,
    installationJwt: installationToken.token,
    transaction: tx,
  });
}

const verifyWebhookAuth = createJwksWebhookVerifier({
  xkovaEnv: process.env.XKOVA_ENV,
});
```
