import { describe, it, expect } from "vitest";
import { generateRequests } from "../action-executor.js";
import type {
  ReceivePaymentAction,
  CreateExpenseAction,
  ClearExistingAction,
} from "@qb-toolkit/core";

describe("generateRequests", () => {
  it("generates ReceivePaymentAdd XML for confirmed receive-payment", () => {
    const action: ReceivePaymentAction = {
      type: "receive-payment",
      bankTxn: {
        date: new Date("2025-09-05"),
        amount: 25000,
        description: "SALARY",
        reference: "789012",
        type: "credit",
      },
      confirmed: true,
      invoice: {
        txnId: "INV-001",
        customerRef: { listId: "CUST-001", name: "ACME" },
        txnDate: new Date("2025-09-01"),
        amount: 25000,
        balanceRemaining: 25000,
        isPaid: false,
      },
      customer: { listId: "CUST-001", name: "ACME" },
      bankAccountListId: "BANK-001",
    };

    const requests = generateRequests([action]);
    expect(requests).toHaveLength(1);
    expect(requests[0].xml).toContain("<ReceivePaymentAddRq");
    expect(requests[0].xml).toContain("<ListID>CUST-001</ListID>");
    expect(requests[0].xml).toContain("<TotalAmount>25000.00</TotalAmount>");
  });

  it("skips unconfirmed actions", () => {
    const action: CreateExpenseAction = {
      type: "create-expense",
      bankTxn: {
        date: new Date("2025-09-06"),
        amount: 350,
        description: "VODACOM",
        reference: "",
        type: "debit",
      },
      confirmed: false,
      glAccountListId: "EXP-001",
      bankAccountListId: "BANK-001",
    };

    const requests = generateRequests([action]);
    expect(requests).toHaveLength(0);
  });

  it("generates CheckAdd for confirmed create-expense", () => {
    const action: CreateExpenseAction = {
      type: "create-expense",
      bankTxn: {
        date: new Date("2025-09-06"),
        amount: 350,
        description: "VODACOM PREPAID",
        reference: "",
        type: "debit",
      },
      confirmed: true,
      glAccountListId: "EXP-001",
      bankAccountListId: "BANK-001",
    };

    const requests = generateRequests([action]);
    expect(requests).toHaveLength(1);
    expect(requests[0].xml).toContain("<CheckAddRq");
    expect(requests[0].xml).toContain("<Amount>350.00</Amount>");
  });

  it("generates setClearedStatus for clear-existing", () => {
    const action: ClearExistingAction = {
      type: "clear-existing",
      bankTxn: {
        date: new Date("2025-09-05"),
        amount: 1500,
        description: "WOOLWORTHS",
        reference: "",
        type: "debit",
      },
      confirmed: true,
      qbTxn: {
        txnId: "TXN-001",
        txnType: "Check",
        date: new Date("2025-09-05"),
        amount: 1500,
        accountRef: "BANK-001",
      },
      editSequence: "ES-001",
    };

    const requests = generateRequests([action]);
    expect(requests).toHaveLength(1);
    expect(requests[0].xml).toContain("<CheckModRq");
    expect(requests[0].xml).toContain("<EditSequence>ES-001</EditSequence>");
    expect(requests[0].xml).toContain("<ClearedStatus>Cleared</ClearedStatus>");
  });
});
