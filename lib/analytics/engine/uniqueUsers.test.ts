import { describe, expect, it, vi } from "vitest";
import type { DataApi, ReportRequest } from "../sync/ga4Client";
import { buildUniqueUsersRequests, cacheKeyFor, fetchUniqueUsers, getUniqueUsers, isSettled, type UniqueUsersRequest } from "./uniqueUsers";
import { uniqueFor } from "./metrics";

const base: UniqueUsersRequest = {
  themeId: "t1",
  propertyId: "123456789",
  connectionId: "c1",
  timeZone: "UTC",
  range: { start: "2026-09-01", end: "2026-09-30" },
  groupDims: [],
  filters: {},
  events: ["view_item", "add_to_cart", "shopify_theme_install"],
};

const v = (value: string) => ({ value });

function fakeApi(respond: (body: ReportRequest) => unknown) {
  const runReport = vi.fn(async ({ requestBody }: { requestBody: ReportRequest }) => ({ data: respond(requestBody) }));
  return { api: { properties: { runReport } } as unknown as DataApi, runReport };
}

describe("buildUniqueUsersRequests", () => {
  it("asks for range-level totalUsers overall and per event", () => {
    const { totals, events } = buildUniqueUsersRequests(base);
    expect(totals.dimensions).toEqual([]);
    expect(totals.metrics).toEqual([{ name: "totalUsers" }]);
    expect(totals.dateRanges).toEqual([{ startDate: "2026-09-01", endDate: "2026-09-30" }]);
    expect(totals.dimensionFilter).toBeUndefined();
    expect(events.dimensions).toEqual([{ name: "eventName" }]);
    expect(events.dimensionFilter).toEqual({ filter: { fieldName: "eventName", inListFilter: { values: base.events } } });
  });

  it("applies filters with exact matching and groups by the requested dims", () => {
    const { totals, events } = buildUniqueUsersRequests({ ...base, groupDims: ["country", "city"], filters: { country: "India" } });
    expect(totals.dimensions).toEqual([{ name: "country" }, { name: "city" }]);
    expect(totals.dimensionFilter).toEqual({ filter: { fieldName: "country", stringFilter: { matchType: "EXACT", value: "India" } } });
    expect(events.dimensions!.map((d) => d.name)).toEqual(["eventName", "country", "city"]);
    expect(events.dimensionFilter!.andGroup!.expressions).toHaveLength(2);
  });

  it("limits a shared property's theme to its own pages, and caches it separately", () => {
    const pageFilter = { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/themes/adorn/", caseSensitive: false } } };
    const { totals, events } = buildUniqueUsersRequests({ ...base, pagePathPrefix: "/themes/adorn/" });
    expect(totals.dimensionFilter).toEqual(pageFilter);
    expect(events.dimensionFilter!.andGroup!.expressions).toContainEqual(pageFilter);
    expect(cacheKeyFor({ ...base, pagePathPrefix: "/themes/adorn/" })).not.toBe(cacheKeyFor(base));
    expect(cacheKeyFor({ ...base, pagePathPrefix: null })).toBe(cacheKeyFor(base));
  });
});

describe("fetchUniqueUsers", () => {
  it("maps both reports into per-group users", async () => {
    const { api, runReport } = fakeApi((body) =>
      body.dimensions![0]?.name === "eventName"
        ? {
            rows: [
              { dimensionValues: [v("add_to_cart"), v("India")], metricValues: [v("40")] },
              { dimensionValues: [v("shopify_theme_install"), v("India")], metricValues: [v("9")] },
              { dimensionValues: [v("add_to_cart"), v("Brazil")], metricValues: [v("3")] },
            ],
            rowCount: 3,
          }
        : { rows: [{ dimensionValues: [v("India")], metricValues: [v("500")] }, { dimensionValues: [v("Brazil")], metricValues: [v("20")] }], rowCount: 2 }
    );
    const result = await fetchUniqueUsers(api, { ...base, groupDims: ["country"] });
    expect(runReport).toHaveBeenCalledTimes(2);
    expect(runReport.mock.calls[0][0]).toMatchObject({ property: "properties/123456789" });
    expect(result.groups.get("country=India")).toEqual({ users: 500, eventUsers: { add_to_cart: 40, shopify_theme_install: 9 } });
    expect(result.groups.get("country=Brazil")).toEqual({ users: 20, eventUsers: { add_to_cart: 3 } });
    expect(result.truncated).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("answers zero for an ungrouped range with no traffic, and flags thresholding + truncation", async () => {
    const { api } = fakeApi(() => ({ rows: [], rowCount: 0, metadata: { subjectToThresholding: true } }));
    const empty = await fetchUniqueUsers(api, base);
    expect(empty.groups.get("")).toEqual({ users: 0, eventUsers: {} });
    expect(empty.warnings[0]).toMatch(/thresholds/);

    const { api: big } = fakeApi(() => ({ rows: [{ dimensionValues: [v("x")], metricValues: [v("1")] }], rowCount: 9_999 }));
    expect((await fetchUniqueUsers(big, { ...base, groupDims: ["pagePath"] })).truncated).toBe(true);
  });
});

describe("getUniqueUsers", () => {
  it("returns null instead of throwing when GA4 fails, so callers fall back", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const api = { properties: { runReport: async () => Promise.reject(Object.assign(new Error("boom"), { status: 403 })) } } as unknown as DataApi;
    expect(await getUniqueUsers(base, { dataApiFor: async () => api, now: () => new Date(), noCache: true })).toBeNull();
    expect(errors.mock.calls[0].join(" ")).toMatch(/permission_denied/);
    errors.mockRestore();
  });
});

describe("uniqueFor", () => {
  const result = { groups: new Map([["country=India", { users: 5, eventUsers: {} }]]), truncated: false, warnings: [] };
  it("treats a group GA4 didn't return as zero users, unless the answer was truncated", () => {
    expect(uniqueFor(result, "country=India")!.users).toBe(5);
    expect(uniqueFor(result, "country=Peru")).toEqual({ users: 0, eventUsers: {} });
    expect(uniqueFor({ ...result, truncated: true }, "country=Peru")).toBeNull();
    expect(uniqueFor(null, "")).toBeNull();
  });
});

describe("cache helpers", () => {
  it("keys on range, grouping, filters and events, order-independently", () => {
    const a = cacheKeyFor({ ...base, filters: { country: "India", city: "Pune" }, events: ["b", "a"] });
    const b = cacheKeyFor({ ...base, filters: { city: "Pune", country: "India" }, events: ["a", "b"] });
    expect(a).toBe(b);
    expect(cacheKeyFor({ ...base, range: { start: "2026-09-01", end: "2026-09-29" } })).not.toBe(cacheKeyFor(base));
  });

  it("only treats ranges older than GA4's revision window as settled", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(isSettled({ start: "2026-09-01", end: "2026-09-21" }, "UTC", now)).toBe(true);
    expect(isSettled({ start: "2026-09-01", end: "2026-09-22" }, "UTC", now)).toBe(false);
  });
});
