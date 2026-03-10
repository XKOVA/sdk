import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSubmitSendPaymentInput,
  buildSubmitSendPaymentBody,
} from "../dist/payments/send-payment.js";

test("normalizeSubmitSendPaymentInput returns expected normalized values and receipt payload", () => {
  const contact = `0x${"a".repeat(40)}`;
  const recipientAccount = `0x${"b".repeat(40)}`;
  const contract = `0x${"c".repeat(40)}`;

  const input = {
    transactionType: "send_payment",
    amountWei: "1000",
    networkId: "43113",
    recipientContact: contact,
    recipientAccount,
    contract,
    expiresAt: "2025-01-01T00:00:00Z",
    description: "Hello world",
    transactionHash: "0xhash",
  };

  const { normalized, receiptPayload } = normalizeSubmitSendPaymentInput(input);

  assert.deepEqual(normalized, {
    transactionType: "send_payment",
    amountWei: "1000",
    networkId: "43113",
    tokenAddress: contract,
    recipientContact: contact,
    contactType: "account",
    recipientWallet: recipientAccount,
    isPending: false,
    expiresAt: "2025-01-01T00:00:00Z",
    note: "Hello world",
  });

  assert.deepEqual(receiptPayload, {
    transaction_type: "send_payment",
    amount_wei: "1000",
    network_id: "43113",
    token_address: contract,
    recipient_contact: contact,
    contact_type: "account",
    note: "Hello world",
    is_pending_payment: false,
    expires_at: "2025-01-01T00:00:00Z",
    recipient_wallet_address: recipientAccount,
  });
});

test("buildSubmitSendPaymentBody applies resolved payload overrides and validates hashes", () => {
  const contact = `0x${"a".repeat(40)}`;
  const recipientAccount = `0x${"b".repeat(40)}`;
  const contract = `0x${"c".repeat(40)}`;

  const input = {
    transactionType: "send_payment",
    amountWei: "1000",
    networkId: "43113",
    recipientContact: contact,
    recipientAccount,
    contract,
    expiresAt: "2025-01-01T00:00:00Z",
    description: "Hello world",
    recipientName: "Bob",
    transactionHash: "0xhash",
  };

  const { normalized } = normalizeSubmitSendPaymentInput(input);

  const body = buildSubmitSendPaymentBody({
    input,
    normalized,
    approval: {
      resolvedPayload: { recipient_name: " Alice " },
      transactionHash: "0xhash",
    },
  });

  assert.equal(body.transactionHash, "0xhash");
  assert.equal(body.recipientName, "Alice");
  assert.equal(body.recipientContact, contact);
  assert.equal(body.contactType, "account");
  assert.equal(body.isPendingPayment, false);
  assert.equal(body.expiresAt, "2025-01-01T00:00:00Z");
  assert.ok(!("fingerprint" in body));
});

test("buildSubmitSendPaymentBody throws on transaction hash mismatch", () => {
  const contact = `0x${"a".repeat(40)}`;
  const contract = `0x${"c".repeat(40)}`;

  const input = {
    transactionType: "send_payment",
    amountWei: "1000",
    networkId: "43113",
    recipientContact: contact,
    recipientAccount: `0x${"b".repeat(40)}`,
    contract,
    expiresAt: "2025-01-01T00:00:00Z",
    description: "Hello world",
    transactionHash: "0xhash",
  };

  const { normalized } = normalizeSubmitSendPaymentInput(input);

  assert.throws(() => {
    buildSubmitSendPaymentBody({
      input,
      normalized,
      approval: {
        resolvedPayload: {},
        transactionHash: "0xother",
      },
    });
  }, /transactionHash does not match SafeApprove approval/);
});
