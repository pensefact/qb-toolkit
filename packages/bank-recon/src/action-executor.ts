import type { ReconAction } from "@qb-toolkit/core";
import { qbxml } from "@qb-toolkit/core";

export interface QBXMLRequest {
  action: ReconAction;
  xml: string;
}

export function generateRequests(actions: ReconAction[]): QBXMLRequest[] {
  return actions.filter((a) => a.confirmed).map((action) => ({
    action,
    xml: actionToXml(action),
  }));
}

function actionToXml(action: ReconAction): string {
  switch (action.type) {
    case "receive-payment":
      return qbxml.receivePayment({
        customerListId: action.customer.listId,
        bankAccountListId: action.bankAccountListId,
        invoiceTxnId: action.invoice.txnId,
        amount: action.bankTxn.amount,
        date: action.bankTxn.date,
        refNumber: action.bankTxn.reference || undefined,
        memo: `Bank import: ${action.bankTxn.description}`,
      });

    case "bill-payment":
      return qbxml.billPayment({
        vendorListId: action.vendor.listId,
        bankAccountListId: action.bankAccountListId,
        billTxnId: action.bill.txnId,
        amount: action.bankTxn.amount,
        date: action.bankTxn.date,
        memo: `Bank import: ${action.bankTxn.description}`,
      });

    case "create-expense":
      return qbxml.addCheck({
        bankAccountListId: action.bankAccountListId,
        expenseAccountListId: action.glAccountListId ?? "",
        date: action.bankTxn.date,
        amount: action.bankTxn.amount,
        payee: action.vendorName,
        memo: action.bankTxn.description,
        refNumber: action.bankTxn.reference || undefined,
      });

    case "create-deposit":
      return qbxml.addJournalEntry({
        debitAccountListId: action.bankAccountListId,
        creditAccountListId: action.glAccountListId ?? "",
        date: action.bankTxn.date,
        amount: action.bankTxn.amount,
        memo: action.bankTxn.description,
        refNumber: action.bankTxn.reference || undefined,
      });

    case "create-journal-entry":
      return qbxml.addJournalEntry({
        debitAccountListId: action.debitAccountListId,
        creditAccountListId: action.creditAccountListId,
        date: action.bankTxn.date,
        amount: action.bankTxn.amount,
        memo: action.memo ?? action.bankTxn.description,
      });

    case "clear-existing":
      return qbxml.setClearedStatus(
        action.qbTxn.txnId,
        action.editSequence,
        (action.qbTxn.txnType ?? "Check") as qbxml.QBTxnType,
        true
      );
  }
}
