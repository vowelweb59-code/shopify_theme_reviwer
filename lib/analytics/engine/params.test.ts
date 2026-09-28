import { describe, expect, it } from "vitest";
import { breakdownFor, FilterError, parseFilters } from "./filters";
import { MetricsRequestError, parseBreakdownQuery, parseMetricsQuery } from "./params";

const qs = (s: string) => new URLSearchParams(s);

describe("parseMetricsQuery", () => {
  it("defaults to All Themes, last 30 days, compared with the previous period", () => {
    expect(parseMetricsQuery(qs(""))).toEqual({ theme: "all", range: { preset: "last30" }, compare: true, filters: {} });
  });

  it("reads theme, range, compare and filters", () => {
    expect(parseMetricsQuery(qs("theme=adorn&range=custom&start=2026-01-01&end=2026-01-31&compare=none&country=India"))).toEqual({
      theme: "adorn",
      range: { preset: "custom", start: "2026-01-01", end: "2026-01-31" },
      compare: false,
      filters: { country: "India" },
    });
  });

  it.each([
    ["range=forever", /Unknown range/],
    ["range=custom&start=2026-01-01", /start and end/],
    ["compare=yes", /compare/],
    [`country=${"x".repeat(501)}`, /too long/],
  ])("rejects %s", (query, message) => {
    expect(() => parseMetricsQuery(qs(query))).toThrow(MetricsRequestError);
    expect(() => parseMetricsQuery(qs(query))).toThrow(message);
  });
});

describe("parseBreakdownQuery", () => {
  it("needs a known dimension, and has sort/paging defaults", () => {
    expect(() => parseBreakdownQuery(qs(""))).toThrow(/dimension is required/);
    expect(() => parseBreakdownQuery(qs("dimension=planet"))).toThrow(/dimension is required/);
    expect(parseBreakdownQuery(qs("dimension=device"))).toMatchObject({ dimension: "device", groupDims: ["deviceCategory"], sort: "installs", order: "desc", limit: 25, offset: 0 });
  });

  it("no longer offers city, browser or OS", () => {
    for (const dimension of ["city", "browser", "os"]) expect(() => parseBreakdownQuery(qs(`dimension=${dimension}`))).toThrow(/dimension is required/);
  });

  it.each(["limit=0", "limit=101", "limit=2.5", "offset=-1", "sort=revenue", "sort=users", "order=up"])("rejects %s", (extra) => {
    expect(() => parseBreakdownQuery(qs(`dimension=country&${extra}`))).toThrow(MetricsRequestError);
  });
});

describe("filters", () => {
  it("maps public names to GA4 dimensions and ignores empty values", () => {
    expect(parseFilters(qs("device=mobile&os=iOS&source=google&page=&landingPage=/"))).toEqual({ deviceCategory: "mobile", sessionSource: "google", landingPage: "/" }); // os is no longer a filter
    expect(parseFilters(qs("channel=Organic Search"))).toEqual({ sessionDefaultChannelGroup: "Organic Search" });
  });

  it("picks the smallest breakdown that carries every dimension", () => {
    expect(breakdownFor([])).toBe("total");
    expect(breakdownFor(["country"])).toBe("country");
    expect(breakdownFor(["sessionMedium", "sessionSource"])).toBe("acquisition");
    expect(breakdownFor(["pagePath"])).toBe("page");
    expect(breakdownFor(["sessionDefaultChannelGroup"])).toBe("channel");
  });

  it("refuses combinations across dimension families", () => {
    expect(() => breakdownFor(["country", "deviceCategory"])).toThrow(FilterError);
    expect(() => breakdownFor(["country", "deviceCategory"])).toThrow(/country \+ device can't be combined/);
  });

});
