import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// Standard Bank PDF layout:
// Transaction table: Date | Description | Amount | Balance
// Date format: DD/MM/YYYY or YYYY/MM/DD
// Debits are negative amounts

const DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
const DATE_YMD_RE = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/;
const AMOUNT_RE = /(-?\d[\d\s]*\d?\.\d{2})/g;
const ACCOUNT_RE = /(\d{9,13})/;

export function parseStandardBankPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const transactions: Transaction[] = [];
  let currentDate: Date | null = null;
  let inTransactions = false;

  for (const line of pdf.lines) {
    if (/date.*description.*amount/i.test(line) || /date.*detail.*debit.*credit/i.test(line)) {
      inTransactions = true;
      continue;
    }

    if (!inTransactions) continue;
    if (/opening balance|closing balance|statement total/i.test(line) && !/^(\d{1,2})[/-]/.test(line)) continue;

    const dateMatch = line.match(DATE_RE) ?? line.match(DATE_YMD_RE);
    if (dateMatch) {
      currentDate = parseLineDate(dateMatch);
    }

    if (!currentDate) continue;

    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;

    const desc = extractDescription(line);
    if (!desc) continue;

    const amount = amounts[0];
    transactions.push({
      date: currentDate,
      amount: Math.abs(amount),
      description: desc,
      reference: extractReference(desc),
      balance: amounts.length > 1 ? amounts[amounts.length - 1] : undefined,
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
  let m: RegExpExecArray | null;
  const re = new RegExp(AMOUNT_RE.source, "g");
  while ((m = re.exec(line)) !== null) {
    const val = parseFloat(m[1].replace(/\s/g, ""));
    if (!isNaN(val)) results.push(val);
  }
  return results;
}

function extractDescription(line: string): string {
  let desc = line
    .replace(DATE_RE, "")
    .replace(DATE_YMD_RE, "")
    .replace(AMOUNT_RE, "")
    .trim();
  desc = desc.replace(/^[-–\s]+|[-–\s]+$/g, "").trim();
  return desc;
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
