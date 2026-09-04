import { describe, it, expect } from "vitest";
import { parseNedbank } from "../nedbank.js";

const SAMPLE_CSV = `Account Number: 1234567890
Statement Period: 2024-09-01 to 2024-09-30
Transaction Date;Value Date;Transaction Reference Number;Description;Debit Amount;Credit Amount;Balance
2024-09-02;2024-09-02;REF001;SALARY DEPOSIT;;45000.00;45000.00
2024-09-03;2024-09-03;REF002;RENT PAYMENT;12000.00;;33000.00
2024-09-05;2024-09-05;REF003;GROCERY STORE;850.75;;32149.25
`;

describe("parseNedbank", () => {
  it("parses semicolon-delimited format", () => {
    const stmt = parseNedbank(SAMPLE_CSV);
    expect(stmt.bank).toBe("nedbank");
    expect(stmt.transactions).toHaveLength(3);
  });

  it("handles separate debit/credit columns", () => {
    const stmt = parseNedbank(SAMPLE_CSV);
    expect(stmt.transactions[0].type).toBe("credit");
    expect(stmt.transactions[0].amount).toBe(45000);
    expect(stmt.transactions[1].type).toBe("debit");
    expect(stmt.transactions[1].amount).toBe(12000);
  });

  it("preserves reference numbers", () => {
    const stmt = parseNedbank(SAMPLE_CSV);
    expect(stmt.transactions[0].reference).toBe("REF001");
  });
});
