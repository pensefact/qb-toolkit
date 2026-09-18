import { describe, it, expect } from "vitest";
import { parseStandardBank } from "../standard-bank.js";

const SAMPLE_CSV = `Standard Bank
Account: 1234567890
Date,Description,Amount,Balance
2024/09/02,SALARY DEPOSIT 456789,25000.00,35000.00
2024/09/03,DEBIT ORDER RENT,-12000.00,23000.00
2024/09/05,POS PURCHASE SPAR,-450.75,22549.25
`;

describe("parseStandardBank", () => {
  it("parses transactions with correct bank and account number", () => {
    const stmt = parseStandardBank(SAMPLE_CSV);
    expect(stmt.bank).toBe("standard-bank");
    expect(stmt.accountNumber).toBe("1234567890");
    expect(stmt.transactions).toHaveLength(3);
  });

  it("parses YYYY/MM/DD dates", () => {
    const stmt = parseStandardBank(SAMPLE_CSV);
    expect(stmt.transactions[0].date).toEqual(new Date(2024, 8, 2));
  });

  it("parses DD/MM/YYYY dates", () => {
    const stmt = parseStandardBank(`Standard Bank
Account: 1234567890
Date,Description,Amount,Balance
02/09/2024,SALARY DEPOSIT,25000.00,35000.00
`);
    expect(stmt.transactions[0].date).toEqual(new Date(2024, 8, 2));
  });

  it("throws on an unrecognized date format", () => {
    expect(() =>
      parseStandardBank(`Standard Bank
Account: 1234567890
Date,Description,Amount,Balance
2024-Sep-02,SALARY DEPOSIT,25000.00,35000.00
`)
    ).toThrow(/Cannot parse Standard Bank date/);
  });

  it("derives type from the amount sign and stores amount as a positive value", () => {
    const stmt = parseStandardBank(SAMPLE_CSV);
    expect(stmt.transactions[0].type).toBe("credit");
    expect(stmt.transactions[0].amount).toBe(25000);
    expect(stmt.transactions[1].type).toBe("debit");
    expect(stmt.transactions[1].amount).toBe(12000);
  });

  it("extracts a numeric reference from the description", () => {
    const stmt = parseStandardBank(SAMPLE_CSV);
    expect(stmt.transactions[0].reference).toBe("456789");
    expect(stmt.transactions[1].reference).toBe("");
  });

  it("parses the running balance", () => {
    const stmt = parseStandardBank(SAMPLE_CSV);
    expect(stmt.transactions[0].balance).toBe(35000);
  });

  it("skips blank lines and rows with too few columns", () => {
    const stmt = parseStandardBank(`Standard Bank
Account: 1234567890
Date,Description,Amount,Balance
2024/09/02,SALARY DEPOSIT,25000.00,35000.00

only,two
`);
    expect(stmt.transactions).toHaveLength(1);
  });

  it("throws when the CSV has no header row", () => {
    expect(() => parseStandardBank("just one line")).toThrow(
      "Standard Bank CSV too short"
    );
  });

  it("throws when no Date/Amount header can be found", () => {
    expect(() =>
      parseStandardBank("Standard Bank\nAccount: 1234567890\nfoo,bar\n1,2")
    ).toThrow("Cannot find Standard Bank header row");
  });
});
