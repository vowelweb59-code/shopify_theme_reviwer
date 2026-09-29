import { describe, expect, it } from "vitest";
import { escapeCsvField } from "./csvUtil";

describe("escapeCsvField", () => {
  it("quotes values containing commas, quotes or newlines", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""');
  });

  it("neutralizes values a spreadsheet would run as a formula", () => {
    expect(escapeCsvField('=HYPERLINK("https://evil/","x")')).toBe(`"'=HYPERLINK(""https://evil/"",""x"")"`);
    expect(escapeCsvField("+1")).toBe("'+1");
    expect(escapeCsvField("-cmd")).toBe("'-cmd");
    expect(escapeCsvField("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});
