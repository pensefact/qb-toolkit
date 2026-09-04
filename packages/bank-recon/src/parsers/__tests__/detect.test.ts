import { describe, it, expect } from "vitest";
import { detectBank } from "../index.js";

describe("detectBank", () => {
  it("detects Nedbank by semicolons and header", () => {
    expect(detectBank("Transaction Date;Value Date;Ref")).toBe("nedbank");
  });

  it("detects FNB by name", () => {
    expect(detectBank("FNB Cheque Account\nDate,Amount")).toBe("fnb");
  });

  it("detects Standard Bank", () => {
    expect(detectBank("Standard Bank\nDate,Amount")).toBe("standard-bank");
  });

  it("detects ABSA", () => {
    expect(detectBank("Absa Bank\nDate,Amount")).toBe("absa");
  });

  it("detects Capitec", () => {
    expect(detectBank("Capitec Bank\nDate,Amount")).toBe("capitec");
  });

  it("returns null for unknown", () => {
    expect(detectBank("some random csv")).toBeNull();
  });
});
