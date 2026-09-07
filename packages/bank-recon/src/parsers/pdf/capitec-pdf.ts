import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// Capitec PDF layout:
// Transaction table: Date | Transaction | Money in | Money out | Balance
// Date format: DD/MM/YYYY or DD Mon YYYY
// Separate columns for money in (credit) and money out (debit)

const DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
const DATE_MON_RE = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i;
const AMOUNT_RE = /(\d[\d\s]*\d?\.\d{2})/g;
const ACCOUNT_RE = /(\d{9,13})/;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseCapitecPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const transactions: Transaction[] = [];
  let currentDate: Date | null = null;
  let hasMoneyInOut = false;

  for (const line of pdf.lines) {
    if (/money\s*in.*money\s*out/i.test(line)) {
      hasMoneyInOut = true;
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

    if (hasMoneyInOut && amounts.length >= 2) {
      // Money in | Money out | Balance — figure out which column has the value
      // If first amount matches a typical "money in" position, it's a credit
      amount = amounts[0];
      type = "credit";
      // Heuristic: if there are 3 amounts, the pattern is [money_in, money_out, balance]
      // One of the first two will be 0 or absent in the text
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

  return { bank: "capitec", accountNumber, transactions };
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
  desc = desc.replace(/^[-–\s]+|[-–\s]+$/g, "").trim();
  return desc;
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
