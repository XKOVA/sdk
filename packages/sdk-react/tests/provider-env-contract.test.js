import test from "node:test";
import assert from "node:assert/strict";
import {
  assertNoDeprecatedCoreEnvVars,
  resolveProviderApiCoreOrigin,
  resolveProviderCoreBaseUrl,
} from "../dist/provider.js";

test("assertNoDeprecatedCoreEnvVars rejects removed split-host env vars", () => {
  assert.throws(
    () =>
      assertNoDeprecatedCoreEnvVars({
        XKOVA_API_URL: "https://api.example.com",
      }),
    /Deprecated SDK env vars detected/,
  );

  assert.throws(
    () =>
      assertNoDeprecatedCoreEnvVars({
        NEXT_PUBLIC_XKOVA_BASE_URL: "https://auth.example.com",
      }),
    /Deprecated SDK env vars detected/,
  );
});

test("resolveProviderCoreBaseUrl resolves explicit and env-driven core URLs", () => {
  assert.equal(
    resolveProviderCoreBaseUrl({
      explicitBaseUrl: "https://local-core.xkova.com/auth",
      env: {},
    }),
    "https://local-core.xkova.com",
  );

  assert.equal(
    resolveProviderCoreBaseUrl({
      env: {
        XKOVA_CORE_URL: "https://dev-core.xkova.com/api/v1",
      },
    }),
    "https://dev-core.xkova.com",
  );

  assert.equal(
    resolveProviderCoreBaseUrl({
      env: {
        XKOVA_ENV: "local",
      },
    }),
    "https://local-core.xkova.com",
  );

  assert.throws(
    () =>
      resolveProviderCoreBaseUrl({
        explicitBaseUrl: "https://core.xkova.com",
        env: {
          XKOVA_API_URL: "https://legacy-api.example.com",
        },
      }),
    /Deprecated SDK env vars detected/,
  );
});

test("resolveProviderApiCoreOrigin derives from core URL and rejects deprecated vars", () => {
  assert.equal(
    resolveProviderApiCoreOrigin({
      explicitApiBaseUrl: "https://staging-core.xkova.com/api/v1",
      env: {},
    }),
    "https://staging-core.xkova.com",
  );

  assert.equal(
    resolveProviderApiCoreOrigin({
      resolvedBaseUrl: "https://core.xkova.com/auth",
      env: {},
    }),
    "https://core.xkova.com",
  );

  assert.throws(
    () =>
      resolveProviderApiCoreOrigin({
        env: {
          NEXT_PUBLIC_XKOVA_API_URL: "https://api.example.com",
        },
      }),
    /Deprecated SDK env vars detected/,
  );
});
