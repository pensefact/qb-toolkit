import { describe, it, expect } from "vitest";
import { parseABSA } from "../absa.js";

const SAMPLE_CSV = `Absa Bank Limited
Account Number: 4012345678
Date,Description,Amount,Balance
03 Sep 2024,SALARY DEPOSIT 456789,25000.00,35000.00
05 Sep 2024,DEBIT ORDER INSURANCE,-350.00,34650.00
06 Sep 2024,POS PURCHASE SPAR,-450.75,34199.25
`;

describe("parseABSA", () => {
  it("parses transactions with correct bank and account number", () => {
    const stmt = parseABSA(SAMPLE_CSV);
    expect(stmt.bank).toBe("absa");
    expect(stmt.accountNumber).toBe("4012345678");
    expect(stmt.transactions).toHaveLength(3);
  });

  it("parses DD MMM YYYY dates", () => {
    const stmt = parseABSA(SAMPLE_CSV);
    expect(stmt.transactions[0].date).toEqual(new Date(2024, 8, 3));
  });

  it("parses YYYY-MM-DD dates", () => {
    const stmt = parseABSA(`Absa Bank Limited
Account Number: 4012345678
Date,Description,Amount,Balance
2024-09-03,SALARY DEPOSIT,25000.00,35000.00
`);
    expect(stmt.transactions[0].date).toEqual(new Date(2024, 8, 3));
  });

  it("throws on an unrecognized date format", () => {
    expect(() =>
      parseABSA(`Absa Bank Limited
Account Number: 4012345678
Date,Description,Amount,Balance
03/09/2024,SALARY DEPOSIT,25000.00,35000.00
`)
    ).toThrow(/Cannot parse ABSA date/);
  });

  it("derives type from amount sign and stores amount as a positive value", () => {
    const stmt = parseABSA(SAMPLE_CSV);
    expect(stmt.transactions[0].type).toBe("credit");
    expect(stmt.transactions[0].amount).toBe(25000);
    expect(stmt.transactions[1].type).toBe("debit");
    expect(stmt.transactions[1].amount).toBe(350);
  });

  it("extracts a numeric reference from the description", () => {
    const stmt = parseABSA(SAMPLE_CSV);
    expect(stmt.transactions[0].reference).toBe("456789");
    expect(stmt.transactions[1].reference).toBe("");
  });

  it("parses the running balance", () => {
    const stmt = parseABSA(SAMPLE_CSV);
    expect(stmt.transactions[0].balance).toBe(35000);
  });

  it("skips blank lines and rows with too few columns", () => {
    const stmt = parseABSA(`Absa Bank Limited
Account Number: 4012345678
Date,Description,Amount,Balance
03 Sep 2024,SALARY DEPOSIT,25000.00,35000.00

only,two
`);
    expect(stmt.transactions).toHaveLength(1);
  });

  it("throws when the CSV has no header row", () => {
    expect(() => parseABSA("just one line")).toThrow(
      "ABSA CSV too short"
    );
  });

  it("throws when no Date/Amount header can be found", () => {
    expect(() =>
      parseABSA("Absa Bank Limited\nAccount Number: 4012345678\nfoo,bar\n1,2")
    ).toThrow("Cannot find ABSA header row");
  });
});
