import type {
  Transaction,
  QBInvoice,
  QBBill,
  QBCustomer,
  QBVendor,
  QBTransaction,
  MatchResult,
  InvoiceMatch,
  BillMatch,
  ReconAction,
  ReceivePaymentAction,
  BillPaymentAction,
  CreateExpenseAction,
  CreateDepositAction,
  ClearExistingAction,
} from "@qb-toolkit/core";

export interface QBData {
  invoices: QBInvoice[];
  bills: QBBill[];
  customers: QBCustomer[];
  vendors: QBVendor[];
  transactions: QBTransaction[];
}

export interface PlanConfig {
  bankAccountListId: string;
  defaultExpenseAccountListId?: string;
  defaultIncomeAccountListId?: string;
}

export interface ActionPlan {
  actions: ReconAction[];
  autoConfirmed: number;
  needsReview: number;
}

const HIGH_CONFIDENCE = 0.8;

export function planActions(
  bankTxns: Transaction[],
  qbData: QBData,
  invoiceMatches: Map<Transaction, InvoiceMatch | null>,
  billMatches: Map<Transaction, BillMatch | null>,
  existingMatches: MatchResult[],
  config: PlanConfig
): ActionPlan {
  const actions: ReconAction[] = [];
  const handled = new Set<Transaction>();
  let autoConfirmed = 0;
  let needsReview = 0;

  // 1. Credits matched to invoices → ReceivePayment
  for (const [txn, match] of invoiceMatches) {
    if (!match) continue;
    handled.add(txn);
    const customer = qbData.customers.find(
      (c) => c.listId === match.invoice.customerRef.listId
    );
    const confirmed = match.score >= HIGH_CONFIDENCE;
    if (confirmed) autoConfirmed++;
    else needsReview++;

    actions.push({
      type: "receive-payment",
      bankTxn: txn,
      confirmed,
      invoice: match.invoice,
      customer: customer ?? {
        listId: match.invoice.customerRef.listId,
        name: match.invoice.customerRef.name,
      },
      bankAccountListId: config.bankAccountListId,
    } as ReceivePaymentAction);
  }

  // 2. Debits matched to bills → BillPayment
  for (const [txn, match] of billMatches) {
    if (!match) continue;
    handled.add(txn);
    const vendor = qbData.vendors.find(
      (v) => v.listId === match.bill.vendorRef.listId
    );
    const confirmed = match.score >= HIGH_CONFIDENCE;
    if (confirmed) autoConfirmed++;
    else needsReview++;

    actions.push({
      type: "bill-payment",
      bankTxn: txn,
      confirmed,
      bill: match.bill,
      vendor: vendor ?? {
        listId: match.bill.vendorRef.listId,
        name: match.bill.vendorRef.name,
      },
      bankAccountListId: config.bankAccountListId,
    } as BillPaymentAction);
  }

  // 3. Transactions already in QB → ClearExisting
  for (const match of existingMatches) {
    if (!match.qbTxn || handled.has(match.bankTxn)) continue;
    if (match.status === "unmatched") continue;
    handled.add(match.bankTxn);
    autoConfirmed++;

    actions.push({
      type: "clear-existing",
      bankTxn: match.bankTxn,
      confirmed: match.confidence >= HIGH_CONFIDENCE,
      qbTxn: match.qbTxn,
      editSequence: "",
    } as ClearExistingAction);
  }

  // 4. Remaining unmatched → CreateExpense (debits) or CreateDeposit (credits)
  for (const txn of bankTxns) {
    if (handled.has(txn)) continue;
    needsReview++;

    if (txn.type === "debit") {
      actions.push({
        type: "create-expense",
        bankTxn: txn,
        confirmed: false,
        glAccountListId: config.defaultExpenseAccountListId,
        bankAccountListId: config.bankAccountListId,
      } as CreateExpenseAction);
    } else {
      actions.push({
        type: "create-deposit",
        bankTxn: txn,
        confirmed: false,
        glAccountListId: config.defaultIncomeAccountListId,
        bankAccountListId: config.bankAccountListId,
      } as CreateDepositAction);
    }
  }

  return { actions, autoConfirmed, needsReview };
}

export function getConfirmedActions(plan: ActionPlan): ReconAction[] {
  return plan.actions.filter((a) => a.confirmed);
}

export function getActionsNeedingReview(plan: ActionPlan): ReconAction[] {
  return plan.actions.filter((a) => !a.confirmed);
}
