import type {
  QBAccount,
  QBCustomer,
  QBVendor,
  QBInvoice,
  QBBill,
  QBTransaction,
} from "@qb-toolkit/core";
import { qbxml } from "@qb-toolkit/core";
import type { QBData } from "@qb-toolkit/bank-recon";
import { QBBridgeClient } from "./client.js";

export class QBBridgeProvider {
  private client: QBBridgeClient;

  constructor(bridgeUrl?: string) {
    this.client = new QBBridgeClient(bridgeUrl);
  }

  async getAccounts(): Promise<QBAccount[]> {
    const xml = qbxml.queryAccounts();
    const response = await this.client.sendRequest(xml);
    return parseAccountsResponse(response);
  }

  async getCustomers(): Promise<QBCustomer[]> {
    const xml = qbxml.queryCustomers();
    const response = await this.client.sendRequest(xml);
    return parseCustomersResponse(response);
  }

  async getVendors(): Promise<QBVendor[]> {
    const xml = qbxml.queryVendors();
    const response = await this.client.sendRequest(xml);
    return parseVendorsResponse(response);
  }

  async getInvoices(): Promise<QBInvoice[]> {
    const xml = qbxml.queryInvoices();
    const response = await this.client.sendRequest(xml);
    return parseInvoicesResponse(response);
  }

  async getBills(): Promise<QBBill[]> {
    const xml = qbxml.queryBills();
    const response = await this.client.sendRequest(xml);
    return parseBillsResponse(response);
  }

  async getTransactions(accountListId: string): Promise<QBTransaction[]> {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const xml = qbxml.queryTransactions(accountListId, sixMonthsAgo, now);
    const response = await this.client.sendRequest(xml);
    return parseTransactionsResponse(response);
  }

  async getAllData(bankAccountListId: string): Promise<QBData> {
    const [invoices, bills, customers, vendors, transactions] = await Promise.all([
      this.getInvoices(),
      this.getBills(),
      this.getCustomers(),
      this.getVendors(),
      this.getTransactions(bankAccountListId),
    ]);
    return { invoices, bills, customers, vendors, transactions };
  }

  async executeRequest(requestXml: string): Promise<string> {
    return this.client.sendRequest(requestXml);
  }

  async executeBatch(requests: string[]): Promise<Array<{ success: boolean; response?: string; error?: string }>> {
    return this.client.sendBatch(requests);
  }
}

// XML response parsers — extract data from qbXML responses
// These use basic string parsing since DOMParser isn't available in all contexts

function parseXmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const m = xml.match(re);
  return m ? m[1] : "";
}

function parseXmlBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

function parseAccountsResponse(xml: string): QBAccount[] {
  return parseXmlBlocks(xml, "AccountRet").map((block) => ({
    listId: parseXmlTag(block, "ListID"),
    name: parseXmlTag(block, "FullName") || parseXmlTag(block, "Name"),
    accountType: parseXmlTag(block, "AccountType"),
    accountNumber: parseXmlTag(block, "AccountNumber") || undefined,
  }));
}

function parseCustomersResponse(xml: string): QBCustomer[] {
  return parseXmlBlocks(xml, "CustomerRet").map((block) => ({
    listId: parseXmlTag(block, "ListID"),
    name: parseXmlTag(block, "FullName") || parseXmlTag(block, "Name"),
    companyName: parseXmlTag(block, "CompanyName") || undefined,
    accountNumber: parseXmlTag(block, "AccountNumber") || undefined,
  }));
}

function parseVendorsResponse(xml: string): QBVendor[] {
  return parseXmlBlocks(xml, "VendorRet").map((block) => ({
    listId: parseXmlTag(block, "ListID"),
    name: parseXmlTag(block, "FullName") || parseXmlTag(block, "Name"),
    companyName: parseXmlTag(block, "CompanyName") || undefined,
    accountNumber: parseXmlTag(block, "AccountNumber") || undefined,
  }));
}

function parseInvoicesResponse(xml: string): QBInvoice[] {
  return parseXmlBlocks(xml, "InvoiceRet").map((block) => {
    const customerBlock = block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? "";
    return {
      txnId: parseXmlTag(block, "TxnID"),
      customerRef: {
        listId: parseXmlTag(customerBlock, "ListID"),
        name: parseXmlTag(customerBlock, "FullName"),
      },
      refNumber: parseXmlTag(block, "RefNumber") || undefined,
      txnDate: new Date(parseXmlTag(block, "TxnDate")),
      amount: parseFloat(parseXmlTag(block, "Subtotal") || "0"),
      balanceRemaining: parseFloat(parseXmlTag(block, "BalanceRemaining") || "0"),
      isPaid: parseFloat(parseXmlTag(block, "BalanceRemaining") || "0") <= 0,
    };
  });
}

function parseBillsResponse(xml: string): QBBill[] {
  return parseXmlBlocks(xml, "BillRet").map((block) => {
    const vendorBlock = block.match(/<VendorRef>[\s\S]*?<\/VendorRef>/)?.[0] ?? "";
    return {
      txnId: parseXmlTag(block, "TxnID"),
      vendorRef: {
        listId: parseXmlTag(vendorBlock, "ListID"),
        name: parseXmlTag(vendorBlock, "FullName"),
      },
      refNumber: parseXmlTag(block, "RefNumber") || undefined,
      txnDate: new Date(parseXmlTag(block, "TxnDate")),
      amount: parseFloat(parseXmlTag(block, "AmountDue") || "0"),
      amountDue: parseFloat(parseXmlTag(block, "AmountDue") || "0"),
      isPaid: parseFloat(parseXmlTag(block, "AmountDue") || "0") <= 0,
    };
  });
}

function parseTransactionsResponse(xml: string): QBTransaction[] {
  return parseXmlBlocks(xml, "TransactionRet").map((block) => ({
    txnId: parseXmlTag(block, "TxnID"),
    txnType: parseXmlTag(block, "TxnType") || undefined,
    date: new Date(parseXmlTag(block, "TxnDate")),
    amount: parseFloat(parseXmlTag(block, "Amount") || "0"),
    memo: parseXmlTag(block, "Memo") || undefined,
    refNumber: parseXmlTag(block, "RefNumber") || undefined,
    accountRef: parseXmlTag(block, "AccountRef"),
    clearedStatus: (parseXmlTag(block, "ClearedStatus") as "Cleared" | "NotCleared") || undefined,
  }));
}
