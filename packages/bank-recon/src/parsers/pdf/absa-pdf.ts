import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// ABSA PDF layout (confirmed from pdf_statement_reader config):
// Columns: Date | Transaction Description | Transaction Detail | Charge | Debit Amount | Credit Amount | Balance
// Date format: DD/MM/YYYY
// Separate debit/credit columns (no sign/suffix)
// Transaction detail appears on the line below the main transaction row
// Amounts with trailing "-" mean negative (e.g. "1,234.56-")

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})/;
const AMOUNT_RE = /(\d[\d,]*\.\d{2}-?)/g;
const ACCOUNT_RE = /(\d{9,13})/;

export function parseABSAPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const transactions: Transaction[] = [];
  let inTransactions = false;

  for (let i = 0; i < pdf.lines.length; i++) {
    const line = pdf.lines[i];

    if (/date.*description.*debit.*credit.*balance/i.test(line) ||
        /date.*transaction.*amount.*balance/i.test(line)) {
      inTransactions = true;
      continue;
    }

    if (!inTransactions) continue;
    if (/total|closing balance|opening balance/i.test(line) && !DATE_RE.test(line)) continue;

    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;

    const date = new Date(+dateMatch[3], +dateMatch[2] - 1, +dateMatch[1]);
    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;

    const desc = extractDescription(line);

    // Check next line for transaction detail (ABSA puts detail on following line)
    let detail = "";
    if (i + 1 < pdf.lines.length) {
      const nextLine = pdf.lines[i + 1];
      if (!DATE_RE.test(nextLine) && !/total|closing|opening/i.test(nextLine)) {
        const nextAmounts = extractAmounts(nextLine);
        if (nextAmounts.length === 0 && nextLine.trim()) {
          detail = nextLine.trim();
        }
      }
    }

    const fullDesc = detail ? `${desc} ${detail}` : desc;

    // With separate debit/credit columns, we need to determine type
    // If there are 3+ amounts: [charge?, debit, credit, balance] or subset
    // The balance is typically the last amount; debit/credit determined by column position
    // Simplified: if we see 2 amounts, first is transaction, second is balance
    let amount: number;
    let type: "debit" | "credit";

    if (amounts.length >= 3) {
      // Likely: debit, credit, balance (one of debit/credit is 0 or absent in text)
      amount = amounts[0];
      type = "debit";
    } else if (amounts.length === 2) {
      amount = amounts[0];
      type = amount < 0 ? "debit" : "credit";
      amount = Math.abs(amount);
    } else {
      amount = Math.abs(amounts[0]);
      type = amounts[0] < 0 ? "debit" : "credit";
    }

    transactions.push({
      date,
      amount: Math.abs(amount),
      description: fullDesc || "(no description)",
      reference: extractReference(fullDesc),
      balance: amounts[amounts.length - 1] !== undefined ? Math.abs(amounts[amounts.length - 1]) : undefined,
      type,
    });
  }

  return { bank: "absa", accountNumber, transactions };
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
    let raw = m[1].replace(/,/g, "");
    let val: number;
    if (raw.endsWith("-")) {
      val = -parseFloat(raw.slice(0, -1));
    } else {
      val = parseFloat(raw);
    }
    if (!isNaN(val)) results.push(val);
  }
  return results;
}

function extractDescription(line: string): string {
  return line
    .replace(DATE_RE, "")
    .replace(new RegExp(AMOUNT_RE.source, "g"), "")
    .trim()
    .replace(/^[-–\s]+|[-–\s]+$/g, "")
    .trim();
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
