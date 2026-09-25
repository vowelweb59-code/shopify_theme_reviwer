import { describe, expect, it, vi } from "vitest";
import { ALL_EVENTS, AGGREGATE_BREAKDOWNS, PRIMARY_EVENTS } from "../constants";
import { classifyDataApiError, runFullReport, type DataApi } from "./ga4Client";
import { buildReportSpecs, toAggregateRows } from "./reports";

const httpError = (status: number, message = "") => Object.assign(new Error(message), { status });
const noSleep = async () => {};

describe("buildReportSpecs", () => {
  const specs = buildReportSpecs({ start: "2026-09-01", end: "2026-09-30" });

  it("runs an events and a totals report for every breakdown", () => {
    expect(specs).toHaveLength(Object.keys(AGGREGATE_BREAKDOWNS).length * 2);
  });

  it("stays within GA4's 9-dimension limit", () => {
    for (const spec of specs) expect(spec.request.dimensions!.length).toBeLessThanOrEqual(9);
  });

  it("filters the events report to the tracked events, primary ones included", () => {
    const events = specs.find((s) => s.breakdown === "acquisition" && s.kind === "events")!;
    expect(events.request.dimensions!.map((d) => d.name)).toEqual(["date", "eventName", "sessionSource", "sessionMedium", "sessionCampaignName"]);
    const values = events.request.dimensionFilter!.filter!.inListFilter!.values!;
    expect(values).toEqual(expect.arrayContaining([PRIMARY_EVENTS.themeInstall, PRIMARY_EVENTS.tryTheme, "view_item"]));
    expect(events.request.dateRanges).toEqual([{ startDate: "2026-09-01", endDate: "2026-09-30" }]);
  });

  it("asks the totals report for the property-wide user and session metrics", () => {
    const totals = specs.find((s) => s.breakdown === "total" && s.kind === "totals")!;
    expect(totals.request.dimensions!.map((d) => d.name)).toEqual(["date"]);
    expect(totals.request.metrics!.map((m) => m.name)).toEqual(["totalUsers", "activeUsers", "newUsers", "sessions", "eventCount"]);
    expect(totals.request.dimensionFilter).toBeUndefined();
  });
});

describe("toAggregateRows", () => {
  it("maps an events row, keyed for idempotent upserts", () => {
    const [row] = toAggregateRows({ breakdown: "city", kind: "events" }, [{ dimensions: ["20260923", "add_to_cart", "India", "Pune"], metrics: [14, 9] }]);
    expect(row).toEqual({
      date: "2026-09-23",
      breakdown: "city",
      eventName: "add_to_cart",
      dims: { country: "India", city: "Pune" },
      dimsKey: "country=India|city=Pune",
      metrics: { eventCount: 14, totalUsers: 9, activeUsers: 0, newUsers: 0, sessions: 0 },
    });
  });

  it("stores totals rows under ALL_EVENTS", () => {
    const [row] = toAggregateRows({ breakdown: "total", kind: "totals" }, [{ dimensions: ["20260923"], metrics: [120, 110, 80, 150, 2400] }]);
    expect(row).toMatchObject({ eventName: ALL_EVENTS, dimsKey: "", metrics: { totalUsers: 120, activeUsers: 110, newUsers: 80, sessions: 150, eventCount: 2400 } });
  });
});

describe("runFullReport", () => {
  function fakeApi(pages: { rows: unknown[]; rowCount: number; metadata?: unknown }[], failFirst: Error[] = []) {
    const runReport = vi.fn(async () => {
      if (failFirst.length) throw failFirst.shift();
      return { data: pages.shift() };
    });
    return { api: { properties: { runReport } } as unknown as DataApi, runReport };
  }
  const row = (d: string, n: string) => ({ dimensionValues: [{ value: d }], metricValues: [{ value: n }] });

  it("follows pagination and parses metric values", async () => {
    const { api, runReport } = fakeApi([
      { rows: [row("20260901", "5")], rowCount: 150_000 },
      { rows: [row("20260902", "7")], rowCount: 150_000, metadata: { subjectToThresholding: true } },
    ]);
    const result = await runFullReport(api, "123456789", { metrics: [{ name: "eventCount" }] }, { sleep: noSleep });
    expect(result.rows).toEqual([
      { dimensions: ["20260901"], metrics: [5] },
      { dimensions: ["20260902"], metrics: [7] },
    ]);
    expect(result.subjectToThresholding).toBe(true);
    expect(runReport).toHaveBeenCalledTimes(2);
    expect(runReport.mock.calls[1]).toEqual([expect.objectContaining({ property: "properties/123456789", requestBody: expect.objectContaining({ offset: "100000" }) })]);
  });

  it("retries a momentary failure, then succeeds", async () => {
    const { api, runReport } = fakeApi([{ rows: [], rowCount: 0 }], [httpError(503)]);
    await expect(runFullReport(api, "123456789", {}, { sleep: noSleep })).resolves.toMatchObject({ rows: [] });
    expect(runReport).toHaveBeenCalledTimes(2);
  });

  it("does not retry quota exhaustion or permission errors in-request", async () => {
    const quota = fakeApi([], [httpError(429, "Exhausted property tokens per hour.")]);
    await expect(runFullReport(quota.api, "1", {}, { sleep: noSleep })).rejects.toMatchObject({ code: "quota_hourly" });
    expect(quota.runReport).toHaveBeenCalledTimes(1);

    const denied = fakeApi([], [httpError(403, "PERMISSION_DENIED")]);
    await expect(runFullReport(denied.api, "1", {}, { sleep: noSleep })).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("gives up after three momentary failures", async () => {
    const { api, runReport } = fakeApi([], [httpError(500), httpError(502), httpError(503)]);
    await expect(runFullReport(api, "1", {}, { sleep: noSleep })).rejects.toMatchObject({ code: "unavailable" });
    expect(runReport).toHaveBeenCalledTimes(3);
  });
});

describe("classifyDataApiError", () => {
  it("tells hourly and daily quota apart", () => {
    expect(classifyDataApiError(httpError(429, "Exhausted property tokens per day.")).code).toBe("quota_daily");
    expect(classifyDataApiError(httpError(429, "Exhausted property tokens per hour.")).code).toBe("quota_hourly");
    expect(classifyDataApiError(httpError(429, "Exhausted concurrent requests quota.")).code).toBe("rate_limited");
  });

  it("marks only quota and outages as retryable", () => {
    expect(classifyDataApiError(httpError(429, "per day")).retryable).toBe(true);
    expect(classifyDataApiError(new Error("ECONNRESET")).retryable).toBe(true);
    expect(classifyDataApiError(httpError(403, "Google Analytics Data API has not been used in project 1")).code).toBe("api_disabled");
    expect(classifyDataApiError(httpError(400, "incompatible")).retryable).toBe(false);
    expect(classifyDataApiError(Object.assign(new Error(), { response: { data: { error: "invalid_grant" } } })).code).toBe("auth_revoked");
  });
});
