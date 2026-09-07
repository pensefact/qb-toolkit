// ── Bank statement types ──

export interface Transaction {
  date: Date;
  amount: number;
  description: string;
  reference: string;
  balance?: number;
  type: "debit" | "credit";
}

export interface BankStatement {
  bank: BankId;
  accountNumber: string;
  accountHolder?: string;
  statementDate?: Date;
  openingBalance?: number;
  closingBalance?: number;
  transactions: Transaction[];
}

export type BankId = "fnb" | "standard-bank" | "nedbank" | "absa" | "capitec";

// ── QuickBooks entity types ──

export interface QBAccount {
  listId: string;
  name: string;
  accountType: string;
  accountNumber?: string;
}

export interface QBCustomer {
  listId: string;
  name: string;
  companyName?: string;
  accountNumber?: string;
}

export interface QBVendor {
  listId: string;
  name: string;
  companyName?: string;
  accountNumber?: string;
}

export interface QBInvoice {
  txnId: string;
  customerRef: { listId: string; name: string };
  refNumber?: string;
  txnDate: Date;
  amount: number;
  balanceRemaining: number;
  isPaid: boolean;
  memo?: string;
}

export interface QBBill {
  txnId: string;
  vendorRef: { listId: string; name: string };
  refNumber?: string;
  txnDate: Date;
  amount: number;
  amountDue: number;
  isPaid: boolean;
  memo?: string;
}

export interface QBTransaction {
  txnId: string;
  txnType?: string;
  date: Date;
  amount: number;
  memo?: string;
  refNumber?: string;
  accountRef: string;
  clearedStatus?: "Cleared" | "NotCleared";
}

// ── Matching types ──

export interface InvoiceMatch {
  invoice: QBInvoice;
  score: number;
}

export interface BillMatch {
  bill: QBBill;
  score: number;
}

export interface MatchResult {
  bankTxn: Transaction;
  qbTxn?: QBTransaction;
  confidence: number;
  status: "matched" | "unmatched" | "ambiguous";
  invoiceMatch?: InvoiceMatch;
  billMatch?: BillMatch;
}

// ── Reconciliation action types ──

export type ReconAction =
  | ReceivePaymentAction
  | BillPaymentAction
  | CreateExpenseAction
  | CreateDepositAction
  | CreateJournalEntryAction
  | ClearExistingAction;

interface BaseAction {
  bankTxn: Transaction;
  confirmed: boolean;
}

export interface ReceivePaymentAction extends BaseAction {
  type: "receive-payment";
  invoice: QBInvoice;
  customer: QBCustomer;
  bankAccountListId: string;
}

export interface BillPaymentAction extends BaseAction {
  type: "bill-payment";
  bill: QBBill;
  vendor: QBVendor;
  bankAccountListId: string;
}

export interface CreateExpenseAction extends BaseAction {
  type: "create-expense";
  glAccountListId?: string;
  glAccountName?: string;
  vendorName?: string;
  bankAccountListId: string;
}

export interface CreateDepositAction extends BaseAction {
  type: "create-deposit";
  glAccountListId?: string;
  glAccountName?: string;
  bankAccountListId: string;
}

export interface CreateJournalEntryAction extends BaseAction {
  type: "create-journal-entry";
  debitAccountListId: string;
  creditAccountListId: string;
  bankAccountListId: string;
  memo?: string;
}

export interface ClearExistingAction extends BaseAction {
  type: "clear-existing";
  qbTxn: QBTransaction;
  editSequence: string;
}

// ── Supplier / EFT types ──

export interface Supplier {
  listId: string;
  name: string;
  accountNumber?: string;
  bankAccount?: BankAccountDetails;
}

export interface BankAccountDetails {
  bank: BankId;
  branchCode: string;
  accountNumber: string;
  accountType: "cheque" | "savings" | "transmission";
  holderName: string;
}

// ── SARS types ──

export interface VATReturn {
  period: { from: Date; to: Date };
  standardRatedSupplies: number;
  zeroRatedSupplies: number;
  exemptSupplies: number;
  standardRatedInputs: number;
  capitalGoods: number;
  outputVAT: number;
  inputVAT: number;
  netVAT: number;
}
