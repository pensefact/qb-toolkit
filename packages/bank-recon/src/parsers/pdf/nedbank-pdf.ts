import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// Nedbank PDF layout:
// Columns vary: "Date | Description | Debit | Credit | Balance"
// or "Transaction Date | Value Date | Description | Amount | Balance"
// Date format: DD/MM/YYYY or DD Mon YYYY
// Amounts: plain numbers, debit/credit determined by column

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})/;
const DATE_MON_RE = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i;
const AMOUNT_RE = /(\d[\d\s,]*\.\d{2})/g;
const ACCOUNT_RE = /(\d{9,13})/;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseNedbankPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const transactions: Transaction[] = [];
  let inTransactions = false;
  let hasSeparateDebitCredit = false;

  for (const line of pdf.lines) {
    if (/date.*description.*debit.*credit.*balance/i.test(line) ||
        /date.*description.*amount.*balance/i.test(line) ||
        /transaction\s*date.*value\s*date/i.test(line)) {
      inTransactions = true;
      hasSeparateDebitCredit = /debit.*credit/i.test(line);
      continue;
    }

    if (!inTransactions) continue;
    if (/total|closing balance|opening balance|balance brought/i.test(line) && !DATE_RE.test(line)) continue;

    const dateMatch = line.match(DATE_RE) ?? line.match(DATE_MON_RE);
    if (!dateMatch) continue;

    const date = parseLineDate(dateMatch);
    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;

    const desc = extractDescription(line);

    let amount: number;
    let type: "debit" | "credit";

    if (hasSeparateDebitCredit && amounts.length >= 2) {
      // With separate debit/credit columns, typically [debit, credit, balance]
      // or [amount, balance] if only one column has a value
      // The balance is always the last number
      amount = amounts[0];
      type = "debit"; // first column is typically debit
      // If there are 3+ numbers and the first is much smaller, it might be the credit column
    } else {
      amount = amounts[0];
      type = amount < 0 ? "debit" : "credit";
      amount = Math.abs(amount);
    }

    transactions.push({
      date,
      amount: Math.abs(amount),
      description: desc || "(no description)",
      reference: extractReference(desc),
      balance: amounts.length > 1 ? Math.abs(amounts[amounts.length - 1]) : undefined,
      type,
    });
  }

  return { bank: "nedbank", accountNumber, transactions };
}

function parseLineDate(match: RegExpMatchArray): Date {
  if (match[2] && MONTHS[match[2].toLowerCase()] !== undefined) {
    return new Date(+match[3], MONTHS[match[2].toLowerCase()], +match[1]);
  }
  return new Date(+match[3], +match[2] - 1, +match[1]);
}

function extractAccountNumber(lines: string[]): string {
  for (const line of lines.slice(0, 20)) {
    const match = line.match(ACCOUNT_RE);
    if (match) return match[1];
  }
  return "";
}

function extractAmounts(line: string): number[] {
  const results: number[] = [];
  const re = new RegExp(AMOUNT_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const val = parseFloat(m[1].replace(/[,\s]/g, ""));
    if (!isNaN(val)) results.push(val);
  }
  return results;
}

function extractDescription(line: string): string {
  return line
    .replace(DATE_RE, "")
    .replace(DATE_MON_RE, "")
    .replace(new RegExp(AMOUNT_RE.source, "g"), "")
    .trim()
    .replace(/^[-–;\s]+|[-–;\s]+$/g, "")
    .trim();
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
