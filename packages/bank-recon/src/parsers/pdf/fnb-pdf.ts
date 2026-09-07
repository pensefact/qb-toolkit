import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// FNB PDF statement layout:
// Header section with account number, statement period
// Transaction table: Date | Description | Amount | Balance
// Date format: DD Mon YYYY (e.g. "07 Jan 2026") or DD/MM/YYYY
// Debits shown as negative or with "DR" suffix
// Credits shown as positive or with "CR" suffix

const DATE_RE = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i;
const DATE_SLASH_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const AMOUNT_RE = /(-?\d[\d\s]*\d?\.\d{2})\s*(DR|CR)?/i;
const ACCOUNT_RE = /(?:account\s*(?:number|no\.?)?[:\s]*)?(\d{5,13})/i;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseFNBPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const transactions: Transaction[] = [];
  let currentDate: Date | null = null;

  for (const line of pdf.lines) {
    const dateMatch = line.match(DATE_RE) ?? line.match(DATE_SLASH_RE);
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
      amount: Math.abs(amount.value),
      description: desc,
      reference: extractReference(desc),
      balance: amounts[1]?.value,
      type: amount.value < 0 ? "debit" : "credit",
    });
  }

  return { bank: "fnb", accountNumber, transactions };
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

interface ParsedAmount {
  value: number;
  raw: string;
}

function extractAmounts(line: string): ParsedAmount[] {
  const results: ParsedAmount[] = [];
  const re = new RegExp(AMOUNT_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    let value = parseFloat(m[1].replace(/\s/g, ""));
    if (isNaN(value)) continue;
    if (m[2]?.toUpperCase() === "DR") value = -Math.abs(value);
    if (m[2]?.toUpperCase() === "CR") value = Math.abs(value);
    results.push({ value, raw: m[0] });
  }
  return results;
}

function extractDescription(line: string): string {
  let desc = line
    .replace(DATE_RE, "")
    .replace(DATE_SLASH_RE, "")
    .replace(new RegExp(AMOUNT_RE.source, "gi"), "")
    .trim();
  desc = desc.replace(/^[-–\s]+|[-–\s]+$/g, "").trim();
  return desc;
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
