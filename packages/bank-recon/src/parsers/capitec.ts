import type { BankStatement, Transaction } from "@qb-toolkit/core";

// Capitec CSV format:
// Headers: Date, Transaction, Description, Debit, Credit, Balance
// Date format: YYYY-MM-DD

export function parseCapitec(csv: string): BankStatement {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("Capitec CSV too short");

  const headerIdx = lines.findIndex(
    (l) =>
      l.toLowerCase().includes("date") &&
      (l.toLowerCase().includes("debit") || l.toLowerCase().includes("amount"))
  );
  if (headerIdx === -1) throw new Error("Cannot find Capitec header row");

  const headers = lines[headerIdx].toLowerCase();
  const hasSeparateColumns =
    headers.includes("debit") && headers.includes("credit");

  const accountNumber = extractAccountNumber(lines, headerIdx);
  const transactions: Transaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 4) continue;

    const date = parseDate(cols[0]);

    let amount: number;
    let type: "debit" | "credit";

    if (hasSeparateColumns) {
      const debit = parseFloat(cols[3].replace(/\s/g, "")) || 0;
      const credit = parseFloat(cols[4].replace(/\s/g, "")) || 0;
      amount = credit > 0 ? credit : debit;
      type = credit > 0 ? "credit" : "debit";
    } else {
      amount = parseFloat(cols[3].replace(/\s/g, ""));
      if (isNaN(amount)) continue;
      type = amount >= 0 ? "credit" : "debit";
      amount = Math.abs(amount);
    }

    if (amount === 0) continue;

    const description = cols[2] || cols[1];
    const balanceCol = hasSeparateColumns ? cols[5] : cols[4];
    const balance = balanceCol
      ? parseFloat(balanceCol.replace(/\s/g, ""))
      : undefined;

    transactions.push({
      date,
      amount,
      description,
      reference: extractReference(description),
      balance: isNaN(balance as number) ? undefined : balance,
      type,
    });
  }

  return {
    bank: "capitec",
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
  const ymd = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  const dmy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  throw new Error(`Cannot parse Capitec date: ${s}`);
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
