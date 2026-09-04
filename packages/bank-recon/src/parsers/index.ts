import type { BankId, BankStatement } from "@qb-toolkit/core";
import { parseFNB } from "./fnb.js";
import { parseStandardBank } from "./standard-bank.js";
import { parseNedbank } from "./nedbank.js";
import { parseABSA } from "./absa.js";
import { parseCapitec } from "./capitec.js";

export { parseFNB } from "./fnb.js";
export { parseStandardBank } from "./standard-bank.js";
export { parseNedbank } from "./nedbank.js";
export { parseABSA } from "./absa.js";
export { parseCapitec } from "./capitec.js";

const parsers: Record<BankId, (csv: string) => BankStatement> = {
  fnb: parseFNB,
  "standard-bank": parseStandardBank,
  nedbank: parseNedbank,
  absa: parseABSA,
  capitec: parseCapitec,
};

export function detectBank(csv: string): BankId | null {
  const lower = csv.toLowerCase();
  if (lower.includes(";") && lower.includes("transaction date"))
    return "nedbank";
  if (lower.includes("first national") || lower.includes("fnb"))
    return "fnb";
  if (lower.includes("standard bank")) return "standard-bank";
  if (lower.includes("absa")) return "absa";
  if (lower.includes("capitec")) return "capitec";
  return null;
}

export function parseStatement(csv: string, bank?: BankId): BankStatement {
  const bankId = bank ?? detectBank(csv);
  if (!bankId) {
    throw new Error(
      "Cannot auto-detect bank format. Please specify the bank explicitly."
    );
  }
  return parsers[bankId](csv);
}
