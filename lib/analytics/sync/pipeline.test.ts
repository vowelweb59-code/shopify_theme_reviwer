import { describe, expect, it, vi } from "vitest";
import { AGGREGATE_BREAKDOWNS, PRIMARY_EVENTS } from "../constants";
import { classifyDataApiError, runFullReport, type DataApi } from "./ga4Client";
import { buildReportSpecs, estimateInstallRows, toAggregateRows, type AggregateRow } from "./reports";

const httpError = (status: number, message = "") => Object.assign(new Error(message), { status });
const noSleep = async () => {};

describe("buildReportSpecs", () => {
  const specs = buildReportSpecs({ start: "2026-09-01", end: "2026-09-30" });

  it("runs one report per breakdown", () => {
    expect(specs).toHaveLength(Object.keys(AGGREGATE_BREAKDOWNS).length);
  });

  it("stays within GA4's 9-dimension limit", () => {
    for (const spec of specs) expect(spec.request.dimensions!.length).toBeLessThanOrEqual(9);
  });

  it("asks only for Try Theme and install event counts", () => {
    const events = specs.find((s) => s.breakdown === "landingPage")!;
    expect(events.request.dimensions!.map((d) => d.name)).toEqual(["date", "eventName", "landingPage"]);
    expect(events.request.dimensionFilter!.filter!.inListFilter!.values!.sort()).toEqual([PRIMARY_EVENTS.tryTheme, PRIMARY_EVENTS.themeInstall].sort());
    expect(events.request.metrics).toEqual([{ name: "eventCount" }]);
    expect(events.request.dateRanges).toEqual([{ startDate: "2026-09-01", endDate: "2026-09-30" }]);
  });
});

describe("buildReportSpecs with a page filter", () => {
  const specs = buildReportSpecs({ start: "2026-09-01", end: "2026-09-30" }, "/themes/adorn/");
  const pageFilter = { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/themes/adorn/", caseSensitive: false } } };

  it("filters every report to the theme's pages, case-insensitively", () => {
    for (const spec of specs) {
      expect(spec.request.dimensionFilter!.andGroup!.expressions).toEqual([expect.objectContaining({ filter: expect.objectContaining({ fieldName: "eventName" }) }), pageFilter]);
    }
  });
});

describe("estimateInstallRows", () => {
  const themeRow = (date: string, eventName: string, eventCount: number): AggregateRow => ({
    date,
    breakdown: "total",
    eventName,
    dims: {},
    dimsKey: "",
    metrics: { eventCount },
  });
  const propertyRow = (date: string, eventName: string, eventCount: number) => ({ dimensions: [date.replaceAll("-", ""), eventName], metrics: [eventCount] });

  it("splits each day's installs by that day's Try Theme share", () => {
    const rows = estimateInstallRows(
      [themeRow("2026-09-01", "add_to_cart", 30), themeRow("2026-09-02", "add_to_cart", 5)],
      [propertyRow("2026-09-01", "add_to_cart", 40), propertyRow("2026-09-01", PRIMARY_EVENTS.themeInstall, 4), propertyRow("2026-09-02", "add_to_cart", 5), propertyRow("2026-09-02", PRIMARY_EVENTS.themeInstall, 2)]
    );
    expect(rows.map((r) => [r.date, r.metrics.eventCount])).toEqual([
      ["2026-09-01", 3],
      ["2026-09-02", 2],
    ]);
    expect(rows[0]).toMatchObject({ breakdown: "total", eventName: PRIMARY_EVENTS.themeInstall, dimsKey: "" });
  });

  it("gives the theme nothing on a day only the other theme had Try Theme clicks", () => {
    const rows = estimateInstallRows([themeRow("2026-09-02", "add_to_cart", 10)], [propertyRow("2026-09-01", "add_to_cart", 8), propertyRow("2026-09-01", PRIMARY_EVENTS.themeInstall, 1), propertyRow("2026-09-02", "add_to_cart", 10)]);
    expect(rows).toEqual([]);
  });

  it("falls back to the chunk's Try Theme share on a day with no Try Theme clicks at all", () => {
    const rows = estimateInstallRows(
      [themeRow("2026-09-01", "add_to_cart", 1)],
      [propertyRow("2026-09-01", "add_to_cart", 4), propertyRow("2026-09-03", PRIMARY_EVENTS.themeInstall, 8)]
    );
    expect(rows.map((r) => [r.date, r.metrics.eventCount])).toEqual([["2026-09-03", 2]]);
  });

  it("estimates no installs when nobody clicked Try Theme in the chunk", () => {
    expect(estimateInstallRows([], [propertyRow("2026-09-01", PRIMARY_EVENTS.themeInstall, 10)])).toEqual([]);
  });
});

describe("toAggregateRows", () => {
  it("maps a row, keyed for idempotent upserts", () => {
    const [row] = toAggregateRows({ breakdown: "page" }, [{ dimensions: ["20260923", "add_to_cart", "/themes/adorn"], metrics: [14] }]);
    expect(row).toEqual({
      date: "2026-09-23",
      breakdown: "page",
      eventName: "add_to_cart",
      dims: { pagePath: "/themes/adorn" },
      dimsKey: "pagePath=/themes/adorn",
      metrics: { eventCount: 14 },
    });
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
