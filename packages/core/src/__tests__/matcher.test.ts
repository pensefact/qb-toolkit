import { describe, it, expect } from "vitest";
import { matchTransactions, matchInvoices, matchBills } from "../matcher.js";
import type {
  Transaction,
  QBTransaction,
  QBInvoice,
  QBBill,
} from "../types.js";

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

function credit(overrides: Partial<Transaction> = {}): Transaction {
  return {
    date: new Date("2024-09-05"),
    amount: 5000,
    description: "EFT PAYMENT ACME INV1001",
    reference: "INV1001",
    type: "credit",
    ...overrides,
  };
}

function invoice(overrides: Partial<QBInvoice> = {}): QBInvoice {
  return {
    txnId: "INV-001",
    customerRef: { listId: "80000001-1", name: "Acme Corp" },
    refNumber: "INV1001",
    txnDate: new Date("2024-09-05"),
    amount: 5000,
    balanceRemaining: 5000,
    isPaid: false,
    ...overrides,
  };
}

function debit(overrides: Partial<Transaction> = {}): Transaction {
  return {
    date: new Date("2024-09-05"),
    amount: 1200,
    description: "EFT PAYMENT ESKOM BILL7001",
    reference: "BILL7001",
    type: "debit",
    ...overrides,
  };
}

function bill(overrides: Partial<QBBill> = {}): QBBill {
  return {
    txnId: "BILL-001",
    vendorRef: { listId: "V0001", name: "Eskom" },
    refNumber: "BILL7001",
    txnDate: new Date("2024-09-05"),
    amount: 1200,
    amountDue: 1200,
    isPaid: false,
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

describe("matchInvoices", () => {
  it("matches a credit to an invoice with the same amount and reference", () => {
    const c = credit();
    const results = matchInvoices([c], [invoice()]);
    expect(results.get(c)?.invoice.txnId).toBe("INV-001");
    expect(results.get(c)?.score).toBeGreaterThan(0.8);
  });

  it("returns null (not a skipped entry) when no invoice has a matching balance", () => {
    const c = credit({ amount: 6000 });
    const results = matchInvoices([c], [invoice()]);
    expect(results.size).toBe(1);
    expect(results.get(c)).toBeNull();
  });

  it("does not spend the same invoice on two different credits", () => {
    const strong = credit(); // amount 5000, exact ref match
    const weak = credit({
      description: "EFT PAYMENT UNKNOWN",
      reference: "999999",
    }); // amount 5000, no ref match -> lower score, same invoice candidate
    const results = matchInvoices([strong, weak], [invoice()]);

    expect(results.get(strong)?.invoice.txnId).toBe("INV-001");
    expect(results.get(weak)).toBeNull();
  });

  it("prefers the higher-scoring invoice when a credit could match more than one", () => {
    const c = credit(); // amount 5000, reference INV1001
    const strongInvoice = invoice({ txnId: "INV-STRONG", refNumber: "INV1001" });
    const weakInvoice = invoice({
      txnId: "INV-WEAK",
      refNumber: "NOMATCH0000",
      customerRef: { listId: "80000002-1", name: "Someone Else" },
    });
    const results = matchInvoices([c], [weakInvoice, strongInvoice]);
    expect(results.get(c)?.invoice.txnId).toBe("INV-STRONG");
  });
});

describe("matchBills", () => {
  it("matches a debit to a bill with the same amount and reference", () => {
    const d = debit();
    const results = matchBills([d], [bill()]);
    expect(results.get(d)?.bill.txnId).toBe("BILL-001");
    expect(results.get(d)?.score).toBeGreaterThan(0.8);
  });

  it("matches when the bank transaction amount is stored as a negative number", () => {
    // Regression for the 2026-09-07 fix: scoreBillMatch must compare
    // Math.abs(bankTxn.amount) against bill.amountDue, not the raw signed value.
    const d = debit({ amount: -1200 });
    const results = matchBills([d], [bill()]);
    expect(results.get(d)?.bill.txnId).toBe("BILL-001");
  });

  it("returns null when amounts differ even after taking the absolute value", () => {
    const d = debit({ amount: -999 });
    const results = matchBills([d], [bill()]);
    expect(results.get(d)).toBeNull();
  });

  it("does not spend the same bill on two different debits", () => {
    const strong = debit(); // amount 1200, exact ref match
    const weak = debit({
      description: "EFT PAYMENT UNKNOWN",
      reference: "000000",
    }); // amount 1200, no ref match -> lower score, same bill candidate
    const results = matchBills([strong, weak], [bill()]);

    expect(results.get(strong)?.bill.txnId).toBe("BILL-001");
    expect(results.get(weak)).toBeNull();
  });

  it("prefers the higher-scoring bill when a debit could match more than one", () => {
    const d = debit(); // amount 1200, reference BILL7001
    const strongBill = bill({ txnId: "BILL-STRONG", refNumber: "BILL7001" });
    const weakBill = bill({
      txnId: "BILL-WEAK",
      refNumber: "NOMATCH0000",
      vendorRef: { listId: "V0002", name: "Someone Else" },
    });
    const results = matchBills([d], [weakBill, strongBill]);
    expect(results.get(d)?.bill.txnId).toBe("BILL-STRONG");
  });
});
