import { describe, expect, it } from "vitest";
import { fixMojibake, onlyMonth, parseDelimited, parseMonth, salesFromRows } from "./parseSalesFile";

describe("fixMojibake", () => {
  it("repairs UTF-8 text that was read as Windows-1252", () => {
    expect(fixMojibake("PureLifeâ„¢")).toBe("PureLife™");
    expect(fixMojibake("MaÄŸazam")).toBe("Mağazam");
    expect(fixMojibake("MÃ³j sklep")).toBe("Mój sklep");
    expect(fixMojibake("æˆ‘çš„å•†åº—")).toBe("我的商店");
  });
  it("leaves clean and unrepairable text alone", () => {
    expect(fixMojibake("My Store")).toBe("My Store");
    expect(fixMojibake("Café Zoë")).toBe("Café Zoë");
    expect(fixMojibake("Ãx")).toBe("Ãx");
  });
});

describe("parseMonth / onlyMonth", () => {
  const sale = (month: string) => ({ month }) as never;
  it("accepts only YYYY-MM", () => {
    expect(parseMonth("2026-10")).toBe("2026-10");
    expect(["2026-13", "2026-1", "October", "", undefined].map(parseMonth)).toEqual([null, null, null, null, null]);
  });
  it("keeps one month's sales and counts the rest", () => {
    const r = onlyMonth([sale("2026-10"), sale("2026-11"), sale("2026-10"), sale("2025-10")], "2026-10");
    expect(r.sales).toHaveLength(2);
    expect(r.otherMonths).toBe(2);
  });
  it("keeps everything when no month is chosen", () => {
    expect(onlyMonth([sale("2026-10"), sale("2026-11")], null).otherMonths).toBe(0);
  });
});

describe("a monthly paste end to end", () => {
  // Rows shaped like a real sheet: header, blank rows, a Nov row and a garbled name.
  const text = [
    "Date\tShop Name\tShop Domain\tShop Email\tCountry\tCharge Type\tSale\tFee\tShare",
    "",
    "2026-11-03 02:24:43 UTC\tEERA Roofing\tmr1uxr-cc.myshopify.com\ta@b.com\tUS\tTheme sale\t270\t40.5\t221.67",
    "2026-10-16 15:22:03 UTC\tMaÄŸazam\tu9kjbu-y0.myshopify.com\tc@d.com\tTR\tTheme sale\t270\t40.5\t208.17",
    "2026-10-05 14:02:55 UTC\teurytaly\tbgfggf-05.myshopify.com\te@f.com\tES\tTheme refund\t-270\t-40.5\t-229.5",
  ].join("\n");

  it("imports only the chosen month, repairs names, and keeps refunds", () => {
    const parsed = salesFromRows(parseDelimited(text), { headerOptional: true });
    const picked = onlyMonth(parsed.sales, "2026-10");
    expect(picked.otherMonths).toBe(1);
    expect(picked.sales.map((s) => [s.shopName, s.chargeType, s.amount])).toEqual([
      ["Mağazam", "sale", 270],
      ["eurytaly", "refund", -270],
    ]);
  });
});
