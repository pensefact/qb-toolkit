import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// FNB PDF statement layout (confirmed from real parsers):
// Year extracted from "Statement Period : DD MonthName YYYY"
// Transaction rows: "DD Mon <description> <amount> <balance> [charges]"
// Amounts: "1,234.56" = debit, "1,234.56Cr" = credit (no sign prefix)
// Opening/Closing: "Opening Balance 1,234.56Cr"

const STATEMENT_PERIOD_RE = /Statement Period\s+:\s+\d{2}\s+([A-Za-z]{3})\w*\s+(\d{4})/;
const ACCOUNT_RE = /(?:Account\s*(?:Number|No\.?)?[:\s]*)(\d{5,13})/i;
const OPENING_BALANCE_RE = /Opening Balance\s+([\d,]+\.\d{2}\s*(?:Cr)?)/;
const CLOSING_BALANCE_RE = /Closing Balance\s+([\d,]+\.\d{2}\s*(?:Cr)?)/;

const MONEY_RE = /[\d,]+\.\d{2}(?:\s*Cr)?/;
const TRANSACTION_ROW_RE = new RegExp(
  `^\\s*(\\d{2})\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)` +
  `(.*?(?!\\.\\d{2}(?:Cr)?\\b))` +
  `(${MONEY_RE.source})` +
  `\\s+(${MONEY_RE.source})` +
  `(?:\\s+(${MONEY_RE.source}))?\\s*$`
);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseFNBPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const { startMonth, startYear } = extractStatementPeriod(pdf.fullText);
  const openingBalance = extractBalance(pdf.fullText, OPENING_BALANCE_RE);
  const closingBalance = extractBalance(pdf.fullText, CLOSING_BALANCE_RE);

  const transactions: Transaction[] = [];
  let currentMonth = startMonth;
  let currentYear = startYear;

  for (const line of pdf.lines) {
    const match = line.match(TRANSACTION_ROW_RE);
    if (!match) continue;

    const [, dayStr, monthStr, descRaw, amountRaw, balanceRaw] = match;
    const monthIdx = MONTHS.indexOf(monthStr);

    if (monthIdx < MONTHS.indexOf(currentMonth)) {
      currentYear++;
    }
    currentMonth = monthStr;

    const amount = parseFnbAmount(amountRaw);
    const balance = parseFnbAmount(balanceRaw);
    const desc = descRaw.trim() || "(no description)";

    transactions.push({
      date: new Date(currentYear, monthIdx, +dayStr),
      amount: Math.abs(amount),
      description: desc,
      reference: extractReference(desc),
      balance: Math.abs(balance),
      type: amount >= 0 ? "credit" : "debit",
    });
  }

  return {
    bank: "fnb",
    accountNumber,
    openingBalance: openingBalance !== null ? Math.abs(openingBalance) : undefined,
    closingBalance: closingBalance !== null ? Math.abs(closingBalance) : undefined,
    transactions,
  };
}

function extractStatementPeriod(text: string): { startMonth: string; startYear: number } {
  const match = text.match(STATEMENT_PERIOD_RE);
  if (match) {
    return { startMonth: match[1].substring(0, 3), startYear: +match[2] };
  }
  // Fallback: try to find any 4-digit year
  const yearMatch = text.match(/\b(20\d{2})\b/);
  return { startMonth: "Jan", startYear: yearMatch ? +yearMatch[1] : new Date().getFullYear() };
}

function extractAccountNumber(lines: string[]): string {
  for (const line of lines.slice(0, 30)) {
    const match = line.match(ACCOUNT_RE);
    if (match) return match[1];
  }
  return "";
}

function extractBalance(text: string, re: RegExp): number | null {
  const match = text.match(re);
  if (!match) return null;
  return parseFnbAmount(match[1]);
}

function parseFnbAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "");
  if (cleaned.endsWith("Cr")) {
    return parseFloat(cleaned.replace("Cr", ""));
  }
  return -parseFloat(cleaned);
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
