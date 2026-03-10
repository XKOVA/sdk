import test from "node:test";
import assert from "node:assert/strict";
import { getTrustedIeeMessageData } from "../dist/message-validation.js";

test("getTrustedIeeMessageData returns payload for matching origin and receipt_request_id", () => {
  const payload = {
    receipt_request_id: "req-1",
    status: "approved",
    receipt: "signed-receipt",
  };
  const result = getTrustedIeeMessageData({
    expectedOrigin: "https://auth.example.com",
    receiptRequestId: "req-1",
    event: {
      origin: "https://auth.example.com",
      data: payload,
    },
  });

  assert.equal(result, payload);
});

test("getTrustedIeeMessageData rejects mismatched origin", () => {
  const result = getTrustedIeeMessageData({
    expectedOrigin: "https://auth.example.com",
    receiptRequestId: "req-1",
    event: {
      origin: "https://attacker.example.com",
      data: { receipt_request_id: "req-1", status: "approved", receipt: "bad" },
    },
  });

  assert.equal(result, null);
});

test("getTrustedIeeMessageData rejects mismatched receipt_request_id", () => {
  const result = getTrustedIeeMessageData({
    expectedOrigin: "https://auth.example.com",
    receiptRequestId: "req-1",
    event: {
      origin: "https://auth.example.com",
      data: {
        receipt_request_id: "req-2",
        status: "approved",
        receipt: "other-request",
      },
    },
  });

  assert.equal(result, null);
});

test("getTrustedIeeMessageData rejects null/non-object payloads", () => {
  const nullPayload = getTrustedIeeMessageData({
    expectedOrigin: "https://auth.example.com",
    receiptRequestId: "req-1",
    event: {
      origin: "https://auth.example.com",
      data: null,
    },
  });
  assert.equal(nullPayload, null);

  const primitivePayload = getTrustedIeeMessageData({
    expectedOrigin: "https://auth.example.com",
    receiptRequestId: "req-1",
    event: {
      origin: "https://auth.example.com",
      data: "not-an-object",
    },
  });
  assert.equal(primitivePayload, null);
});

