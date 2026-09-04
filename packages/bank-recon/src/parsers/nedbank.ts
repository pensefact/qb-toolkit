import type { BankStatement, Transaction } from "@qb-toolkit/core";

// Nedbank CSV format:
// Semicolon-delimited
// Headers: Transaction Date;Value Date;Transaction Reference Number;Description;Debit Amount;Credit Amount;Balance
// Date format: YYYY-MM-DD

export function parseNedbank(csv: string): BankStatement {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("Nedbank CSV too short");

  const headerIdx = lines.findIndex(
    (l) =>
      l.toLowerCase().includes("transaction date") &&
      l.includes(";")
  );
  if (headerIdx === -1) throw new Error("Cannot find Nedbank header row");

  const accountNumber = extractAccountNumber(lines, headerIdx);
  const transactions: Transaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 6) continue;

    const date = parseDate(cols[0]);
    const reference = cols[2];
    const description = cols[3];
    const debit = parseFloat(cols[4].replace(/\s/g, "")) || 0;
    const credit = parseFloat(cols[5].replace(/\s/g, "")) || 0;
    const balance = cols[6] ? parseFloat(cols[6].replace(/\s/g, "")) : undefined;

    const amount = credit > 0 ? credit : debit;
    if (amount === 0) continue;

    transactions.push({
      date,
      amount,
      description,
      reference,
      balance: isNaN(balance as number) ? undefined : balance,
      type: credit > 0 ? "credit" : "debit",
    });
  }

  return {
    bank: "nedbank",
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
  throw new Error(`Cannot parse Nedbank date: ${s}`);
}
