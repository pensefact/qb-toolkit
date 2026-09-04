import { describe, it, expect } from "vitest";
import { matchTransactions } from "../matcher.js";
import type { Transaction, QBTransaction } from "../types.js";

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    date: new Date("2024-09-05"),
    amount: 1500,
    description: "WOOLWORTHS PURCHASE",
    reference: "123456",
    type: "debit",
    ...overrides,
  };
}

function qbTxn(overrides: Partial<QBTransaction> = {}): QBTransaction {
  return {
    txnId: "TXN-001",
    date: new Date("2024-09-05"),
    amount: 1500,
    memo: "WOOLWORTHS PURCHASE",
    refNumber: "123456",
    accountRef: "ACC-001",
    ...overrides,
  };
}

describe("matchTransactions", () => {
  it("matches identical transactions with high confidence", () => {
    const results = matchTransactions([txn()], [qbTxn()]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("matched");
    expect(results[0].confidence).toBeGreaterThan(0.8);
  });

  it("matches transactions with close dates", () => {
    const results = matchTransactions(
      [txn()],
      [qbTxn({ date: new Date("2024-09-06") })]
    );
    expect(results[0].status).toBe("matched");
  });

  it("rejects transactions with different amounts", () => {
    const results = matchTransactions(
      [txn()],
      [qbTxn({ amount: 2000 })]
    );
    expect(results[0].status).toBe("unmatched");
  });

  it("rejects transactions too far apart in date", () => {
    const results = matchTransactions(
      [txn()],
      [qbTxn({ date: new Date("2024-09-15") })]
    );
    expect(results[0].status).toBe("unmatched");
  });

  it("marks ambiguous when two QB txns score similarly", () => {
    const results = matchTransactions(
      [txn()],
      [
        qbTxn({ txnId: "TXN-001" }),
        qbTxn({ txnId: "TXN-002", memo: "WOOLWORTHS" }),
      ]
    );
    expect(results[0].status).toBe("ambiguous");
  });

  it("does not reuse a QB transaction for multiple bank txns", () => {
    const results = matchTransactions(
      [txn(), txn({ description: "WOOLWORTHS 2" })],
      [qbTxn()]
    );
    const matched = results.filter((r) => r.qbTxn);
    expect(matched).toHaveLength(1);
  });
});
