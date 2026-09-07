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
import type { QBDataProvider } from "./qb-provider.js";

const BRIDGE_URL = "/qbxml";

async function sendQBXML(xml: string): Promise<string> {
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("QB request failed: " + err);
  }
  return res.text();
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp("<" + name + ">([^<]*)</" + name + ">"));
  return m ? m[1] : "";
}

function blocks(xml: string, name: string): string[] {
  const results: string[] = [];
  const re = new RegExp("<" + name + ">[\\s\\S]*?</" + name + ">", "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[0]);
  return results;
}

function refBlock(xml: string, refName: string): { listId: string; name: string } {
  const b = xml.match(new RegExp("<" + refName + ">[\\s\\S]*?</" + refName + ">"));
  const inner = b ? b[0] : "";
  return { listId: tag(inner, "ListID"), name: tag(inner, "FullName") };
}

export const bridgeProvider: QBDataProvider = {
  async getAccounts(): Promise<QBAccount[]> {
    const xml = await sendQBXML(qbxml.queryAccounts());
    return blocks(xml, "AccountRet").map((b) => ({
      listId: tag(b, "ListID"),
      name: tag(b, "FullName") || tag(b, "Name"),
      accountType: tag(b, "AccountType"),
      accountNumber: tag(b, "AccountNumber") || undefined,
    }));
  },

  async getCustomers(): Promise<QBCustomer[]> {
    const xml = await sendQBXML(qbxml.queryCustomers());
    return blocks(xml, "CustomerRet").map((b) => ({
      listId: tag(b, "ListID"),
      name: tag(b, "FullName") || tag(b, "Name"),
      companyName: tag(b, "CompanyName") || undefined,
      accountNumber: tag(b, "AccountNumber") || undefined,
    }));
  },

  async getVendors(): Promise<QBVendor[]> {
    const xml = await sendQBXML(qbxml.queryVendors());
    return blocks(xml, "VendorRet").map((b) => ({
      listId: tag(b, "ListID"),
      name: tag(b, "FullName") || tag(b, "Name"),
      companyName: tag(b, "CompanyName") || undefined,
      accountNumber: tag(b, "AccountNumber") || undefined,
    }));
  },

  async getInvoices(): Promise<QBInvoice[]> {
    const xml = await sendQBXML(qbxml.queryInvoices());
    return blocks(xml, "InvoiceRet").map((b) => ({
      txnId: tag(b, "TxnID"),
      customerRef: refBlock(b, "CustomerRef"),
      refNumber: tag(b, "RefNumber") || undefined,
      txnDate: new Date(tag(b, "TxnDate")),
      amount: parseFloat(tag(b, "Subtotal") || "0"),
      balanceRemaining: parseFloat(tag(b, "BalanceRemaining") || "0"),
      isPaid: parseFloat(tag(b, "BalanceRemaining") || "0") <= 0,
    }));
  },

  async getBills(): Promise<QBBill[]> {
    const xml = await sendQBXML(qbxml.queryBills());
    return blocks(xml, "BillRet").map((b) => ({
      txnId: tag(b, "TxnID"),
      vendorRef: refBlock(b, "VendorRef"),
      refNumber: tag(b, "RefNumber") || undefined,
      txnDate: new Date(tag(b, "TxnDate")),
      amount: parseFloat(tag(b, "AmountDue") || "0"),
      amountDue: parseFloat(tag(b, "AmountDue") || "0"),
      isPaid: parseFloat(tag(b, "AmountDue") || "0") <= 0,
    }));
  },

  async getTransactions(accountListId: string): Promise<QBTransaction[]> {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const xml = await sendQBXML(qbxml.queryTransactions(accountListId, sixMonthsAgo, now));
    return blocks(xml, "TransactionRet").map((b) => ({
      txnId: tag(b, "TxnID"),
      txnType: tag(b, "TxnType") || undefined,
      date: new Date(tag(b, "TxnDate")),
      amount: parseFloat(tag(b, "Amount") || "0"),
      memo: tag(b, "Memo") || undefined,
      refNumber: tag(b, "RefNumber") || undefined,
      accountRef: tag(b, "AccountRef"),
      clearedStatus: (tag(b, "ClearedStatus") as "Cleared" | "NotCleared") || undefined,
    }));
  },

  async getAllData(bankAccountListId: string): Promise<QBData> {
    const [invoices, bills, customers, vendors, transactions] = await Promise.all([
      this.getInvoices(),
      this.getBills(),
      this.getCustomers(),
      this.getVendors(),
      this.getTransactions(bankAccountListId),
    ]);
    return { invoices, bills, customers, vendors, transactions };
  },
};

export async function isBridgeAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/status", { signal: AbortSignal.timeout(1000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data.port === 2707;
  } catch {
    return false;
  }
}
