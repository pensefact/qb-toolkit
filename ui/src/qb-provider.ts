import type {
  QBAccount,
  QBCustomer,
  QBVendor,
  QBInvoice,
  QBBill,
  QBTransaction,
} from "@qb-toolkit/core";
import type { QBData } from "@qb-toolkit/bank-recon";

export interface QBDataProvider {
  getAccounts(): Promise<QBAccount[]>;
  getCustomers(): Promise<QBCustomer[]>;
  getVendors(): Promise<QBVendor[]>;
  getInvoices(): Promise<QBInvoice[]>;
  getBills(): Promise<QBBill[]>;
  getTransactions(accountListId: string): Promise<QBTransaction[]>;
  getAllData(bankAccountListId: string): Promise<QBData>;
}

export function findAccountByNumber(
  accounts: QBAccount[],
  accountNumber: string
): QBAccount | undefined {
  return accounts.find((a) => a.accountNumber === accountNumber);
}
