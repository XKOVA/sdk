import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithPolicy } from "../dist/http.js";

test("fetchWithPolicy retries retryable GET status responses", async () => {
  let attempts = 0;
  const fetchFn = async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "0" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const response = await fetchWithPolicy(
    fetchFn,
    "https://example.com/retry",
    { method: "GET" },
    {
      timeoutMs: 5_000,
      attemptTimeoutMs: 2_000,
      retry: {
        retries: 2,
        backoffMs: 0,
        maxBackoffMs: 0,
        respectRetryAfter: true,
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(attempts, 2);
});

test("fetchWithPolicy does not retry POST by default", async () => {
  let attempts = 0;
  const fetchFn = async () => {
    attempts += 1;
    return new Response("server error", { status: 500 });
  };

  const response = await fetchWithPolicy(
    fetchFn,
    "https://example.com/post",
    { method: "POST" },
    {
      timeoutMs: 5_000,
      attemptTimeoutMs: 2_000,
      retry: {
        retries: 3,
        backoffMs: 0,
        maxBackoffMs: 0,
      },
    },
  );

  assert.equal(response.status, 500);
  assert.equal(attempts, 1);
});

test("fetchWithPolicy retries transient network errors for retryable methods", async () => {
  let attempts = 0;
  const fetchFn = async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("network down");
    }
    return new Response("ok", { status: 200 });
  };

  const response = await fetchWithPolicy(
    fetchFn,
    "https://example.com/network",
    { method: "GET" },
    {
      timeoutMs: 5_000,
      attemptTimeoutMs: 2_000,
      retry: {
        retries: 2,
        backoffMs: 0,
        maxBackoffMs: 0,
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(attempts, 2);
});

