import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTransactionHistorySearchParams,
  normalizeTransactionHistoryResponse,
} from "../dist/transactions/history.js";

test("buildTransactionHistorySearchParams normalizes fields and prefers cursor", () => {
  const search = buildTransactionHistorySearchParams({
    account: "0xABC",
    contract: "0xDEF",
    view: "events",
    limit: 25,
    cursor: "cursor-1",
    offset: 10,
    direction: "out",
  });

  const entries = Object.fromEntries(search.entries());
  assert.equal(entries.account, "0xabc");
  assert.equal(entries.contract, "0xdef");
  assert.equal(entries.view, "events");
  assert.equal(entries.limit, "25");
  assert.equal(entries.cursor, "cursor-1");
  assert.equal(entries.direction, "out");
  assert.ok(!("offset" in entries));
});

test("normalizeTransactionHistoryResponse computes display fields and filters grouped rows", () => {
  const account = `0x${"1".repeat(40)}`;
  const other = `0x${"2".repeat(40)}`;

  const payload = {
    transactions: [
      {
        transactionHash: "0xhash",
        account,
        fromAccount: account,
        toAccount: other,
        amountRaw: "1000",
        tokenDecimals: 2,
        tokenSymbol: "USD",
        eventType: "token_transfer",
        direction: "out",
      },
      {
        transactionHash: "0xhash",
        account,
        fromAccount: account,
        toAccount: account,
        eventType: "contract_interaction",
        eventSubtype: "user_operation",
        executionMethod: "user_operation",
      },
    ],
    total: 2,
    limit: 50,
    offset: 0,
  };

  const grouped = normalizeTransactionHistoryResponse(payload, { view: "grouped" });
  assert.equal(grouped.transactions.length, 1);
  assert.equal(grouped.transactions[0].displayAmount, "-10.00 USD");
  assert.equal(grouped.transactions[0].direction, "out");

  const events = normalizeTransactionHistoryResponse(payload, { view: "events" });
  assert.equal(events.transactions.length, 2);
});
