import { describe, it, expect } from "vitest";
import { parseFNBPdf } from "../pdf/fnb-pdf.js";
import { parseStandardBankPdf } from "../pdf/standard-bank-pdf.js";
import { parseABSAPdf } from "../pdf/absa-pdf.js";
import { parseCapitecPdf } from "../pdf/capitec-pdf.js";
import { parseNedbankPdf } from "../pdf/nedbank-pdf.js";
import type { PdfText } from "../../pdf-extract.js";

function makePdf(lines: string[]): PdfText {
  return { fullText: lines.join("\n"), lines };
}

describe("FNB PDF parser", () => {
  const pdf = makePdf([
    "First National Bank",
    "Account Number: 62987654321",
    "Statement Period : 01 September 2025 to 30 September 2025",
    "Opening Balance 15,000.00Cr",
    "01 Sep DEBIT ORDER INSURANCE 350.00 14,650.00Cr",
    "03 Sep ACB CREDIT SALARY 789012 25,000.00Cr 39,650.00Cr",
    "15 Sep CARD PURCHASE WOOLWORTHS 1,500.00 38,150.00Cr",
    "Closing Balance 38,150.00Cr",
  ]);

  it("extracts account number", () => {
    const result = parseFNBPdf(pdf);
    expect(result.accountNumber).toBe("62987654321");
  });

  it("parses transactions with Cr suffix for credits", () => {
    const result = parseFNBPdf(pdf);
    expect(result.transactions).toHaveLength(3);
  });

  it("identifies debits (no Cr suffix) and credits (Cr suffix)", () => {
    const result = parseFNBPdf(pdf);
    expect(result.transactions[0].type).toBe("debit");
    expect(result.transactions[0].amount).toBe(350);
    expect(result.transactions[1].type).toBe("credit");
    expect(result.transactions[1].amount).toBe(25000);
    expect(result.transactions[2].type).toBe("debit");
    expect(result.transactions[2].amount).toBe(1500);
  });

  it("extracts reference from description", () => {
    const result = parseFNBPdf(pdf);
    expect(result.transactions[1].reference).toBe("789012");
  });

  it("sets correct dates using statement period year", () => {
    const result = parseFNBPdf(pdf);
    expect(result.transactions[0].date).toEqual(new Date(2025, 8, 1));
    expect(result.transactions[2].date).toEqual(new Date(2025, 8, 15));
  });

  it("extracts opening and closing balances", () => {
    const result = parseFNBPdf(pdf);
    expect(result.openingBalance).toBe(15000);
    expect(result.closingBalance).toBe(38150);
  });
});

describe("Standard Bank PDF parser", () => {
  const pdf = makePdf([
    "Standard Bank",
    "Account: 1234567890",
    "Date Description Amount Balance",
    "2025/09/01 SALARY DEPOSIT 25,000.00 35,000.00",
    "2025/09/05 DEBIT ORDER RENT -8,500.00 26,500.00",
    "2025/09/10 POS PURCHASE SPAR -450.75 26,049.25",
  ]);

  it("parses YYYY/MM/DD dates", () => {
    const result = parseStandardBankPdf(pdf);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0].date).toEqual(new Date(2025, 8, 1));
  });

  it("identifies credits and debits by sign", () => {
    const result = parseStandardBankPdf(pdf);
    expect(result.transactions[0].type).toBe("credit");
    expect(result.transactions[1].type).toBe("debit");
    expect(result.transactions[1].amount).toBe(8500);
  });
});

describe("ABSA PDF parser", () => {
  const pdf = makePdf([
    "Absa Bank Limited",
    "Account Number: 4012345678",
    "Date Transaction Description Charge Debit Amount Credit Amount Balance",
    "01/09/2025 SALARY DEPOSIT 25,000.00 35,000.00",
    "05/09/2025 DEBIT ORDER INSURANCE 350.00 34,650.00",
    "Premium for policy 12345678",
  ]);

  it("parses DD/MM/YYYY dates", () => {
    const result = parseABSAPdf(pdf);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].date).toEqual(new Date(2025, 8, 1));
  });

  it("extracts account number", () => {
    const result = parseABSAPdf(pdf);
    expect(result.accountNumber).toBe("4012345678");
  });
});

describe("Capitec PDF parser", () => {
  const pdf = makePdf([
    "Capitec Bank",
    "Account Number: 1234567890",
    "Date Description Money In (R) Money Out (R) Balance (R)",
    "01/09/2025 SALARY DEPOSIT 25,000.00 35,000.00",
    "05/09/2025 DEBIT ORDER RENT 8,500.00 26,500.00",
  ]);

  it("parses transactions", () => {
    const result = parseCapitecPdf(pdf);
    expect(result.transactions).toHaveLength(2);
    expect(result.bank).toBe("capitec");
  });

  it("extracts account number", () => {
    const result = parseCapitecPdf(pdf);
    expect(result.accountNumber).toBe("1234567890");
  });
});

describe("Nedbank PDF parser", () => {
  const pdf = makePdf([
    "Nedbank Limited",
    "Account Number: 1098765432",
    "Date Description Debit Credit Balance",
    "01/09/2025 SALARY DEPOSIT 25,000.00 35,000.00",
    "05/09/2025 DEBIT ORDER INSURANCE 350.00 34,650.00",
  ]);

  it("parses transactions", () => {
    const result = parseNedbankPdf(pdf);
    expect(result.transactions).toHaveLength(2);
    expect(result.bank).toBe("nedbank");
  });

  it("extracts account number", () => {
    const result = parseNedbankPdf(pdf);
    expect(result.accountNumber).toBe("1098765432");
  });
});
