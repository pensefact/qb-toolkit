import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTextMock, destroyMock, PDFParseMock } = vi.hoisted(() => {
  const getTextMock = vi.fn();
  const destroyMock = vi.fn().mockResolvedValue(undefined);
  const PDFParseMock = vi.fn().mockImplementation(function () {
    return { getText: getTextMock, destroy: destroyMock };
  });
  return { getTextMock, destroyMock, PDFParseMock };
});

vi.mock("pdf-parse", () => ({ PDFParse: PDFParseMock }));

import { extractPdfText, detectBankFromPdf } from "../pdf-extract.js";
import type { PdfText } from "../pdf-extract.js";

beforeEach(() => {
  getTextMock.mockReset();
  destroyMock.mockClear();
  PDFParseMock.mockClear();
});

function pdf(fullText: string): PdfText {
  return { fullText, lines: fullText.split("\n") };
}

describe("extractPdfText", () => {
  it("splits the parsed text into trimmed, non-empty lines", async () => {
    getTextMock.mockResolvedValue({
      text: "  First National Bank  \n\n   \nAccount Number: 123\n",
    });

    const result = await extractPdfText(Buffer.from("pdf-bytes"));

    expect(result.lines).toEqual(["First National Bank", "Account Number: 123"]);
  });

  it("preserves the raw extracted text alongside the cleaned lines", async () => {
    const raw = "Line A\nLine B";
    getTextMock.mockResolvedValue({ text: raw });

    const result = await extractPdfText(Buffer.from("pdf-bytes"));

    expect(result.fullText).toBe(raw);
  });

  it("passes the buffer bytes to the underlying parser and releases it afterwards", async () => {
    getTextMock.mockResolvedValue({ text: "x" });
    const buf = Buffer.from([1, 2, 3]);

    await extractPdfText(buf);

    expect(PDFParseMock).toHaveBeenCalledWith({ data: new Uint8Array(buf) });
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });
});

describe("detectBankFromPdf", () => {
  it("detects FNB by full name", () => {
    expect(detectBankFromPdf(pdf("First National Bank\nStatement"))).toBe("fnb");
  });

  it("detects FNB by abbreviation", () => {
    expect(detectBankFromPdf(pdf("FNB Cheque Account"))).toBe("fnb");
  });

  it("detects Standard Bank", () => {
    expect(detectBankFromPdf(pdf("Standard Bank\nAccount: 123"))).toBe(
      "standard-bank"
    );
  });

  it("detects Nedbank", () => {
    expect(detectBankFromPdf(pdf("Nedbank Limited\nAccount: 123"))).toBe(
      "nedbank"
    );
  });

  it("detects ABSA", () => {
    expect(detectBankFromPdf(pdf("Absa Bank Limited\nAccount: 123"))).toBe(
      "absa"
    );
  });

  it("detects Capitec", () => {
    expect(detectBankFromPdf(pdf("Capitec Bank\nAccount: 123"))).toBe(
      "capitec"
    );
  });

  it("is case-insensitive", () => {
    expect(detectBankFromPdf(pdf("STANDARD BANK OF SOUTH AFRICA"))).toBe(
      "standard-bank"
    );
  });

  it("returns null for text matching no known bank", () => {
    expect(detectBankFromPdf(pdf("Some Other Bank\nAccount: 123"))).toBeNull();
  });
});
