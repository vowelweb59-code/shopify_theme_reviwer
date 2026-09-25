import { describe, expect, it } from "vitest";
import { breakdownFor, filtersKey, FilterError, parseFilters, sumsAcrossRows } from "./filters";
import { MetricsRequestError, parseBreakdownQuery, parseMetricsQuery } from "./params";

const qs = (s: string) => new URLSearchParams(s);

describe("parseMetricsQuery", () => {
  it("defaults to All Themes, last 30 days, compared with the previous period", () => {
    expect(parseMetricsQuery(qs(""))).toEqual({ theme: "all", range: { preset: "last30" }, compare: true, filters: {}, events: [] });
  });

  it("reads theme, range, compare, events and filters", () => {
    expect(parseMetricsQuery(qs("theme=adorn&range=custom&start=2026-01-01&end=2026-01-31&compare=none&events=scroll,click,scroll&country=India&city=Pune"))).toEqual({
      theme: "adorn",
      range: { preset: "custom", start: "2026-01-01", end: "2026-01-31" },
      compare: false,
      filters: { country: "India", city: "Pune" },
      events: ["scroll", "click"],
    });
  });

  it.each([
    ["range=forever", /Unknown range/],
    ["range=custom&start=2026-01-01", /start and end/],
    ["compare=yes", /compare/],
    ["events=purchase", /Untracked event/],
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
    expect(parseBreakdownQuery(qs("dimension=device"))).toMatchObject({ dimension: "device", groupDims: ["deviceCategory"], sort: "users", order: "desc", limit: 25, offset: 0 });
  });

  it("groups cities by country + city", () => {
    expect(parseBreakdownQuery(qs("dimension=city")).groupDims).toEqual(["country", "city"]);
  });

  it.each(["limit=0", "limit=101", "limit=2.5", "offset=-1", "sort=revenue", "order=up"])("rejects %s", (extra) => {
    expect(() => parseBreakdownQuery(qs(`dimension=country&${extra}`))).toThrow(MetricsRequestError);
  });
});

describe("filters", () => {
  it("maps public names to GA4 dimensions and ignores empty values", () => {
    expect(parseFilters(qs("device=mobile&os=iOS&source=google&page=&landingPage=/"))).toEqual({ deviceCategory: "mobile", operatingSystem: "iOS", sessionSource: "google", landingPage: "/" });
    expect(parseFilters(qs("channel=Organic Search"))).toEqual({ sessionDefaultChannelGroup: "Organic Search" });
  });

  it("picks the smallest breakdown that carries every dimension", () => {
    expect(breakdownFor([])).toBe("total");
    expect(breakdownFor(["country"])).toBe("country");
    expect(breakdownFor(["city"])).toBe("city");
    expect(breakdownFor(["country", "city"])).toBe("city");
    expect(breakdownFor(["sessionMedium", "sessionSource"])).toBe("acquisition");
    expect(breakdownFor(["pagePath"])).toBe("page");
    expect(breakdownFor(["sessionDefaultChannelGroup"])).toBe("channel");
  });

  it("refuses combinations across dimension families", () => {
    expect(() => breakdownFor(["country", "deviceCategory"])).toThrow(FilterError);
    expect(() => breakdownFor(["country", "deviceCategory"])).toThrow(/country \+ device can't be combined/);
  });

  it("knows when daily users are summed over several rows", () => {
    expect(sumsAcrossRows("country", ["country"])).toBe(false);
    expect(sumsAcrossRows("city", ["city"])).toBe(true); // same city name in several countries
    expect(sumsAcrossRows("acquisition", ["sessionSource"])).toBe(true);
    expect(sumsAcrossRows("total", [])).toBe(false);
  });

  it("builds an order-independent key", () => {
    expect(filtersKey({ city: "Pune", country: "India" })).toBe(filtersKey({ country: "India", city: "Pune" }));
  });
});
