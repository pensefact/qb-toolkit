import { describe, it, expect } from "vitest";
import { parseOFX } from "../ofx-parser.js";

const SAMPLE_OFX = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>250655
<ACCTID>62987654321
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240905
<TRNAMT>-1500.00
<FITID>20240905001
<NAME>WOOLWORTHS
<MEMO>CARD PURCHASE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20240905
<TRNAMT>25000.00
<FITID>20240905002
<NAME>SALARY
<MEMO>MONTHLY SALARY
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const SAMPLE_OFX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>051001</BANKID>
<ACCTID>1234567890</ACCTID>
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20240910120000[+2:CAT]</DTPOSTED>
<TRNAMT>-800.50</TRNAMT>
<FITID>TXN001</FITID>
<NAME>PICK N PAY</NAME>
<MEMO>GROCERY</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

describe("parseOFX", () => {
  it("parses SGML-style OFX", () => {
    const stmt = parseOFX(SAMPLE_OFX);
    expect(stmt.transactions).toHaveLength(2);
    expect(stmt.accountNumber).toBe("62987654321");
    expect(stmt.bank).toBe("fnb");
  });

  it("parses transaction amounts and types", () => {
    const stmt = parseOFX(SAMPLE_OFX);
    expect(stmt.transactions[0].amount).toBe(1500);
    expect(stmt.transactions[0].type).toBe("debit");
    expect(stmt.transactions[1].amount).toBe(25000);
    expect(stmt.transactions[1].type).toBe("credit");
  });

  it("parses dates from YYYYMMDD format", () => {
    const stmt = parseOFX(SAMPLE_OFX);
    expect(stmt.transactions[0].date.getFullYear()).toBe(2024);
    expect(stmt.transactions[0].date.getMonth()).toBe(8);
    expect(stmt.transactions[0].date.getDate()).toBe(5);
  });

  it("combines NAME and MEMO into description", () => {
    const stmt = parseOFX(SAMPLE_OFX);
    expect(stmt.transactions[0].description).toBe("WOOLWORTHS - CARD PURCHASE");
  });

  it("uses FITID as reference", () => {
    const stmt = parseOFX(SAMPLE_OFX);
    expect(stmt.transactions[0].reference).toBe("20240905001");
  });

  it("parses XML-style OFX 2.x", () => {
    const stmt = parseOFX(SAMPLE_OFX_XML);
    expect(stmt.transactions).toHaveLength(1);
    expect(stmt.accountNumber).toBe("1234567890");
    expect(stmt.bank).toBe("standard-bank");
  });

  it("handles timezone suffixes in dates", () => {
    const stmt = parseOFX(SAMPLE_OFX_XML);
    expect(stmt.transactions[0].date.getFullYear()).toBe(2024);
    expect(stmt.transactions[0].date.getMonth()).toBe(8);
    expect(stmt.transactions[0].date.getDate()).toBe(10);
  });

  it("guesses bank from BANKID", () => {
    expect(parseOFX(SAMPLE_OFX).bank).toBe("fnb");
    expect(parseOFX(SAMPLE_OFX_XML).bank).toBe("standard-bank");
  });
});
