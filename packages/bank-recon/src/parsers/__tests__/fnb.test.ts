import { describe, it, expect } from "vitest";
import { parseFNB } from "../fnb.js";

const SAMPLE_CSV = `"62123456789","FNB Cheque Account"
"Date","Amount","Balance","Description"
"05/09/2024","-1500.00","8500.00","DEBIT CARD PURCHASE WOOLWORTHS"
"05/09/2024","25000.00","33500.00","ACB CREDIT SALARY 123456"
"06/09/2024","-350.50","33149.50","PREPAID PURCHASE VODACOM"
`;

describe("parseFNB", () => {
  it("parses transactions with correct fields", () => {
    const stmt = parseFNB(SAMPLE_CSV);
    expect(stmt.bank).toBe("fnb");
    expect(stmt.accountNumber).toBe("62123456789");
    expect(stmt.transactions).toHaveLength(3);
  });

  it("identifies debits and credits", () => {
    const stmt = parseFNB(SAMPLE_CSV);
    expect(stmt.transactions[0].type).toBe("debit");
    expect(stmt.transactions[0].amount).toBe(1500);
    expect(stmt.transactions[1].type).toBe("credit");
    expect(stmt.transactions[1].amount).toBe(25000);
  });

  it("parses dates correctly", () => {
    const stmt = parseFNB(SAMPLE_CSV);
    expect(stmt.transactions[0].date.getFullYear()).toBe(2024);
    expect(stmt.transactions[0].date.getMonth()).toBe(8); // September
    expect(stmt.transactions[0].date.getDate()).toBe(5);
  });

  it("extracts references from descriptions", () => {
    const stmt = parseFNB(SAMPLE_CSV);
    expect(stmt.transactions[1].reference).toBe("123456");
  });

  it("parses balances", () => {
    const stmt = parseFNB(SAMPLE_CSV);
    expect(stmt.transactions[0].balance).toBe(8500);
  });
});
