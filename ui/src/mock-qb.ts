import type { QBAccount, QBTransaction } from "@qb-toolkit/core";

export const MOCK_BANK_ACCOUNTS: QBAccount[] = [
  { listId: "ACC-001", name: "FNB Cheque Account", accountType: "Bank", accountNumber: "62123456789" },
  { listId: "ACC-002", name: "Standard Bank Current", accountType: "Bank", accountNumber: "1234567890" },
  { listId: "ACC-003", name: "Nedbank Business", accountType: "Bank", accountNumber: "1098765432" },
  { listId: "ACC-004", name: "Petty Cash", accountType: "Bank" },
];

export const MOCK_GL_ACCOUNTS: QBAccount[] = [
  // Income
  { listId: "GL-100", name: "Sales Revenue", accountType: "Income" },
  { listId: "GL-101", name: "Rental Income", accountType: "Income" },
  { listId: "GL-102", name: "Interest Income", accountType: "Income" },
  { listId: "GL-103", name: "Other Income", accountType: "Income" },
  // Cost of Sales
  { listId: "GL-200", name: "Cost of Goods Sold", accountType: "CostOfGoodsSold" },
  // Expenses
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
  // Equity / Transfer
  { listId: "GL-400", name: "Owner's Draw", accountType: "Equity" },
  { listId: "GL-401", name: "Inter-Account Transfer", accountType: "OtherCurrentAsset" },
];

export const MOCK_TRANSACTIONS: QBTransaction[] = [
  { txnId: "TXN-001", txnType: "Check", date: new Date("2024-09-05"), amount: 1500, memo: "WOOLWORTHS CARD PURCHASE", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-002", txnType: "Deposit", date: new Date("2024-09-05"), amount: 25000, memo: "SALARY PAYMENT", refNumber: "789012", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-003", txnType: "Deposit", date: new Date("2024-09-03"), amount: 4200, memo: "RENT RECEIVED", refNumber: "RENT-SEP", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-004", txnType: "Check", date: new Date("2024-09-06"), amount: 899.99, memo: "CELL C AIRTIME", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-005", txnType: "Transfer", date: new Date("2024-09-07"), amount: 3500, memo: "TRANSFER TO SAVINGS", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-006", txnType: "Check", date: new Date("2024-09-10"), amount: 650, memo: "UBER TRIPS", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-007", txnType: "Check", date: new Date("2024-09-11"), amount: 2100, memo: "TAKEALOT ORDER", refNumber: "TAK-445566", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-008", txnType: "Check", date: new Date("2024-09-12"), amount: 180.50, memo: "ENGEN FUEL", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-009", txnType: "Deposit", date: new Date("2024-09-15"), amount: 12000, memo: "INVOICE PAYMENT CLIENT A", refNumber: "INV-2024-089", accountRef: "ACC-001", clearedStatus: "NotCleared" },
  { txnId: "TXN-010", txnType: "Check", date: new Date("2024-09-15"), amount: 750, memo: "DISCOVERY MEDICAL AID", accountRef: "ACC-001", clearedStatus: "NotCleared" },

  { txnId: "TXN-020", txnType: "Deposit", date: new Date("2024-09-02"), amount: 45000, memo: "SALARY DEPOSIT", refNumber: "SAL-SEP", accountRef: "ACC-002", clearedStatus: "NotCleared" },
  { txnId: "TXN-021", txnType: "Check", date: new Date("2024-09-03"), amount: 12000, memo: "RENT PAYMENT", accountRef: "ACC-002", clearedStatus: "NotCleared" },
  { txnId: "TXN-022", txnType: "Check", date: new Date("2024-09-05"), amount: 850.75, memo: "CHECKERS GROCERY", accountRef: "ACC-002", clearedStatus: "NotCleared" },
  { txnId: "TXN-023", txnType: "Check", date: new Date("2024-09-08"), amount: 1200, memo: "VODACOM CONTRACT", accountRef: "ACC-002", clearedStatus: "NotCleared" },
  { txnId: "TXN-024", txnType: "Check", date: new Date("2024-09-10"), amount: 5500, memo: "CAR INSURANCE", accountRef: "ACC-002", clearedStatus: "NotCleared" },

  { txnId: "TXN-030", txnType: "Deposit", date: new Date("2024-09-02"), amount: 38000, memo: "SALARY", accountRef: "ACC-003", clearedStatus: "NotCleared" },
  { txnId: "TXN-031", txnType: "Check", date: new Date("2024-09-04"), amount: 8500, memo: "OFFICE RENT", refNumber: "RENT-09", accountRef: "ACC-003", clearedStatus: "NotCleared" },
  { txnId: "TXN-032", txnType: "Check", date: new Date("2024-09-06"), amount: 1250, memo: "STATIONERY SUPPLIES", accountRef: "ACC-003", clearedStatus: "NotCleared" },
  { txnId: "TXN-033", txnType: "Check", date: new Date("2024-09-09"), amount: 3200, memo: "IT EQUIPMENT", refNumber: "PO-2024-112", accountRef: "ACC-003", clearedStatus: "NotCleared" },
  { txnId: "TXN-034", txnType: "Check", date: new Date("2024-09-12"), amount: 420, memo: "COURIER CHARGES", accountRef: "ACC-003", clearedStatus: "NotCleared" },
];

// Suggest a GL account based on description keywords
const KEYWORD_MAP: Array<[RegExp, string]> = [
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

export function getTransactionsForAccount(accountListId: string): QBTransaction[] {
  return MOCK_TRANSACTIONS.filter((t) => t.accountRef === accountListId);
}

export function findAccountByNumber(accountNumber: string): QBAccount | undefined {
  return MOCK_BANK_ACCOUNTS.find((a) => a.accountNumber === accountNumber);
}
