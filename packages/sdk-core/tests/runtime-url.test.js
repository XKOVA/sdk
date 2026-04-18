import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCoreOrigin,
  resolveCoreApiBaseUrl,
  resolveCoreAuthBaseUrl,
  resolveCoreOriginForEnvironment,
} from "../dist/core.js";

test("resolveCoreOriginForEnvironment maps canonical env hostnames", () => {
  assert.equal(resolveCoreOriginForEnvironment("production"), "https://core.xkova.com");
  assert.equal(resolveCoreOriginForEnvironment("staging"), "https://staging-core.xkova.com");
  assert.equal(resolveCoreOriginForEnvironment("dev"), "https://dev-core.xkova.com");
  assert.equal(resolveCoreOriginForEnvironment("local"), "https://local-core.xkova.com");
});

test("normalizeCoreOrigin accepts core-origin, /auth, and /api/vN inputs", () => {
  assert.equal(normalizeCoreOrigin("https://local-core.xkova.com"), "https://local-core.xkova.com");
  assert.equal(
    normalizeCoreOrigin("https://local-core.xkova.com/auth"),
    "https://local-core.xkova.com",
  );
  assert.equal(
    normalizeCoreOrigin("https://local-core.xkova.com/api/v1"),
    "https://local-core.xkova.com",
  );
});

test("resolveCoreAuthBaseUrl and resolveCoreApiBaseUrl derive canonical paths", () => {
  assert.equal(
    resolveCoreAuthBaseUrl("https://local-core.xkova.com/api/v1"),
    "https://local-core.xkova.com/auth",
  );
  assert.equal(
    resolveCoreApiBaseUrl({ coreOrigin: "https://local-core.xkova.com/auth" }),
    "https://local-core.xkova.com/api/v1",
  );
});

test("normalizeCoreOrigin rejects unsupported path prefixes", () => {
  assert.throws(
    () => normalizeCoreOrigin("https://local-core.xkova.com/oauth"),
    /supported \/auth or \/api path/,
  );
});
