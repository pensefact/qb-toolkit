import type { BankStatement, Transaction } from "@qb-toolkit/core";

// OFX/QFX is an SGML-based format used by most SA banks for statement export.
// We handle both OFX 1.x (SGML) and 2.x (XML) variants.

export function parseOFX(content: string): BankStatement {
  const isXml = content.trimStart().startsWith("<?xml");
  const transactions = extractTransactions(content);
  const accountNumber = extractTag(content, "ACCTID") ?? "";
  const bankId = extractTag(content, "BANKID") ?? "";

  return {
    bank: guessBankFromId(bankId),
    accountNumber,
    transactions,
  };
}

function extractTransactions(content: string): Transaction[] {
  const transactions: Transaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  // Also handle SGML without closing tags
  const sgmlRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST|$)/gi;

  const regex = content.includes("</STMTTRN>") ? stmtTrnRegex : sgmlRegex;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const block = match[1];

    const dateStr = extractTag(block, "DTPOSTED");
    if (!dateStr) continue;

    const amountStr = extractTag(block, "TRNAMT");
    if (!amountStr) continue;

    const amount = parseFloat(amountStr);
    if (isNaN(amount)) continue;

    const fitId = extractTag(block, "FITID") ?? "";
    const name = extractTag(block, "NAME") ?? "";
    const memo = extractTag(block, "MEMO") ?? "";
    const description = [name, memo].filter(Boolean).join(" - ");

    transactions.push({
      date: parseOFXDate(dateStr),
      amount: Math.abs(amount),
      description,
      reference: fitId,
      type: amount >= 0 ? "credit" : "debit",
    });
  }

  return transactions;
}

function extractTag(content: string, tag: string): string | null {
  // XML style: <TAG>value</TAG>
  const xmlMatch = content.match(
    new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, "i")
  );
  if (xmlMatch) return xmlMatch[1].trim();

  // SGML style: <TAG>value\n
  const sgmlMatch = content.match(
    new RegExp(`<${tag}>\\s*(.+)`, "im")
  );
  if (sgmlMatch) return sgmlMatch[1].trim();

  return null;
}

function parseOFXDate(s: string): Date {
  // OFX dates: YYYYMMDD or YYYYMMDDHHMMSS or YYYYMMDDHHMMSS.XXX[TZ]
  const cleaned = s.replace(/\[.*\]/, "").trim();
  const year = parseInt(cleaned.substring(0, 4));
  const month = parseInt(cleaned.substring(4, 6)) - 1;
  const day = parseInt(cleaned.substring(6, 8));
  return new Date(year, month, day);
}

function guessBankFromId(bankId: string): "fnb" | "standard-bank" | "nedbank" | "absa" | "capitec" {
  // SA bank branch codes used as BANKID in OFX
  if (bankId.startsWith("250")) return "fnb";
  if (bankId.startsWith("051")) return "standard-bank";
  if (bankId.startsWith("198")) return "nedbank";
  if (bankId.startsWith("632")) return "absa";
  if (bankId.startsWith("470")) return "capitec";
  return "fnb"; // fallback
}
