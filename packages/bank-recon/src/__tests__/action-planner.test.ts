import { describe, it, expect } from "vitest";
import { planActions, getConfirmedActions, getActionsNeedingReview } from "../action-planner.js";
import type {
  Transaction,
  QBInvoice,
  QBBill,
  QBCustomer,
  QBVendor,
  InvoiceMatch,
  BillMatch,
  MatchResult,
} from "@qb-toolkit/core";

const bankAccount = "BANK-001";

const credit: Transaction = {
  date: new Date("2025-09-05"),
  amount: 25000,
  description: "ACB CREDIT SALARY 789012",
  reference: "789012",
  type: "credit",
};

const debit: Transaction = {
  date: new Date("2025-09-05"),
  amount: 1500,
  description: "DEBIT CARD WOOLWORTHS",
  reference: "",
  type: "debit",
};

const unmatchedDebit: Transaction = {
  date: new Date("2025-09-06"),
  amount: 350.5,
  description: "PREPAID VODACOM",
  reference: "",
  type: "debit",
};

const unmatchedCredit: Transaction = {
  date: new Date("2025-09-07"),
  amount: 5000,
  description: "DEPOSIT CASH",
  reference: "",
  type: "credit",
};

const invoice: QBInvoice = {
  txnId: "INV-001",
  customerRef: { listId: "CUST-001", name: "ACME Corp" },
  refNumber: "789012",
  txnDate: new Date("2025-09-01"),
  amount: 25000,
  balanceRemaining: 25000,
  isPaid: false,
};

const bill: QBBill = {
  txnId: "BILL-001",
  vendorRef: { listId: "VEND-001", name: "Woolworths" },
  txnDate: new Date("2025-09-01"),
  amount: 1500,
  amountDue: 1500,
  isPaid: false,
};

const customer: QBCustomer = { listId: "CUST-001", name: "ACME Corp" };
const vendor: QBVendor = { listId: "VEND-001", name: "Woolworths" };

const qbData = {
  invoices: [invoice],
  bills: [bill],
  customers: [customer],
  vendors: [vendor],
  transactions: [],
};

describe("planActions", () => {
  it("creates ReceivePayment for credit matched to invoice", () => {
    const invoiceMatches = new Map<Transaction, InvoiceMatch | null>([
      [credit, { invoice, score: 0.9 }],
    ]);
    const billMatches = new Map<Transaction, BillMatch | null>();

    const plan = planActions(
      [credit],
      qbData,
      invoiceMatches,
      billMatches,
      [],
      { bankAccountListId: bankAccount }
    );

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe("receive-payment");
    expect(plan.autoConfirmed).toBe(1);
  });

  it("creates BillPayment for debit matched to bill", () => {
    const invoiceMatches = new Map<Transaction, InvoiceMatch | null>();
    const billMatches = new Map<Transaction, BillMatch | null>([
      [debit, { bill, score: 0.85 }],
    ]);

    const plan = planActions(
      [debit],
      qbData,
      invoiceMatches,
      billMatches,
      [],
      { bankAccountListId: bankAccount }
    );

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe("bill-payment");
    expect(plan.autoConfirmed).toBe(1);
  });

  it("creates CreateExpense for unmatched debit", () => {
    const plan = planActions(
      [unmatchedDebit],
      qbData,
      new Map(),
      new Map(),
      [],
      { bankAccountListId: bankAccount, defaultExpenseAccountListId: "EXP-001" }
    );

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe("create-expense");
    expect(plan.actions[0].confirmed).toBe(false);
    expect(plan.needsReview).toBe(1);
  });

  it("creates CreateDeposit for unmatched credit", () => {
    const plan = planActions(
      [unmatchedCredit],
      qbData,
      new Map(),
      new Map(),
      [],
      { bankAccountListId: bankAccount, defaultIncomeAccountListId: "INC-001" }
    );

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe("create-deposit");
    expect(plan.actions[0].confirmed).toBe(false);
  });

  it("marks low-confidence matches as needing review", () => {
    const invoiceMatches = new Map<Transaction, InvoiceMatch | null>([
      [credit, { invoice, score: 0.5 }],
    ]);

    const plan = planActions(
      [credit],
      qbData,
      invoiceMatches,
      new Map(),
      [],
      { bankAccountListId: bankAccount }
    );

    expect(plan.actions[0].confirmed).toBe(false);
    expect(plan.needsReview).toBe(1);
  });

  it("getConfirmedActions filters correctly", () => {
    const invoiceMatches = new Map<Transaction, InvoiceMatch | null>([
      [credit, { invoice, score: 0.9 }],
    ]);
    const plan = planActions(
      [credit, unmatchedDebit],
      qbData,
      invoiceMatches,
      new Map(),
      [],
      { bankAccountListId: bankAccount }
    );

    expect(getConfirmedActions(plan)).toHaveLength(1);
    expect(getActionsNeedingReview(plan)).toHaveLength(1);
  });
});
