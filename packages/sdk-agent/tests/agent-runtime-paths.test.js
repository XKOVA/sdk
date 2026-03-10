import test from "node:test";
import assert from "node:assert/strict";
import {
  buildErc20TransferTx,
  createJwksWebhookVerifier,
  normalizeInstallationPayload,
  parseAgentWebhookPayload,
  resolveInstallationToken,
  signManagedTransaction,
} from "../dist/index.js";

const toJwtLike = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
};

test("parseAgentWebhookPayload discriminates direct and encoded webhook shapes", () => {
  const direct = parseAgentWebhookPayload({
    event: "transaction.submitted",
    installation_id: "inst_1",
    transaction_id: "tx_1",
  });
  assert.equal(direct?.kind, "transaction");
  assert.equal(direct?.payload.installationId, "inst_1");

  const wrappedJson = JSON.stringify({
    payload: JSON.stringify({
      installation_id: "inst_2",
      status: "active",
    }),
  });
  const wrappedResult = parseAgentWebhookPayload(wrappedJson);
  assert.equal(wrappedResult?.kind, "installation");
  assert.equal(wrappedResult?.payload.installationId, "inst_2");

  const wrappedJwt = parseAgentWebhookPayload(
    toJwtLike({
      event: "transaction.finalized",
      installation_id: "inst_3",
      transaction_id: "tx_3",
    }),
  );
  assert.equal(wrappedJwt?.kind, "transaction");
  assert.equal(wrappedJwt?.payload.event, "transaction.finalized");

  assert.equal(parseAgentWebhookPayload([]), null);
});

test("normalizeInstallationPayload handles edge-field normalization without throwing", () => {
  const normalized = normalizeInstallationPayload({
    installation_id: "inst_1",
    webhook_pending: "true",
    install_inputs: "not-an-object",
    install_questions_version: "invalid-version",
    selectedTokenPoolId: "pool_b",
    availableOperatingTokens: [
      {
        tokenPoolId: "pool_a",
        symbol: "USDC",
        address: "0xabc",
        decimals: 6,
        networkPoolId: "np_1",
      },
      null,
      {},
    ],
    tokenBudgetsByTokenPoolId: {
      pool_a: "5000",
      pool_b: "invalid",
    },
    tokenBudgetMode: "single",
  });

  assert.ok(normalized);
  assert.equal(normalized.installationId, "inst_1");
  assert.equal(normalized.webhook_pending, true);
  assert.equal(normalized.install_questions_version, null);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "install_inputs"), false);
  assert.equal(normalized.selected_token_pool_id, "pool_b");
  assert.deepEqual(normalized.token_budgets_by_token_pool_id, {
    pool_a: "5000",
  });
  assert.equal(normalized.token_budget_mode, "single");
  assert.equal(normalized.available_operating_tokens?.length, 1);
  assert.equal(normalized.available_operating_tokens?.[0].token_pool_id, "pool_a");
  assert.equal(normalized.available_operating_tokens?.[0].contract, "0xabc");
});

test("resolveInstallationToken applies precedence and fails when no tokens exist", () => {
  const installation = {
    available_operating_tokens: [
      { token_pool_id: "pool_a", symbol: "USDC" },
      { token_pool_id: "pool_b", symbol: "USDT" },
    ],
    selected_token_pool_id: "pool_a",
    install_inputs: {
      token_pool_id: "pool_b",
    },
  };

  assert.equal(
    resolveInstallationToken({
      installation,
      preferredTokenPoolId: "pool_a",
      preferredSymbol: "USDT",
    }).token_pool_id,
    "pool_a",
  );

  assert.equal(
    resolveInstallationToken({
      installation,
      preferredTokenPoolId: "missing",
      preferredSymbol: "USDT",
    }).token_pool_id,
    "pool_b",
  );

  assert.equal(
    resolveInstallationToken({
      installation: {
        ...installation,
        install_inputs: "bad-shape",
      },
      preferredTokenPoolId: "missing",
      preferredSymbol: "USDT",
    }).token_pool_id,
    "pool_a",
  );

  assert.throws(
    () =>
      resolveInstallationToken({
        installation: {},
      }),
    /available_operating_tokens missing from installation payload/,
  );
});

test("buildErc20TransferTx handles amount/network normalization and required fields", () => {
  const tx = buildErc20TransferTx({
    network: { chain_id: "137" },
    token: { contract: "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48", decimals: 6 },
    installInputs: { amount_token_units: "2.5" },
    targetAccount: "0x000000000000000000000000000000000000dEaD",
    defaultAmountTokenUnits: 1,
  });

  assert.equal(tx.to, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
  assert.equal(tx.value, "0");
  assert.equal(tx.network_id, 137);
  assert.ok(tx.data.startsWith("0xa9059cbb"));
  assert.equal(tx.data.length, 138);

  assert.throws(
    () =>
      buildErc20TransferTx({
        token: {},
        installInputs: {},
        targetAccount: "0x000000000000000000000000000000000000dEaD",
        defaultAmountTokenUnits: 1,
      }),
    /Token contract missing from installation metadata/,
  );
});

test("signManagedTransaction validates response shape and preserves idempotency handling", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          transaction_id: "tx_1",
          queue_id: "queue_1",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const result = await signManagedTransaction({
      agentpassBaseUrl: "https://auth.xkova.com",
      agentActorId: "agent_1",
      installationJwt: "jwt_1",
      transaction: { to: "0xabc", data: "0x123", value: "0" },
      idempotencyKey: "idem_1",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://auth.xkova.com/agents/agent_1/sign");
    assert.equal(calls[0].init?.method, "POST");
    assert.equal(calls[0].init?.headers?.Authorization, "Bearer jwt_1");

    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.idempotency_key, "idem_1");
    assert.deepEqual(body.transaction, { to: "0xabc", data: "0x123", value: "0" });

    assert.equal(result.transactionId, "tx_1");
    assert.equal(result.queueId, "queue_1");
    assert.equal(result.idempotency_key, "idem_1");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const originalFetchMalformed = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("null", { status: 200, headers: { "content-type": "application/json" } });

    await assert.rejects(
      () =>
        signManagedTransaction({
          agentpassBaseUrl: "https://auth.xkova.com",
          agentActorId: "agent_1",
          installationJwt: "jwt_1",
          transaction: { to: "0xabc", data: "0x123", value: "0" },
        }),
      /Unexpected sign response shape/,
    );
  } finally {
    globalThis.fetch = originalFetchMalformed;
  }
});

test("createJwksWebhookVerifier handles optional inputs and request-header edge cases", async () => {
  const verifier = createJwksWebhookVerifier({
    jwksUrl: "http://127.0.0.1:9/jwks",
    algorithms: [""],
  });

  assert.equal(await verifier(), false);
  assert.equal(await verifier(null), false);
  assert.equal(await verifier({}), false);
  assert.equal(await verifier({ req: null }), false);
  assert.equal(await verifier({ req: { headers: {} } }), false);
  assert.equal(
    await verifier({ req: { headers: { Authorization: "Bearer abc.def.ghi" } } }),
    false,
  );
});
