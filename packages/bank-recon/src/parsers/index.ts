import type { BankId, BankStatement } from "@qb-toolkit/core";
import { parseFNB } from "./fnb.js";
import { parseStandardBank } from "./standard-bank.js";
import { parseNedbank } from "./nedbank.js";
import { parseABSA } from "./absa.js";
import { parseCapitec } from "./capitec.js";
import { parseFNBPdf } from "./pdf/fnb-pdf.js";
import { parseStandardBankPdf } from "./pdf/standard-bank-pdf.js";
import { parseNedbankPdf } from "./pdf/nedbank-pdf.js";
import { parseABSAPdf } from "./pdf/absa-pdf.js";
import { parseCapitecPdf } from "./pdf/capitec-pdf.js";
import { extractPdfText, detectBankFromPdf } from "../pdf-extract.js";
import type { PdfText } from "../pdf-extract.js";

export { parseFNB } from "./fnb.js";
export { parseStandardBank } from "./standard-bank.js";
export { parseNedbank } from "./nedbank.js";
export { parseABSA } from "./absa.js";
export { parseCapitec } from "./capitec.js";
export { parseFNBPdf, parseStandardBankPdf, parseNedbankPdf, parseABSAPdf, parseCapitecPdf } from "./pdf/index.js";

const csvParsers: Record<BankId, (csv: string) => BankStatement> = {
  fnb: parseFNB,
  "standard-bank": parseStandardBank,
  nedbank: parseNedbank,
  absa: parseABSA,
  capitec: parseCapitec,
};

const pdfParsers: Record<BankId, (pdf: PdfText) => BankStatement> = {
  fnb: parseFNBPdf,
  "standard-bank": parseStandardBankPdf,
  nedbank: parseNedbankPdf,
  absa: parseABSAPdf,
  capitec: parseCapitecPdf,
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

export function parseCSVStatement(csv: string, bank?: BankId): BankStatement {
  const bankId = bank ?? detectBank(csv);
  if (!bankId) {
    throw new Error(
      "Cannot auto-detect bank format. Please specify the bank explicitly."
    );
  }
  return csvParsers[bankId](csv);
}

export async function parsePdfStatement(
  buffer: Buffer,
  bank?: BankId
): Promise<BankStatement> {
  const pdf = await extractPdfText(buffer);
  const bankId = bank ?? detectBankFromPdf(pdf);
  if (!bankId) {
    throw new Error(
      "Cannot auto-detect bank from PDF. Please specify the bank explicitly."
    );
  }
  return pdfParsers[bankId](pdf);
}

export async function parseStatement(
  input: string | Buffer,
  bank?: BankId
): Promise<BankStatement> {
  if (Buffer.isBuffer(input)) {
    return parsePdfStatement(input, bank);
  }
  return parseCSVStatement(input, bank);
}
