import type { BankId } from "@qb-toolkit/core";
import { PDFParse } from "pdf-parse";

export interface PdfText {
  fullText: string;
  lines: string[];
}

export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  const lines = result.text.split(/\n/).map((l: string) => l.trim()).filter(Boolean);
  return { fullText: result.text, lines };
}

export function detectBankFromPdf(text: PdfText): BankId | null {
  const lower = text.fullText.toLowerCase();
  if (lower.includes("first national bank") || lower.includes("fnb")) return "fnb";
  if (lower.includes("standard bank")) return "standard-bank";
  if (lower.includes("nedbank")) return "nedbank";
  if (lower.includes("absa")) return "absa";
  if (lower.includes("capitec")) return "capitec";
  return null;
}
