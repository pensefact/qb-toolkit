import type { BankStatement, Transaction } from "@qb-toolkit/core";

// FNB CSV format:
// Row 1: account number, account description
// Row 2: headers - Date, Amount, Balance, Description
// Row 3+: data
// Date format: DD/MM/YYYY or YYYY/MM/DD depending on export

export function parseFNB(csv: string): BankStatement {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 3) throw new Error("FNB CSV too short");

  const accountLine = lines[0].split(",");
  const accountNumber = accountLine[0]?.replace(/['"]/g, "").trim() ?? "";

  const transactions: Transaction[] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 4) continue;

    const date = parseFNBDate(cols[0]);
    const amount = parseFloat(cols[1].replace(/\s/g, ""));
    if (isNaN(amount)) continue;

    const balance = parseFloat(cols[2].replace(/\s/g, "")) || undefined;
    const description = cols[3];

    transactions.push({
      date,
      amount: Math.abs(amount),
      description,
      reference: extractReference(description),
      balance,
      type: amount >= 0 ? "credit" : "debit",
    });
  }

  return {
    bank: "fnb",
    accountNumber,
    transactions,
  };
}

function parseFNBDate(s: string): Date {
  const cleaned = s.replace(/['"]/g, "").trim();
  // DD/MM/YYYY
  const dmy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  // YYYY/MM/DD
  const ymd = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  throw new Error(`Cannot parse FNB date: ${s}`);
}

function extractReference(desc: string): string {
  // FNB often includes reference numbers in description
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
