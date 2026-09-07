import { describe, it, expect } from "vitest";
import { reconcile, getUnmatchedForImport, getAmbiguousForReview } from "../reconciler.js";
import { parseCSVStatement } from "../parsers/index.js";
import type { QBTransaction } from "@qb-toolkit/core";

const FNB_CSV = `"62123456789","FNB Cheque Account"
"Date","Amount","Balance","Description"
"05/09/2024","-1500.00","8500.00","DEBIT CARD WOOLWORTHS"
"05/09/2024","25000.00","33500.00","ACB CREDIT SALARY 789012"
"06/09/2024","-350.50","33149.50","PREPAID VODACOM"
`;

const qbTxns: QBTransaction[] = [
  {
    txnId: "TXN-001",
    date: new Date("2024-09-05"),
    amount: 1500,
    memo: "WOOLWORTHS",
    accountRef: "ACC-001",
  },
  {
    txnId: "TXN-002",
    date: new Date("2024-09-05"),
    amount: 25000,
    memo: "SALARY",
    refNumber: "789012",
    accountRef: "ACC-001",
  },
];

function parseFnb(csv: string) {
  return parseCSVStatement(csv, "fnb");
}

describe("reconcile", () => {
  it("matches parsed statement against QB transactions", () => {
    const statement = parseFnb(FNB_CSV);
    const result = reconcile(statement, qbTxns, {
      accountListId: "ACC-001",
    });
    expect(result.statement.transactions).toHaveLength(3);
    expect(result.matches).toHaveLength(3);
  });

  it("produces correct summary counts", () => {
    const statement = parseFnb(FNB_CSV);
    const result = reconcile(statement, qbTxns, {
      accountListId: "ACC-001",
    });
    expect(result.summary.total).toBe(3);
    expect(result.summary.matched).toBe(2);
    expect(result.summary.unmatched).toBe(1);
  });

  it("identifies unmatched transactions for import", () => {
    const statement = parseFnb(FNB_CSV);
    const result = reconcile(statement, qbTxns, {
      accountListId: "ACC-001",
    });
    const unmatched = getUnmatchedForImport(result);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].bankTxn.description).toContain("VODACOM");
  });

  it("auto-detects bank from CSV content", () => {
    const csv = `"62123456789","FNB Cheque Account"
"Date","Amount","Balance","Description"
"05/09/2024","-100.00","900.00","TEST"
`;
    const statement = parseCSVStatement(csv);
    const result = reconcile(statement, [], { accountListId: "ACC-001" });
    expect(result.statement.bank).toBe("fnb");
  });
});

describe("getAmbiguousForReview", () => {
  it("returns empty when no ambiguous matches", () => {
    const statement = parseFnb(FNB_CSV);
    const result = reconcile(statement, qbTxns, {
      accountListId: "ACC-001",
    });
    const ambiguous = getAmbiguousForReview(result);
    expect(ambiguous).toHaveLength(0);
  });
});
