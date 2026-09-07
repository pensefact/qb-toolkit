import type {
  QBAccount,
  QBCustomer,
  QBVendor,
  QBInvoice,
  QBBill,
  QBTransaction,
} from "@qb-toolkit/core";
import type { QBData } from "@qb-toolkit/bank-recon";
import type { QBDataProvider } from "./qb-provider.js";

const BANK_ACCOUNTS: QBAccount[] = [
  { listId: "ACC-001", name: "FNB Cheque Account", accountType: "Bank", accountNumber: "62123456789" },
  { listId: "ACC-002", name: "Standard Bank Current", accountType: "Bank", accountNumber: "1234567890" },
  { listId: "ACC-003", name: "Nedbank Business", accountType: "Bank", accountNumber: "1098765432" },
];

const GL_ACCOUNTS: QBAccount[] = [
  { listId: "GL-100", name: "Sales Revenue", accountType: "Income" },
  { listId: "GL-101", name: "Rental Income", accountType: "Income" },
  { listId: "GL-102", name: "Interest Income", accountType: "Income" },
  { listId: "GL-103", name: "Other Income", accountType: "Income" },
  { listId: "GL-200", name: "Cost of Goods Sold", accountType: "CostOfGoodsSold" },
  { listId: "GL-300", name: "Rent Expense", accountType: "Expense" },
  { listId: "GL-301", name: "Salaries & Wages", accountType: "Expense" },
  { listId: "GL-302", name: "Telephone & Internet", accountType: "Expense" },
  { listId: "GL-303", name: "Motor Vehicle Expenses", accountType: "Expense" },
  { listId: "GL-304", name: "Insurance", accountType: "Expense" },
  { listId: "GL-305", name: "Office Supplies", accountType: "Expense" },
  { listId: "GL-306", name: "Advertising & Marketing", accountType: "Expense" },
  { listId: "GL-307", name: "Professional Fees", accountType: "Expense" },
  { listId: "GL-308", name: "Travel & Accommodation", accountType: "Expense" },
  { listId: "GL-309", name: "Subscriptions", accountType: "Expense" },
  { listId: "GL-310", name: "Bank Charges", accountType: "Expense" },
  { listId: "GL-311", name: "Groceries & Food", accountType: "Expense" },
  { listId: "GL-312", name: "Medical Expenses", accountType: "Expense" },
  { listId: "GL-313", name: "Repairs & Maintenance", accountType: "Expense" },
  { listId: "GL-314", name: "Delivery & Courier", accountType: "Expense" },
  { listId: "GL-315", name: "General Expense", accountType: "Expense" },
  { listId: "GL-400", name: "Owner's Draw", accountType: "Equity" },
  { listId: "GL-401", name: "Inter-Account Transfer", accountType: "OtherCurrentAsset" },
];

const CUSTOMERS: QBCustomer[] = [
  { listId: "CUST-001", name: "Client A" },
  { listId: "CUST-002", name: "Rental Tenant" },
];

const VENDORS: QBVendor[] = [
  { listId: "VEND-001", name: "Woolworths" },
  { listId: "VEND-002", name: "Vodacom" },
  { listId: "VEND-003", name: "Discovery" },
];

const INVOICES: QBInvoice[] = [
  {
    txnId: "INV-001", customerRef: { listId: "CUST-001", name: "Client A" },
    refNumber: "INV-2024-089", txnDate: new Date("2024-09-10"),
    amount: 12000, balanceRemaining: 12000, isPaid: false,
  },
  {
    txnId: "INV-002", customerRef: { listId: "CUST-002", name: "Rental Tenant" },
    refNumber: "RENT-SEP", txnDate: new Date("2024-09-01"),
    amount: 4200, balanceRemaining: 4200, isPaid: false,
  },
];

const BILLS: QBBill[] = [
  {
    txnId: "BILL-001", vendorRef: { listId: "VEND-002", name: "Vodacom" },
    txnDate: new Date("2024-09-01"), amount: 350.50, amountDue: 350.50, isPaid: false,
  },
  {
    txnId: "BILL-002", vendorRef: { listId: "VEND-003", name: "Discovery" },
    txnDate: new Date("2024-09-01"), amount: 750, amountDue: 750, isPaid: false,
  },
];

const TRANSACTIONS: QBTransaction[] = [
  { txnId: "TXN-001", txnType: "Check", date: new Date("2024-09-05"), amount: 1500, memo: "WOOLWORTHS CARD PURCHASE", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-002", txnType: "Deposit", date: new Date("2024-09-05"), amount: 25000, memo: "SALARY PAYMENT", refNumber: "789012", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-003", txnType: "Deposit", date: new Date("2024-09-03"), amount: 4200, memo: "RENT RECEIVED", refNumber: "RENT-SEP", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-004", txnType: "Check", date: new Date("2024-09-06"), amount: 899.99, memo: "CELL C AIRTIME", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-005", txnType: "Deposit", date: new Date("2024-09-15"), amount: 12000, memo: "INVOICE PAYMENT CLIENT A", refNumber: "INV-2024-089", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-006", txnType: "Check", date: new Date("2024-09-15"), amount: 750, memo: "DISCOVERY MEDICAL AID", accountRef: "ACC-001", clearedStatus: "NotCleared" },
];

export const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/woolworths|checkers|pick.n.pay|spar|grocery|food/i, "GL-311"],
  [/rent\b/i, "GL-300"],
  [/salary|wage/i, "GL-301"],
  [/vodacom|mtn|cell|telkom|fibre|internet/i, "GL-302"],
  [/fuel|engen|shell|caltex|sasol|garage/i, "GL-303"],
  [/insurance|outsurance|discovery.*(?:car|home)|santam/i, "GL-304"],
  [/stationery|office/i, "GL-305"],
  [/uber|bolt|travel|flight|hotel/i, "GL-308"],
  [/takealot|amazon|subscription/i, "GL-309"],
  [/bank.*charge|service.*fee/i, "GL-310"],
  [/discovery.*(?:health|medical)|medical.*aid/i, "GL-312"],
  [/courier|delivery|mr.delivery/i, "GL-314"],
  [/transfer|savings/i, "GL-401"],
  [/invoice|client|payment.*received/i, "GL-100"],
  [/rent.*received|rental.*income/i, "GL-101"],
];

export function suggestGLAccount(description: string): string | null {
  for (const [pattern, accountId] of KEYWORD_MAP) {
    if (pattern.test(description)) return accountId;
  }
  return null;
}

export function getGLAccounts(): QBAccount[] {
  return GL_ACCOUNTS;
}

export const mockProvider: QBDataProvider = {
  async getAccounts() { return [...BANK_ACCOUNTS, ...GL_ACCOUNTS]; },
  async getCustomers() { return CUSTOMERS; },
  async getVendors() { return VENDORS; },
  async getInvoices() { return INVOICES; },
  async getBills() { return BILLS; },
  async getTransactions(accountListId: string) {
    return TRANSACTIONS.filter((t) => t.accountRef === accountListId);
  },
  async getAllData(bankAccountListId: string) {
    return {
      invoices: INVOICES,
      bills: BILLS,
      customers: CUSTOMERS,
      vendors: VENDORS,
      transactions: TRANSACTIONS.filter((t) => t.accountRef === bankAccountListId),
    };
  },
};
