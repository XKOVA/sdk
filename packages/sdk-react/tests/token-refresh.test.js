import test from "node:test";
import assert from "node:assert/strict";
import { ensureFreshTokenWithDedupe } from "../dist/token-refresh.js";

test("ensureFreshTokenWithDedupe returns still-valid tokens without refreshing", async () => {
  let fetchCalls = 0;
  let inFlight = null;
  const current = {
    accessToken: "cached",
    refreshToken: undefined,
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    scope: ["openid"],
    tokenType: "bearer",
  };

  const result = await ensureFreshTokenWithDedupe({
    current,
    inFlight,
    fetchTokens: async () => {
      fetchCalls += 1;
      return null;
    },
    setCurrent: () => {},
    setInFlight: (next) => {
      inFlight = next;
    },
  });

  assert.equal(fetchCalls, 0);
  assert.equal(result, current);
});

test("ensureFreshTokenWithDedupe deduplicates concurrent refresh calls", async () => {
  let fetchCalls = 0;
  let inFlight = null;
  let current = null;
  const expected = {
    accessToken: "fresh",
    refreshToken: undefined,
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    scope: ["openid"],
    tokenType: "bearer",
  };

  const fetchTokens = async () => {
    fetchCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return expected;
  };

  const run = () =>
    ensureFreshTokenWithDedupe({
      current,
      inFlight,
      fetchTokens,
      setCurrent: (next) => {
        current = next;
      },
      setInFlight: (next) => {
        inFlight = next;
      },
    });

  const [resultA, resultB] = await Promise.all([run(), run()]);

  assert.equal(fetchCalls, 1);
  assert.equal(resultA, expected);
  assert.equal(resultB, expected);
  assert.equal(current, expected);
  assert.equal(inFlight, null);
});

test("ensureFreshTokenWithDedupe force-refreshes even when token is still valid", async () => {
  let fetchCalls = 0;
  let inFlight = null;
  let current = {
    accessToken: "cached",
    refreshToken: undefined,
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    scope: ["openid"],
    tokenType: "bearer",
  };

  const refreshed = {
    accessToken: "forced-refresh",
    refreshToken: undefined,
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    scope: ["openid"],
    tokenType: "bearer",
  };

  const result = await ensureFreshTokenWithDedupe({
    force: true,
    current,
    inFlight,
    fetchTokens: async () => {
      fetchCalls += 1;
      return refreshed;
    },
    setCurrent: (next) => {
      current = next;
    },
    setInFlight: (next) => {
      inFlight = next;
    },
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result, refreshed);
  assert.equal(current, refreshed);
});

