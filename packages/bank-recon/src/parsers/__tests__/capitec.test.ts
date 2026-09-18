import { describe, it, expect } from "vitest";
import { parseCapitec } from "../capitec.js";

const SEPARATE_COLUMNS_CSV = `Capitec Bank
Account Number: 1234567890
Date,Transaction,Description,Debit,Credit,Balance
2024-09-02,POS,SALARY DEPOSIT 456789,,25000.00,35000.00
2024-09-03,DEB,RENT PAYMENT,12000.00,,23000.00
`;

describe("parseCapitec", () => {
  it("parses transactions with correct bank and account number", () => {
    const stmt = parseCapitec(SEPARATE_COLUMNS_CSV);
    expect(stmt.bank).toBe("capitec");
    expect(stmt.accountNumber).toBe("1234567890");
    expect(stmt.transactions).toHaveLength(2);
  });

  it("parses YYYY-MM-DD dates", () => {
    const stmt = parseCapitec(SEPARATE_COLUMNS_CSV);
    expect(stmt.transactions[0].date).toEqual(new Date(2024, 8, 2));
  });

  it("parses DD/MM/YYYY dates", () => {
    const stmt = parseCapitec(`Capitec Bank
Account Number: 1234567890
Date,Transaction,Description,Debit,Credit,Balance
02/09/2024,POS,SALARY DEPOSIT,,25000.00,35000.00
`);
    expect(stmt.transactions[0].date).toEqual(new Date(2024, 8, 2));
  });

  it("uses separate debit/credit columns when both are present", () => {
    const stmt = parseCapitec(SEPARATE_COLUMNS_CSV);
    expect(stmt.transactions[0].type).toBe("credit");
    expect(stmt.transactions[0].amount).toBe(25000);
    expect(stmt.transactions[1].type).toBe("debit");
    expect(stmt.transactions[1].amount).toBe(12000);
  });

  it("falls back to a single signed amount column when there is no separate credit column", () => {
    const stmt = parseCapitec(`Capitec Bank
Account Number: 1234567890
Date,Transaction,Description,Amount,Balance
2024-09-02,POS,SALARY DEPOSIT,25000.00,35000.00
2024-09-03,DEB,RENT PAYMENT,-12000.00,23000.00
`);
    expect(stmt.transactions[0].type).toBe("credit");
    expect(stmt.transactions[0].amount).toBe(25000);
    expect(stmt.transactions[1].type).toBe("debit");
    expect(stmt.transactions[1].amount).toBe(12000);
  });

  it("extracts a numeric reference from the description", () => {
    const stmt = parseCapitec(SEPARATE_COLUMNS_CSV);
    expect(stmt.transactions[0].reference).toBe("456789");
    expect(stmt.transactions[1].reference).toBe("");
  });

  it("parses the running balance", () => {
    const stmt = parseCapitec(SEPARATE_COLUMNS_CSV);
    expect(stmt.transactions[0].balance).toBe(35000);
  });

  it("skips rows where both debit and credit are zero or blank", () => {
    const stmt = parseCapitec(`Capitec Bank
Account Number: 1234567890
Date,Transaction,Description,Debit,Credit,Balance
2024-09-02,FEE REVERSAL,ADMIN,0,0,35000.00
2024-09-03,POS,SALARY DEPOSIT,,25000.00,60000.00
`);
    expect(stmt.transactions).toHaveLength(1);
    expect(stmt.transactions[0].amount).toBe(25000);
  });

  it("throws when the CSV has no header row", () => {
    expect(() => parseCapitec("just one line")).toThrow(
      "Capitec CSV too short"
    );
  });

  it("throws when no Date/Debit/Amount header can be found", () => {
    expect(() =>
      parseCapitec("Capitec Bank\nAccount Number: 1234567890\nfoo,bar\n1,2")
    ).toThrow("Cannot find Capitec header row");
  });
});
