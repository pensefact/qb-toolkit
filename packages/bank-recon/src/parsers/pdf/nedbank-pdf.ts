import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// Nedbank PDF layout:
// Transaction table: Transaction Date | Value Date | Description | Debit | Credit | Balance
// OR: Date | Description | Debit | Credit | Balance
// Date format: DD/MM/YYYY or DD Mon YYYY

const DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
const DATE_MON_RE = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i;
const AMOUNT_RE = /(\d[\d\s]*\d?\.\d{2})/g;
const ACCOUNT_RE = /(\d{9,13})/;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseNedbankPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const transactions: Transaction[] = [];
  let currentDate: Date | null = null;
  let hasDebitCreditColumns = false;

  for (const line of pdf.lines) {
    if (/debit.*credit.*balance/i.test(line)) {
      hasDebitCreditColumns = true;
      continue;
    }

    const dateMatch = line.match(DATE_RE) ?? line.match(DATE_MON_RE);
    if (dateMatch) {
      currentDate = parseLineDate(dateMatch);
    }

    if (!currentDate) continue;

    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;

    const desc = extractDescription(line);
    if (!desc) continue;

    let amount: number;
    let type: "debit" | "credit";

    if (hasDebitCreditColumns && amounts.length >= 2) {
      // Debit | Credit | Balance layout — one of debit/credit is the transaction
      const balance = amounts[amounts.length - 1];
      amount = amounts[0];
      type = amounts.length === 3 ? "debit" : "credit";
    } else {
      amount = amounts[0];
      type = amount < 0 ? "debit" : "credit";
      amount = Math.abs(amount);
    }

    transactions.push({
      date: currentDate,
      amount,
      description: desc,
      reference: extractReference(desc),
      balance: amounts[amounts.length - 1],
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
    .replace(DATE_MON_RE, "")
    .replace(AMOUNT_RE, "")
    .trim();
  desc = desc.replace(/^[-–;\s]+|[-–;\s]+$/g, "").trim();
  return desc;
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
