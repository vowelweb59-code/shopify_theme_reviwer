import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { matchThemeForTab, normalizeDomain, parseDelimited, parseSaleDate, parseSalesFile, readWorkbook, salesFromRows } from "./parseSalesFile";

// Shaped like the user's real Adorn sheet: undated reference rows first,
// a second preset-like column headed "Shop Email", a refund row.
const TSV = [
  "Date\tShop Name\tShop Domain\tPreset\tShop Email\tCountry\tCharge Type\tSale\tFee\tShare",
  "\t\thttps://jacktlabs.com.au/\tAce\tAce",
  "2026-07-30 12:31:51 UTC\tElaineSilverCo\telainesilverco.myshopify.com\tPrecious\tPrecious\tUS\tTheme sale\t270\t40.5\t221.67",
  "2026-03-23 17:12:46 UTC\tBELLASUPERMARKET\tqkgnif-dk.myshopify.com\tStore Unavailable\tAdorn\tCO\tTheme sale\t270\t40.5\t221.67",
  "2025-12-17 10:31:14 UTC\tMy Store\tp1wuv9-rg.myshopify.com\tStore Unavailable\tStore Unavailable\tAU\tTheme refund\t-200\t-30\t-170",
  "\t\t\t\t",
].join("\n");

describe("parseSalesFile", () => {
  it("reads the user's tab-separated sheet, skipping undated reference rows", async () => {
    const { sales, skipped } = await parseSalesFile(Buffer.from(TSV), "adorn.tsv");
    expect(skipped).toBe(1);
    expect(sales).toHaveLength(3);
    expect(sales[0]).toMatchObject({
      month: "2026-07",
      shopName: "ElaineSilverCo",
      shopDomain: "elainesilverco.myshopify.com",
      country: "US",
      chargeType: "sale",
      amount: 270,
      fee: 40.5,
      share: 221.67,
      sheetPresets: ["Precious"],
    });
    expect(sales[0].soldAt.toISOString()).toBe("2026-07-30T12:31:51.000Z");
    expect(sales[1]).toMatchObject({ sheetPresets: ["Store Unavailable", "Adorn"] });
    expect(sales[2]).toMatchObject({ chargeType: "refund", amount: -200, share: -170, month: "2025-12" });
  });

  it("reads an .xlsx export the same way", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sales");
    for (const line of TSV.split("\n")) ws.addRow(line.split("\t"));
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const { sales } = await parseSalesFile(buffer, "adorn.xlsx");
    expect(sales.map((s) => s.shopDomain)).toEqual(["elainesilverco.myshopify.com", "qkgnif-dk.myshopify.com", "p1wuv9-rg.myshopify.com"]);
  });

  it("reads every tab of a one-tab-per-theme workbook, and picks a theme's own tab", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Summary").addRow(["Total", "1234"]);
    for (const name of ["Adorn", "Noble"]) {
      const ws = wb.addWorksheet(name);
      for (const line of TSV.split("\n")) ws.addRow(line.split("\t"));
    }
    wb.getWorksheet("Noble")!.addRow(["2026-08-01 10:00:00 UTC", "Extra", "extra.myshopify.com", "Glide", "Glide", "US", "Theme sale", "300", "45", "246.3"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const sheets = await readWorkbook(buffer);
    expect(sheets.map((s) => s.name)).toEqual(["Summary", "Adorn", "Noble"]);
    // A theme's tab is found by name; the summary tab isn't mistaken for sales.
    expect((await parseSalesFile(buffer, "all.xlsx", "Noble")).sales).toHaveLength(4);
    expect((await parseSalesFile(buffer, "all.xlsx", "Adorn")).sales).toHaveLength(3);
  });

  it("finds charge type and money by content when the header is a column off (the Nexus tab)", () => {
    const { sales } = salesFromRows([
      ["Date", "Shop Name", "Shop Domain", "Actual Domain", "Preset", "Tool", "Country", "", "Charge Type", "Sale", "Fee", "Share"],
      ["2026-08-29 21:33:11 UTC", "My Store", "1s7272-px.myshopify.com", "info@evolucientwt.com", "Delicious", "Delicious", "Theme sale", "270", "40.5", "221.67"],
    ]);
    expect(sales[0]).toMatchObject({ chargeType: "sale", amount: 270, fee: 40.5, share: 221.67, country: "", sheetPresets: ["Delicious"] });
  });

  it("handles the Gravity tab, whose data sits left of its header", () => {
    const { sales } = salesFromRows([
      ["Date", "Shop Name", "Shop Domain", "Actual Domain", "Preset", "", "Actual Domain", "Remark", "Status", "Shop Email", "Country", "Charge Type", "Sale", "Fee", "Share"],
      ["2026-09-02 01:41:07 UTC", "BGR Collective", "n5vdqe-dy.myshopify.com", "madebybgr@gmail.com", "Everbloom", "Everbloom", "", "", "", "US", "Theme sale", "190", "28.5", "155.99", ""],
    ]);
    expect(sales[0]).toMatchObject({ chargeType: "sale", amount: 190, fee: 28.5, share: 155.99, country: "US", sheetPresets: ["Everbloom"] });
  });

  it("treats an empty charge type as a sale, or a refund when the amount is negative (the Flaunt tab)", () => {
    const { sales } = salesFromRows([
      ["Date", "Shop Name", "Shop Domain", "", "Preset Name", "Preset", "Country", "Charge Type", "Sale", "Fee", "Share"],
      ["2026-08-24 20:59:44 UTC", "Kaboodles", "kaboodles-toy-store.myshopify.com", "toylady@kaboodles.ca", "Dropped", "Flaunt", "US", "", "270", "40.5", "221.67"],
      ["2026-08-25 10:00:00 UTC", "Kaboodles", "kaboodles-toy-store.myshopify.com", "", "Dropped", "Flaunt", "US", "", "-270", "-40.5", "-221.67"],
    ]);
    expect(sales.map((s) => s.chargeType)).toEqual(["sale", "refund"]);
    expect(sales[0].sheetPresets).toEqual(["Dropped", "Flaunt"]);
  });

  it("reads Partner Sale / Shopify Fee / Partner Share and a Manual preset column first (Zeal, Noble tabs)", () => {
    const zeal = salesFromRows([
      ["Date", "Shop Name", "Shop Domain", "Preset", "", "Shop Email", "Shop Country", "Charge Type", "Partner Sale", "Shopify Fee", "Partner Share", "Sale by"],
      ["2026-08-01 10:00:00 UTC", "Pup", "pup.myshopify.com", "Pulse", "Pulse", "a@b.com", "GB", "Theme sale", "300", "45", "243.1", "Ali"],
    ]).sales[0];
    expect(zeal).toMatchObject({ amount: 300, fee: 45, share: 243.1, country: "GB", sheetPresets: ["Pulse"] });
    const noble = salesFromRows([
      ["Date", "Shop Name", "Shop Domain", "Preset - Manual", "Preset - By Tool", "Shop Email", "Country", "Charge Type", "Sale", "Fee", "Share"],
      ["2026-08-31 03:03:59 UTC", "Silver", "silver.myshopify.com", "Glide", "Dropped", "", "US", "Theme sale", "250", "37.5", "205.25"],
    ]).sales[0];
    expect(noble.sheetPresets).toEqual(["Glide", "Dropped"]);
  });

  it("refuses a file with no recognizable header", () => {
    expect(() => salesFromRows([["a", "b"], ["1", "2"]])).toThrow("header row");
  });
});

describe("helpers", () => {
  it("parses quoted CSV fields", () => {
    expect(parseDelimited('Date,Shop Name\n2026-01-01,"Smith, Co ""X"""')).toEqual([["Date", "Shop Name"], ["2026-01-01", 'Smith, Co "X"']]);
  });

  it("normalizes store URLs to a host", () => {
    expect(normalizeDomain("https://madrinaleather.com/password")).toBe("madrinaleather.com");
    expect(normalizeDomain("ABC.myshopify.com")).toBe("abc.myshopify.com");
    expect(normalizeDomain("")).toBe("");
  });

  it("parses the sheet's date formats as UTC", () => {
    expect(parseSaleDate("2026-02-07 02:27:04 UTC")?.toISOString()).toBe("2026-02-07T02:27:04.000Z");
    expect(parseSaleDate("2026-02-07")?.toISOString()).toBe("2026-02-07T00:00:00.000Z");
    expect(parseSaleDate("Feb 7")).toBeNull();
  });
});

describe("matchThemeForTab", () => {
  const themes = [{ name: "Adorn" }, { name: "Noble" }, { name: "Gravity" }];
  it("matches tab names to themes loosely", () => {
    expect(matchThemeForTab("Adorn", themes)?.name).toBe("Adorn");
    expect(matchThemeForTab(" adorn ", themes)?.name).toBe("Adorn");
    expect(matchThemeForTab("NOBLE", themes)?.name).toBe("Noble");
    expect(matchThemeForTab("Gravity sales 2026", themes)?.name).toBe("Gravity");
  });

  it("gives up on unknown or ambiguous tabs", () => {
    expect(matchThemeForTab("Summary", themes)).toBeNull();
    expect(matchThemeForTab("Adorn vs Noble", themes)).toBeNull();
  });
});
