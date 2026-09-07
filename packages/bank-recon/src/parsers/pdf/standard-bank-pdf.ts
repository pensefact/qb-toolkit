import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// Standard Bank PDF layout:
// Columns: Date | Description | Amount | Balance
// or: Date | Detail | Debit | Credit | Balance
// Date format: YYYY/MM/DD or DD/MM/YYYY
// Amounts: negative for debits (or separate columns)

const DATE_YMD_RE = /^(\d{4})\/(\d{2})\/(\d{2})/;
const DATE_DMY_RE = /^(\d{2})\/(\d{2})\/(\d{4})/;
const AMOUNT_RE = /(-?\d[\d\s,]*\.\d{2})/g;
const ACCOUNT_RE = /(\d{9,13})/;

export function parseStandardBankPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const transactions: Transaction[] = [];
  let inTransactions = false;

  for (const line of pdf.lines) {
    if (/date.*description.*amount/i.test(line) ||
        /date.*detail.*debit.*credit/i.test(line)) {
      inTransactions = true;
      continue;
    }

    if (!inTransactions) continue;
    if (/total|closing balance|opening balance|balance brought|balance carried/i.test(line) && !DATE_YMD_RE.test(line) && !DATE_DMY_RE.test(line)) continue;

    const dateMatch = line.match(DATE_YMD_RE) ?? line.match(DATE_DMY_RE);
    if (!dateMatch) continue;

    const date = parseLineDate(dateMatch);
    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;

    const desc = extractDescription(line);

    const amount = amounts[0];
    transactions.push({
      date,
      amount: Math.abs(amount),
      description: desc || "(no description)",
      reference: extractReference(desc),
      balance: amounts.length > 1 ? Math.abs(amounts[amounts.length - 1]) : undefined,
      type: amount < 0 ? "debit" : "credit",
    });
  }

  return { bank: "standard-bank", accountNumber, transactions };
}

function parseLineDate(match: RegExpMatchArray): Date {
  if (match[0].match(/^\d{4}/)) {
    return new Date(+match[1], +match[2] - 1, +match[3]);
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
    .replace(DATE_YMD_RE, "")
    .replace(DATE_DMY_RE, "")
    .replace(new RegExp(AMOUNT_RE.source, "g"), "")
    .trim()
    .replace(/^[-–\s]+|[-–\s]+$/g, "")
    .trim();
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
