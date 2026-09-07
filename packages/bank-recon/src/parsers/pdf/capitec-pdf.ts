import type { BankStatement, Transaction } from "@qb-toolkit/core";
import type { PdfText } from "../../pdf-extract.js";

// Capitec PDF layout (confirmed):
// Columns: Date | Description | Money In (R) | Money Out (R) | Balance (R)
// Date format: DD/MM/YYYY
// Separate "money in" and "money out" columns
// Opening/closing balance in header section

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})/;
const AMOUNT_RE = /(\d[\d\s,]*\.\d{2})/g;
const ACCOUNT_RE = /(\d{9,13})/;

export function parseCapitecPdf(pdf: PdfText): BankStatement {
  const accountNumber = extractAccountNumber(pdf.lines);
  const transactions: Transaction[] = [];
  let inTransactions = false;
  let hasMoneyInOut = false;

  for (const line of pdf.lines) {
    if (/money\s*in.*money\s*out/i.test(line) || /description.*money.*in.*money.*out/i.test(line)) {
      inTransactions = true;
      hasMoneyInOut = true;
      continue;
    }
    if (/date.*description.*amount/i.test(line)) {
      inTransactions = true;
      continue;
    }

    if (!inTransactions) continue;
    if (/total|closing balance|opening balance/i.test(line) && !DATE_RE.test(line)) continue;

    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;

    const date = new Date(+dateMatch[3], +dateMatch[2] - 1, +dateMatch[1]);
    const rest = line.replace(DATE_RE, "");
    const amounts = extractAmounts(rest);
    if (amounts.length === 0) continue;

    const desc = extractDescription(rest);

    let amount: number;
    let type: "debit" | "credit";

    if (hasMoneyInOut && amounts.length >= 2) {
      // Money In | Money Out | Balance
      // In PDF text extraction, both columns merge — need to figure out which is which
      // The balance is the last amount; the transaction amount is before it
      const balance = amounts[amounts.length - 1];
      const txnAmount = amounts[0];

      // Heuristic: if there are exactly 3 amounts, the pattern is [money_in, money_out, balance]
      // One will typically be 0 or the text won't contain it
      // If 2 amounts: one is the transaction, other is balance
      // Compare with balance to determine direction
      if (amounts.length === 3) {
        // [money_in, money_out, balance] — one should be near zero or it's the non-zero one
        if (amounts[0] > amounts[1]) {
          amount = amounts[0];
          type = "credit";
        } else {
          amount = amounts[1];
          type = "debit";
        }
      } else {
        amount = txnAmount;
        type = "credit"; // default; caller should verify against balance movement
      }
    } else {
      amount = Math.abs(amounts[0]);
      type = amounts[0] < 0 ? "debit" : "credit";
    }

    transactions.push({
      date,
      amount: Math.abs(amount),
      description: desc || "(no description)",
      reference: extractReference(desc),
      balance: amounts.length > 0 ? Math.abs(amounts[amounts.length - 1]) : undefined,
      type,
    });
  }

  return { bank: "capitec", accountNumber, transactions };
}

function extractAccountNumber(lines: string[]): string {
  for (const line of lines.slice(0, 20)) {
    const match = line.match(ACCOUNT_RE);
    if (match) return match[1];
  }
  return "";
}

function extractAmounts(text: string): number[] {
  const results: number[] = [];
  const re = new RegExp(AMOUNT_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/[,\s]/g, ""));
    if (!isNaN(val)) results.push(val);
  }
  return results;
}

function extractDescription(text: string): string {
  return text
    .replace(new RegExp(AMOUNT_RE.source, "g"), "")
    .trim()
    .replace(/^[-–\s]+|[-–\s]+$/g, "")
    .trim();
}

function extractReference(desc: string): string {
  const match = desc.match(/\b\d{6,}\b/);
  return match?.[0] ?? "";
}
