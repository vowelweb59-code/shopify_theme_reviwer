import { describe, expect, it } from "vitest";
import { csvCell } from "./csvUtil";

describe("csvCell", () => {
  it("neutralises formulas and quotes everything", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("plain, text")).toBe('"plain, text"');
  });
  it("leaves numbers and empty values alone", () => {
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});
