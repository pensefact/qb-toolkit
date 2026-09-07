function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function wrapRequest(version: string, body: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<?qbxml version="' + version + '"?>',
    "<QBXML>",
    '<QBXMLMsgsRq onError="stopOnError">',
    body,
    "</QBXMLMsgsRq>",
    "</QBXML>",
  ].join("\n");
}

export type QBTxnType =
  | "Check"
  | "Deposit"
  | "JournalEntry"
  | "CreditCardCharge"
  | "CreditCardCredit"
  | "Bill"
  | "BillPaymentCheck"
  | "SalesReceipt"
  | "ReceivePayment"
  | "Transfer";

// ── Queries ──

export function queryAccounts(): string {
  return wrapRequest(
    "13.0",
    `<AccountQueryRq requestID="1">
</AccountQueryRq>`
  );
}

export function queryCustomers(): string {
  return wrapRequest(
    "13.0",
    `<CustomerQueryRq requestID="1">
  <ActiveStatus>ActiveOnly</ActiveStatus>
</CustomerQueryRq>`
  );
}

export function queryVendors(): string {
  return wrapRequest(
    "13.0",
    `<VendorQueryRq requestID="1">
  <ActiveStatus>ActiveOnly</ActiveStatus>
</VendorQueryRq>`
  );
}

export function queryInvoices(fromDate?: Date, toDate?: Date): string {
  const dateFilter =
    fromDate && toDate
      ? `<ModifiedDateRangeFilter>
    <FromModifiedDate>${formatDate(fromDate)}</FromModifiedDate>
    <ToModifiedDate>${formatDate(toDate)}</ToModifiedDate>
  </ModifiedDateRangeFilter>`
      : "";
  return wrapRequest(
    "13.0",
    `<InvoiceQueryRq requestID="1">
  ${dateFilter}
  <PaidStatus>NotPaidOnly</PaidStatus>
</InvoiceQueryRq>`
  );
}

export function queryBills(fromDate?: Date, toDate?: Date): string {
  const dateFilter =
    fromDate && toDate
      ? `<ModifiedDateRangeFilter>
    <FromModifiedDate>${formatDate(fromDate)}</FromModifiedDate>
    <ToModifiedDate>${formatDate(toDate)}</ToModifiedDate>
  </ModifiedDateRangeFilter>`
      : "";
  return wrapRequest(
    "13.0",
    `<BillQueryRq requestID="1">
  ${dateFilter}
  <PaidStatus>NotPaidOnly</PaidStatus>
</BillQueryRq>`
  );
}

export function queryTransactions(
  accountListId: string,
  fromDate: Date,
  toDate: Date
): string {
  return wrapRequest(
    "13.0",
    `<TransactionQueryRq requestID="1">
  <TransactionModifiedDateRangeFilter>
    <FromModifiedDate>${formatDate(fromDate)}</FromModifiedDate>
    <ToModifiedDate>${formatDate(toDate)}</ToModifiedDate>
  </TransactionModifiedDateRangeFilter>
  <AccountListID>${escapeXml(accountListId)}</AccountListID>
</TransactionQueryRq>`
  );
}

export function queryChecks(opts: {
  fromDate?: Date;
  toDate?: Date;
  refNumber?: string;
}): string {
  const dateFilter =
    opts.fromDate && opts.toDate
      ? `<ModifiedDateRangeFilter>
    <FromModifiedDate>${formatDate(opts.fromDate)}</FromModifiedDate>
    <ToModifiedDate>${formatDate(opts.toDate)}</ToModifiedDate>
  </ModifiedDateRangeFilter>`
      : "";
  const refFilter = opts.refNumber
    ? `<RefNumber>${escapeXml(opts.refNumber)}</RefNumber>`
    : "";
  return wrapRequest(
    "13.0",
    `<CheckQueryRq requestID="1">
  ${dateFilter}
  ${refFilter}
</CheckQueryRq>`
  );
}

export function hostQuery(): string {
  return wrapRequest(
    "13.0",
    `<HostQueryRq requestID="1">
</HostQueryRq>`
  );
}

// ── Receive Payment (credit → invoice) ──
// Validated: works on QB Enterprise 24

export function receivePayment(opts: {
  customerListId: string;
  bankAccountListId: string;
  invoiceTxnId: string;
  amount: number;
  date: Date;
  refNumber?: string;
  memo?: string;
}): string {
  return wrapRequest(
    "13.0",
    `<ReceivePaymentAddRq requestID="1">
  <ReceivePaymentAdd>
    <CustomerRef>
      <ListID>${escapeXml(opts.customerListId)}</ListID>
    </CustomerRef>
    <TxnDate>${formatDate(opts.date)}</TxnDate>
    ${opts.refNumber ? `<RefNumber>${escapeXml(opts.refNumber)}</RefNumber>` : ""}
    <TotalAmount>${opts.amount.toFixed(2)}</TotalAmount>
    ${opts.memo ? `<Memo>${escapeXml(opts.memo)}</Memo>` : ""}
    <DepositToAccountRef>
      <ListID>${escapeXml(opts.bankAccountListId)}</ListID>
    </DepositToAccountRef>
    <AppliedToTxnAdd>
      <TxnID>${escapeXml(opts.invoiceTxnId)}</TxnID>
      <PaymentAmount>${opts.amount.toFixed(2)}</PaymentAmount>
    </AppliedToTxnAdd>
  </ReceivePaymentAdd>
</ReceivePaymentAddRq>`
  );
}

// ── Bill Payment (debit → bill) ──

export function billPayment(opts: {
  vendorListId: string;
  bankAccountListId: string;
  billTxnId: string;
  amount: number;
  date: Date;
  refNumber?: string;
  memo?: string;
}): string {
  return wrapRequest(
    "13.0",
    `<BillPaymentCheckAddRq requestID="1">
  <BillPaymentCheckAdd>
    <PayeeEntityRef>
      <ListID>${escapeXml(opts.vendorListId)}</ListID>
    </PayeeEntityRef>
    <TxnDate>${formatDate(opts.date)}</TxnDate>
    ${opts.memo ? `<Memo>${escapeXml(opts.memo)}</Memo>` : ""}
    <BankAccountRef>
      <ListID>${escapeXml(opts.bankAccountListId)}</ListID>
    </BankAccountRef>
    <AppliedToTxnAdd>
      <TxnID>${escapeXml(opts.billTxnId)}</TxnID>
      <PaymentAmount>${opts.amount.toFixed(2)}</PaymentAmount>
    </AppliedToTxnAdd>
  </BillPaymentCheckAdd>
</BillPaymentCheckAddRq>`
  );
}

// ── Create Bill (new expense against vendor) ──
// Validated: works on QB Enterprise 24

export function addBill(opts: {
  vendorListId: string;
  expenseAccountListId: string;
  date: Date;
  amount: number;
  refNumber?: string;
  memo?: string;
}): string {
  return wrapRequest(
    "13.0",
    `<BillAddRq requestID="1">
  <BillAdd>
    <VendorRef>
      <ListID>${escapeXml(opts.vendorListId)}</ListID>
    </VendorRef>
    <TxnDate>${formatDate(opts.date)}</TxnDate>
    ${opts.refNumber ? `<RefNumber>${escapeXml(opts.refNumber)}</RefNumber>` : ""}
    ${opts.memo ? `<Memo>${escapeXml(opts.memo)}</Memo>` : ""}
    <ExpenseLineAdd>
      <AccountRef>
        <ListID>${escapeXml(opts.expenseAccountListId)}</ListID>
      </AccountRef>
      <Amount>${Math.abs(opts.amount).toFixed(2)}</Amount>
    </ExpenseLineAdd>
  </BillAdd>
</BillAddRq>`
  );
}

// ── Add Vendor ──
// Validated: works on QB Enterprise 24

export function addVendor(opts: {
  name: string;
  companyName?: string;
}): string {
  return wrapRequest(
    "13.0",
    `<VendorAddRq requestID="1">
  <VendorAdd>
    <Name>${escapeXml(opts.name)}</Name>
    ${opts.companyName ? `<CompanyName>${escapeXml(opts.companyName)}</CompanyName>` : ""}
  </VendorAdd>
</VendorAddRq>`
  );
}

// ── Deposit (unmatched credit, no invoice) ──

export function addDeposit(opts: {
  bankAccountListId: string;
  incomeAccountListId: string;
  date: Date;
  amount: number;
  memo: string;
  refNumber?: string;
}): string {
  return wrapRequest(
    "13.0",
    `<DepositAddRq requestID="1">
  <DepositAdd>
    <DepositToAccountRef>
      <ListID>${escapeXml(opts.bankAccountListId)}</ListID>
    </DepositToAccountRef>
    <TxnDate>${formatDate(opts.date)}</TxnDate>
    ${opts.refNumber ? `<RefNumber>${escapeXml(opts.refNumber)}</RefNumber>` : ""}
    <Memo>${escapeXml(opts.memo)}</Memo>
    <DepositLineAdd>
      <ORDepositLineAdd>
        <DepositInfo>
          <AccountRef>
            <ListID>${escapeXml(opts.incomeAccountListId)}</ListID>
          </AccountRef>
          <Amount>${opts.amount.toFixed(2)}</Amount>
        </DepositInfo>
      </ORDepositLineAdd>
    </DepositLineAdd>
  </DepositAdd>
</DepositAddRq>`
  );
}

// ── Journal Entry (fallback for deposits if DepositAdd is restricted) ──
// Validated: works on QB Enterprise 24

export function addJournalEntry(opts: {
  debitAccountListId: string;
  creditAccountListId: string;
  date: Date;
  amount: number;
  memo?: string;
  refNumber?: string;
}): string {
  return wrapRequest(
    "13.0",
    `<JournalEntryAddRq requestID="1">
  <JournalEntryAdd>
    <TxnDate>${formatDate(opts.date)}</TxnDate>
    ${opts.refNumber ? `<RefNumber>${escapeXml(opts.refNumber)}</RefNumber>` : ""}
    <JournalDebitLine>
      <AccountRef>
        <ListID>${escapeXml(opts.debitAccountListId)}</ListID>
      </AccountRef>
      <Amount>${opts.amount.toFixed(2)}</Amount>
      ${opts.memo ? `<Memo>${escapeXml(opts.memo)}</Memo>` : ""}
    </JournalDebitLine>
    <JournalCreditLine>
      <AccountRef>
        <ListID>${escapeXml(opts.creditAccountListId)}</ListID>
      </AccountRef>
      <Amount>${opts.amount.toFixed(2)}</Amount>
      ${opts.memo ? `<Memo>${escapeXml(opts.memo)}</Memo>` : ""}
    </JournalCreditLine>
  </JournalEntryAdd>
</JournalEntryAddRq>`
  );
}

// ── Check / Expense (unmatched debit, no bill) ──
// Validated: works on QB Enterprise 24

export function addCheck(opts: {
  bankAccountListId: string;
  expenseAccountListId: string;
  date: Date;
  amount: number;
  payee?: string;
  memo: string;
  refNumber?: string;
}): string {
  return wrapRequest(
    "13.0",
    `<CheckAddRq requestID="1">
  <CheckAdd>
    <AccountRef>
      <ListID>${escapeXml(opts.bankAccountListId)}</ListID>
    </AccountRef>
    ${opts.payee ? `<PayeeEntityRef><FullName>${escapeXml(opts.payee)}</FullName></PayeeEntityRef>` : ""}
    <TxnDate>${formatDate(opts.date)}</TxnDate>
    ${opts.refNumber ? `<RefNumber>${escapeXml(opts.refNumber)}</RefNumber>` : ""}
    <Memo>${escapeXml(opts.memo)}</Memo>
    <ExpenseLineAdd>
      <AccountRef>
        <ListID>${escapeXml(opts.expenseAccountListId)}</ListID>
      </AccountRef>
      <Amount>${Math.abs(opts.amount).toFixed(2)}</Amount>
    </ExpenseLineAdd>
  </CheckAdd>
</CheckAddRq>`
  );
}

// ── Sales Receipt (alternative for unmatched credits) ──
// Validated: works on QB Enterprise 24

export function addSalesReceipt(opts: {
  customerListId: string;
  bankAccountListId: string;
  date: Date;
  amount: number;
  memo?: string;
  refNumber?: string;
}): string {
  return wrapRequest(
    "13.0",
    `<SalesReceiptAddRq requestID="1">
  <SalesReceiptAdd>
    <CustomerRef>
      <ListID>${escapeXml(opts.customerListId)}</ListID>
    </CustomerRef>
    <TxnDate>${formatDate(opts.date)}</TxnDate>
    ${opts.refNumber ? `<RefNumber>${escapeXml(opts.refNumber)}</RefNumber>` : ""}
    ${opts.memo ? `<Memo>${escapeXml(opts.memo)}</Memo>` : ""}
    <DepositToAccountRef>
      <ListID>${escapeXml(opts.bankAccountListId)}</ListID>
    </DepositToAccountRef>
    <SalesReceiptLineAdd>
      <Amount>${opts.amount.toFixed(2)}</Amount>
      ${opts.memo ? `<Desc>${escapeXml(opts.memo)}</Desc>` : ""}
    </SalesReceiptLineAdd>
  </SalesReceiptAdd>
</SalesReceiptAddRq>`
  );
}

// ── Cleared status ──

export function setClearedStatus(
  txnId: string,
  editSequence: string,
  txnType: QBTxnType,
  cleared: boolean
): string {
  const modTag = `${txnType}ModRq`;
  const modBody = `${txnType}Mod`;
  return wrapRequest(
    "13.0",
    `<${modTag} requestID="1">
  <${modBody}>
    <TxnID>${escapeXml(txnId)}</TxnID>
    <EditSequence>${escapeXml(editSequence)}</EditSequence>
    <ClearedStatus>${cleared ? "Cleared" : "NotCleared"}</ClearedStatus>
  </${modBody}>
</${modTag}>`
  );
}

export function batchSetCleared(
  txns: Array<{ txnId: string; editSequence: string; txnType: QBTxnType }>
): string {
  let reqId = 1;
  const bodies = txns.map((t) => {
    const modTag = `${t.txnType}ModRq`;
    const modBody = `${t.txnType}Mod`;
    return `<${modTag} requestID="${reqId++}">
  <${modBody}>
    <TxnID>${escapeXml(t.txnId)}</TxnID>
    <EditSequence>${escapeXml(t.editSequence)}</EditSequence>
    <ClearedStatus>Cleared</ClearedStatus>
  </${modBody}>
</${modTag}>`;
  });
  return wrapRequest("13.0", bodies.join("\n"));
}

// ── Reports ──

export function queryVATSummary(fromDate: Date, toDate: Date): string {
  return wrapRequest(
    "13.0",
    `<GeneralSummaryReportQueryRq requestID="1">
  <GeneralSummaryReportType>ProfitAndLossStandard</GeneralSummaryReportType>
  <ReportPeriod>
    <FromReportDate>${formatDate(fromDate)}</FromReportDate>
    <ToReportDate>${formatDate(toDate)}</ToReportDate>
  </ReportPeriod>
</GeneralSummaryReportQueryRq>`
  );
}
