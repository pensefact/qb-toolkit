import { describe, it, expect } from "vitest";
import * as qbxml from "../qbxml.js";

function parseXml(xml: string): string {
  expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
  expect(xml).toContain("<?qbxml version=");
  expect(xml).toContain("<QBXML>");
  return xml;
}

describe("qbxml queries", () => {
  it("queryAccounts", () => {
    const xml = parseXml(qbxml.queryAccounts());
    expect(xml).toContain("<AccountQueryRq");
  });

  it("queryCustomers", () => {
    const xml = parseXml(qbxml.queryCustomers());
    expect(xml).toContain("<ActiveStatus>ActiveOnly</ActiveStatus>");
  });

  it("queryInvoices with date range", () => {
    const xml = parseXml(
      qbxml.queryInvoices(new Date("2026-01-01"), new Date("2026-03-31"))
    );
    expect(xml).toContain("<FromModifiedDate>2026-01-01</FromModifiedDate>");
    expect(xml).toContain("<PaidStatus>NotPaidOnly</PaidStatus>");
  });

  it("queryInvoices without dates", () => {
    const xml = parseXml(qbxml.queryInvoices());
    expect(xml).not.toContain("ModifiedDateRangeFilter");
    expect(xml).toContain("<PaidStatus>NotPaidOnly</PaidStatus>");
  });
});

describe("qbxml write operations", () => {
  it("receivePayment", () => {
    const xml = parseXml(
      qbxml.receivePayment({
        customerListId: "C-123",
        bankAccountListId: "B-456",
        invoiceTxnId: "T-789",
        amount: 1500.0,
        date: new Date("2026-06-15"),
        refNumber: "PAY-001",
        memo: "June payment",
      })
    );
    expect(xml).toContain("<ReceivePaymentAddRq");
    expect(xml).toContain("<ListID>C-123</ListID>");
    expect(xml).toContain("<TotalAmount>1500.00</TotalAmount>");
    expect(xml).toContain("<TxnID>T-789</TxnID>");
    expect(xml).toContain("<RefNumber>PAY-001</RefNumber>");
  });

  it("billPayment places BankAccountRef before AppliedToTxnAdd", () => {
    const xml = parseXml(
      qbxml.billPayment({
        vendorListId: "V-100",
        bankAccountListId: "B-200",
        billTxnId: "T-300",
        amount: 250.0,
        date: new Date("2026-07-01"),
      })
    );
    const bankIdx = xml.indexOf("<BankAccountRef>");
    const appliedIdx = xml.indexOf("<AppliedToTxnAdd>");
    expect(bankIdx).toBeLessThan(appliedIdx);
  });

  it("addBill", () => {
    const xml = parseXml(
      qbxml.addBill({
        vendorListId: "V-100",
        expenseAccountListId: "E-200",
        date: new Date("2026-08-01"),
        amount: -350.0,
        memo: "Office supplies",
      })
    );
    expect(xml).toContain("<BillAddRq");
    expect(xml).toContain("<Amount>350.00</Amount>");
  });

  it("addDeposit uses ORDepositLineAdd structure", () => {
    const xml = parseXml(
      qbxml.addDeposit({
        bankAccountListId: "B-100",
        incomeAccountListId: "I-200",
        date: new Date("2026-09-01"),
        amount: 5000.0,
        memo: "Client deposit",
      })
    );
    expect(xml).toContain("<DepositAddRq");
    expect(xml).toContain("<ORDepositLineAdd>");
    expect(xml).toContain("<DepositInfo>");
    expect(xml).not.toContain("<ClearedStatus>");
  });

  it("addJournalEntry", () => {
    const xml = parseXml(
      qbxml.addJournalEntry({
        debitAccountListId: "B-100",
        creditAccountListId: "I-200",
        date: new Date("2026-09-01"),
        amount: 2000.0,
        memo: "Deposit fallback",
      })
    );
    expect(xml).toContain("<JournalEntryAddRq");
    expect(xml).toContain("<JournalDebitLine>");
    expect(xml).toContain("<JournalCreditLine>");
    expect(xml).toContain("<Amount>2000.00</Amount>");
    expect(xml).not.toContain(
      "<JournalEntryAdd>\n    <Memo>"
    );
  });

  it("addCheck", () => {
    const xml = parseXml(
      qbxml.addCheck({
        bankAccountListId: "B-100",
        expenseAccountListId: "E-300",
        date: new Date("2026-09-01"),
        amount: -800.0,
        payee: "ACME Corp",
        memo: "Equipment rental",
      })
    );
    expect(xml).toContain("<CheckAddRq");
    expect(xml).toContain("<PayeeEntityRef>");
    expect(xml).toContain("<FullName>ACME Corp</FullName>");
    expect(xml).toContain("<Amount>800.00</Amount>");
  });

  it("addCheck without payee", () => {
    const xml = parseXml(
      qbxml.addCheck({
        bankAccountListId: "B-100",
        expenseAccountListId: "E-300",
        date: new Date("2026-09-01"),
        amount: 100.0,
        memo: "Misc",
      })
    );
    expect(xml).not.toContain("<PayeeEntityRef>");
  });
});

describe("qbxml cleared status", () => {
  it("setClearedStatus includes EditSequence", () => {
    const xml = parseXml(
      qbxml.setClearedStatus("T-123", "ES-456", "Check", true)
    );
    expect(xml).toContain("<CheckModRq");
    expect(xml).toContain("<TxnID>T-123</TxnID>");
    expect(xml).toContain("<EditSequence>ES-456</EditSequence>");
    expect(xml).toContain("<ClearedStatus>Cleared</ClearedStatus>");
  });

  it("batchSetCleared", () => {
    const xml = parseXml(
      qbxml.batchSetCleared([
        { txnId: "T-1", editSequence: "ES-1", txnType: "Check" },
        { txnId: "T-2", editSequence: "ES-2", txnType: "Deposit" },
      ])
    );
    expect(xml).toContain('<CheckModRq requestID="1">');
    expect(xml).toContain('<DepositModRq requestID="2">');
    expect(xml).toContain("<EditSequence>ES-1</EditSequence>");
    expect(xml).toContain("<EditSequence>ES-2</EditSequence>");
  });
});

describe("xml escaping", () => {
  it("escapes special characters", () => {
    const xml = qbxml.addVendor({ name: 'M&M\'s "Fresh" <Produce>' });
    expect(xml).toContain(
      "&amp;M&apos;s &quot;Fresh&quot; &lt;Produce&gt;"
    );
  });
});
