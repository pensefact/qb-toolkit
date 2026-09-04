import type { BankStatement, Transaction } from "@qb-toolkit/core";

// Standard Bank CSV format:
// Headers: Date, Description, Amount, Balance
// Date format: YYYY/MM/DD
// Amount: negative for debits

export function parseStandardBank(csv: string): BankStatement {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("Standard Bank CSV too short");

  const headerIdx = lines.findIndex(
    (l) => l.toLowerCase().includes("date") && l.toLowerCase().includes("amount")
  );
  if (headerIdx === -1) throw new Error("Cannot find Standard Bank header row");

  const accountNumber = extractAccountNumber(lines, headerIdx);
  const transactions: Transaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 3) continue;

    const date = parseDate(cols[0]);
    const description = cols[1];
    const amount = parseFloat(cols[2].replace(/\s/g, ""));
    if (isNaN(amount)) continue;

    const balance = cols[3] ? parseFloat(cols[3].replace(/\s/g, "")) : undefined;

    transactions.push({
      date,
      amount: Math.abs(amount),
      description,
      reference: extractReference(description),
      balance: isNaN(balance as number) ? undefined : balance,
      type: amount >= 0 ? "credit" : "debit",
    });
  }

  return {
    bank: "standard-bank",
    accountNumber,
    transactions,
  };
}

function extractAccountNumber(lines: string[], beforeIdx: number): string {
  for (let i = 0; i < beforeIdx; i++) {
    const match = lines[i].match(/\b(\d{9,13})\b/);
    if (match) return match[1];
  }
  return "";
}

function parseDate(s: string): Date {
  const cleaned = s.replace(/['"]/g, "").trim();
  const ymd = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  throw new Error(`Cannot parse Standard Bank date: ${s}`);
}

function extractReference(desc: string): string {
  const refMatch = desc.match(/\b\d{6,}\b/);
  return refMatch?.[0] ?? "";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
