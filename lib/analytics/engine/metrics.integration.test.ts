import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsRangeUsers } from "@/models/analytics-range-users";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { ALL_EVENTS, buildDimsKey, type AggregateBreakdown } from "../constants";
import { addDays } from "../sync/dates";
import type { DataApi, ReportRequest } from "../sync/ga4Client";
import { getBreakdown, getEventSummary, getJourney, getOverview, getThemeComparison, getTrends, type EngineDeps } from "./metrics";
import { MetricsRequestError, parseBreakdownQuery, parseMetricsQuery } from "./params";

// The analytics service over real MongoDB rows, with GA4 faked for the
// range-level unique users. Opt-in, like the other integration tests:
//   GA4_TEST_MONGODB_URI=mongodb://localhost:27017 npx vitest run lib/analytics
const uri = process.env.GA4_TEST_MONGODB_URI;

// 12:00 UTC on the 25th: still the 25th in both UTC and Kolkata (17:30).
const NOW = new Date("2026-09-25T12:00:00Z");
const ADORN_PROPERTY = "111111111";
const DYNAMIC_PROPERTY = "222222222";

type Metrics = { eventCount?: number; totalUsers?: number; sessions?: number; newUsers?: number };

// Every day from Aug 1 to Sep 24, identical per day so expected sums are easy.
const DAYS: string[] = [];
for (let d = "2026-08-01"; d <= "2026-09-24"; d = addDays(d, 1)) DAYS.push(d);

function rowsFor(themeId: mongoose.Types.ObjectId, property: string, scale = 1) {
  const rows: Record<string, unknown>[] = [];
  const add = (date: string, breakdown: AggregateBreakdown, eventName: string, dims: Record<string, string>, m: Metrics) =>
    rows.push({
      analyticsThemeId: themeId,
      ga4PropertyId: property,
      date,
      breakdown,
      eventName,
      dims,
      dimsKey: buildDimsKey(breakdown, dims),
      metrics: { eventCount: (m.eventCount ?? 0) * scale, totalUsers: (m.totalUsers ?? 0) * scale, sessions: (m.sessions ?? 0) * scale, newUsers: (m.newUsers ?? 0) * scale },
    });
  for (const date of DAYS) {
    add(date, "total", ALL_EVENTS, {}, { totalUsers: 100, sessions: 120, newUsers: 50, eventCount: 1000 });
    add(date, "total", "view_item", {}, { totalUsers: 40, eventCount: 50 });
    add(date, "total", "add_to_cart", {}, { totalUsers: 10, eventCount: 12 });
    add(date, "total", "shopify_theme_install", {}, { totalUsers: 2, eventCount: 2 });
    add(date, "total", "scroll", {}, { totalUsers: 30, eventCount: 90 });
    add(date, "total", "session_start", {}, { totalUsers: 95, eventCount: 120 });
    add(date, "total", "page_view", {}, { totalUsers: 90, eventCount: 400 });
    add(date, "country", ALL_EVENTS, { country: "India" }, { totalUsers: 60, sessions: 70 });
    add(date, "country", "shopify_theme_install", { country: "India" }, { totalUsers: 2, eventCount: 2 });
    add(date, "country", ALL_EVENTS, { country: "Brazil" }, { totalUsers: 40, sessions: 50 });
    add(date, "acquisition", ALL_EVENTS, { sessionSource: "google", sessionMedium: "organic", sessionCampaignName: "(organic)" }, { totalUsers: 30 });
    add(date, "acquisition", ALL_EVENTS, { sessionSource: "google", sessionMedium: "cpc", sessionCampaignName: "launch" }, { totalUsers: 20 });
    add(date, "acquisition", "add_to_cart", { sessionSource: "google", sessionMedium: "cpc", sessionCampaignName: "launch" }, { totalUsers: 5, eventCount: 6 });
  }
  return rows;
}

// Fake GA4 for unique users: 500 users per range (per group: India 300, Brazil 200).
function fakeGa4() {
  const calls: ReportRequest[] = [];
  const runReport = vi.fn(async ({ requestBody }: { requestBody: ReportRequest }) => {
    calls.push(requestBody);
    const names = requestBody.dimensions!.map((d) => d.name);
    const byEvent = names[0] === "eventName";
    const grouped = names.includes("country");
    const groups = grouped ? [["India", 300], ["Brazil", 200]] : [[null, 500]];
    const rows = groups.flatMap(([country, users]) => {
      const dims = country ? [{ value: country as string }] : [];
      if (!byEvent) return [{ dimensionValues: dims, metricValues: [{ value: String(users) }] }];
      return [
        { dimensionValues: [{ value: "view_item" }, ...dims], metricValues: [{ value: "150" }] },
        { dimensionValues: [{ value: "add_to_cart" }, ...dims], metricValues: [{ value: "40" }] },
        { dimensionValues: [{ value: "shopify_theme_install" }, ...dims], metricValues: [{ value: "10" }] },
      ];
    });
    return { data: { rows, rowCount: rows.length } };
  });
  return { api: { properties: { runReport } } as unknown as DataApi, runReport, calls };
}

describe.skipIf(!uri)("GA4 analytics engine (MongoDB)", () => {
  let adornId: string;
  let accountB: mongoose.Types.ObjectId;
  const noUnique: EngineDeps = { dataApiFor: async () => Promise.reject(new Error("unused")), now: () => NOW, uniqueUsers: false };
  const q = (s: string) => parseMetricsQuery(new URLSearchParams(s));

  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: "ga4_test_engine" });
    await Promise.all([AnalyticsAggregate.syncIndexes(), AnalyticsTheme.syncIndexes(), GoogleConnection.syncIndexes(), AnalyticsRangeUsers.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([AnalyticsAggregate.deleteMany({}), AnalyticsTheme.deleteMany({}), GoogleConnection.deleteMany({}), AnalyticsRangeUsers.deleteMany({})]);
    const a = await GoogleConnection.create({ googleAccountId: "sub-A", email: "a@example.com", status: "active" });
    const b = await GoogleConnection.create({ googleAccountId: "sub-B", email: "b@example.com", status: "active" });
    accountB = b._id;
    const [adorn, dynamic, , gravity] = await AnalyticsTheme.create([
      { name: "Adorn", slug: "adorn", googleConnectionId: a._id, ga4PropertyId: ADORN_PROPERTY, ga4PropertyTimeZone: "UTC", connectionStatus: "connected", syncedThroughDate: "2026-09-24" },
      { name: "Dynamic", slug: "dynamic", googleConnectionId: b._id, ga4PropertyId: DYNAMIC_PROPERTY, ga4PropertyTimeZone: "Asia/Kolkata", connectionStatus: "connected", syncedThroughDate: "2026-09-24" },
      { name: "Flaunt", slug: "flaunt" },
      { name: "Gravity", slug: "gravity", googleConnectionId: a._id, ga4PropertyId: "333333333", ga4PropertyTimeZone: "UTC", connectionStatus: "connected", isActive: false },
    ]);
    adornId = adorn._id.toString();
    await AnalyticsAggregate.insertMany([
      ...rowsFor(adorn._id, ADORN_PROPERTY),
      ...rowsFor(dynamic._id, DYNAMIC_PROPERTY),
      ...rowsFor(gravity._id, "333333333"),
      // Left over from a property Adorn used to be mapped to: must never count.
      ...rowsFor(adorn._id, "999999999", 1000).map((r) => ({ ...r, dimsKey: `${r.dimsKey as string}#old` })),
    ]);
  });

  it("computes one theme's KPIs and rates from the daily rows, against the previous period", async () => {
    const res = await getOverview(q("theme=adorn&range=last7"), noUnique);
    expect(res.meta).toMatchObject({ scope: "theme", theme: { slug: "adorn" }, breakdown: "total", usersBasis: "daily_sum", usersScope: "theme" });
    expect(res.meta.range).toMatchObject({ current: { start: "2026-09-18", end: "2026-09-24" }, previous: { start: "2026-09-11", end: "2026-09-17" } });
    expect(res.current).toMatchObject({ users: 700, sessions: 840, newUsers: 350, themeViews: { count: 350, users: 280 }, tryTheme: { count: 84, users: 70 }, installs: { count: 14, users: 14 } });
    expect(res.current.rates.installRate).toBe(2); // 14 / 700
    expect(res.current.rates.tryThemeToInstall).toBe(20); // 14 / 70
    expect(res.comparison!.installs.count).toEqual({ current: 14, previous: 14, change: 0, changePercent: 0 });
    expect(res.meta.warnings.join(" ")).toMatch(/daily unique users added up/);
    expect(res.meta.notes.join(" ")).toMatch(/not step-by-step journeys/);
  });

  it("accepts a theme id as well as a slug", async () => {
    expect((await getOverview(q(`theme=${adornId}&range=yesterday`), noUnique)).current.users).toBe(100);
  });

  it("uses GA4's range-level unique users when available, and caches them", async () => {
    const ga4 = fakeGa4();
    const deps: EngineDeps = { dataApiFor: async () => ga4.api, now: () => NOW };
    const res = await getOverview(q("theme=adorn&range=last30"), deps);
    expect(res.meta.usersBasis).toBe("unique");
    expect(res.current.users).toBe(500);
    expect(res.current.installs).toEqual({ count: 60, users: 10 }); // count from Mongo, users from GA4
    expect(res.current.rates.installRate).toBe(2); // 10 / 500
    expect(ga4.calls.map((c) => c.dateRanges![0])).toContainEqual({ startDate: "2026-08-26", endDate: "2026-09-24" });
    expect(ga4.runReport).toHaveBeenCalledTimes(4); // totals + events, for current and previous

    await getOverview(q("theme=adorn&range=last30"), deps);
    expect(ga4.runReport).toHaveBeenCalledTimes(4); // served from AnalyticsRangeUsers
    expect(await AnalyticsRangeUsers.countDocuments()).toBe(2);
  });

  it("adds themes together for All Themes, skipping inactive and unmapped ones and old-property rows", async () => {
    const res = await getOverview(q("range=yesterday&compare=none"), noUnique);
    expect(res.meta.scope).toBe("all");
    expect(res.meta.usersScope).toBe("sum_of_themes");
    expect(res.meta.themes.map((t) => t.name)).toEqual(["Adorn", "Dynamic"]);
    expect(res.meta.mixedTimeZones).toBe(true);
    expect(res.current.users).toBe(200);
    expect(res.previous).toBeNull();
    expect(res.comparison).toBeNull();
    expect(res.meta.notes.join(" ")).toMatch(/sum of each theme's users/);
  });

  it("falls back per theme when an account can't be asked for unique users", async () => {
    await GoogleConnection.updateOne({ _id: accountB }, { status: "revoked" });
    const ga4 = fakeGa4();
    const res = await getThemeComparison(q("range=last7"), { dataApiFor: async () => ga4.api, now: () => NOW });
    const byName = Object.fromEntries(res.themes.map((r) => [r.theme.name, r]));
    expect(byName.Adorn.current).toMatchObject({ users: 500, usersBasis: "unique" });
    expect(byName.Dynamic.current).toMatchObject({ users: 700, usersBasis: "daily_sum" });
    expect(res.total.current.users).toBe(1200);
    expect(res.meta.usersBasis).toBe("daily_sum");
    expect(res.meta.warnings.join(" ")).toMatch(/Users for Dynamic are daily unique users/);
  });

  it("filters within a dimension family", async () => {
    const res = await getOverview(q("theme=adorn&range=last7&country=India"), noUnique);
    expect(res.meta.breakdown).toBe("country");
    expect(res.current.users).toBe(420);
    expect(res.current.installs.users).toBe(14);
  });

  it("passes the filter on to GA4's unique-user query", async () => {
    const ga4 = fakeGa4();
    await getOverview(q("theme=adorn&range=last7&compare=none&country=India"), { dataApiFor: async () => ga4.api, now: () => NOW });
    expect(ga4.calls[0].dimensionFilter).toEqual({ filter: { fieldName: "country", stringFilter: { matchType: "EXACT", value: "India" } } });
  });

  it("rejects filters that span dimension families, unknown themes, and bad ranges", async () => {
    await expect(getOverview(q("country=India&device=mobile"), noUnique)).rejects.toMatchObject({ status: 400 });
    await expect(getOverview(q("theme=nope"), noUnique)).rejects.toMatchObject({ status: 404 });
    await expect(getOverview(q("range=custom&start=2026-09-10&end=2026-09-01"), noUnique)).rejects.toBeInstanceOf(MetricsRequestError);
  });

  it("returns zeros with a warning for an unmapped theme", async () => {
    const res = await getOverview(q("theme=flaunt"), noUnique);
    expect(res.current.users).toBe(0);
    expect(res.meta.themes).toEqual([]);
    expect(res.meta.warnings).toContain("Flaunt isn't mapped to a GA4 property yet.");
  });

  it("breaks KPIs down by a dimension, sorted and paginated", async () => {
    const res = await getBreakdown(parseBreakdownQuery(new URLSearchParams("theme=adorn&range=last7&dimension=country&limit=1")), noUnique);
    expect(res.totalRows).toBe(2);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ key: "country=India", values: { country: "India" }, current: { users: 420, installs: { users: 14 } } });

    const page2 = await getBreakdown(parseBreakdownQuery(new URLSearchParams("theme=adorn&range=last7&dimension=country&limit=1&offset=1")), noUnique);
    expect(page2.rows[0]).toMatchObject({ key: "country=Brazil", current: { users: 280, installs: { users: 0 } } });
    expect(page2.rows[0].current.rates.installRate).toBe(0);
  });

  it("uses per-group unique users in breakdowns", async () => {
    const ga4 = fakeGa4();
    const res = await getBreakdown(parseBreakdownQuery(new URLSearchParams("range=last7&dimension=country&compare=none")), { dataApiFor: async () => ga4.api, now: () => NOW });
    expect(res.meta.usersBasis).toBe("unique");
    expect(res.rows.map((r) => [r.key, r.current.users])).toEqual([
      ["country=India", 600], // 300 per theme, summed across the two themes
      ["country=Brazil", 400],
    ]);
  });

  it("warns when a breakdown's fallback users add up several rows per day", async () => {
    const res = await getBreakdown(parseBreakdownQuery(new URLSearchParams("theme=adorn&range=last7&dimension=source")), noUnique);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ key: "sessionSource=google", current: { users: 350, tryTheme: { count: 42, users: 35 } } });
    expect(res.meta.breakdown).toBe("acquisition");
    expect(res.meta.warnings.join(" ")).toMatch(/several stored rows per day/);
  });

  it("returns aligned daily trends for the current and previous periods", async () => {
    const res = await getTrends(q("range=last7"), noUnique);
    expect(res.dates).toEqual(["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]);
    expect(res.previousDates![0]).toBe("2026-09-11");
    expect(res.current).toHaveLength(7);
    expect(res.current[0]).toEqual({ users: 200, sessions: 240, themeViews: { count: 100, users: 80 }, tryTheme: { count: 24, users: 20 }, installs: { count: 4, users: 4 } });
    expect(res.previous![6].users).toBe(200);
  });

  it("zero-fills trend days with no data", async () => {
    const res = await getTrends(q("theme=adorn&range=thisWeek&compare=none"), noUnique);
    expect(res.dates.at(-1)).toBe("2026-09-25"); // today: not synced yet
    expect(res.current.at(-1)!.users).toBe(0);
    expect(res.previous).toBeNull();
  });

  it("summarises every tracked event, primary events first", async () => {
    const res = await getEventSummary(q("theme=adorn&range=last7"), noUnique);
    expect(res.events.slice(0, 3).map((e) => [e.eventName, e.role])).toEqual([
      ["shopify_theme_install", "primary"],
      ["add_to_cart", "primary"],
      ["view_item", "funnel"],
    ]);
    expect(res.events).toHaveLength(12);
    expect(res.events.find((e) => e.eventName === "page_view")!.count.current).toBe(2800);
    expect(res.events.find((e) => e.eventName === "scroll")).toMatchObject({ role: "supporting", count: { current: 630, previous: 630, change: 0 } });
    expect(res.events.find((e) => e.eventName === "click")!.count.current).toBe(0);
  });

  it("returns the journey as aggregate steps with ratios and the previous period", async () => {
    const res = await getJourney(q("theme=adorn&range=last7"), noUnique);
    expect(res.steps.map((s) => [s.eventName, s.users])).toEqual([
      ["session_start", 665],
      ["page_view", 630],
      ["view_item", 280],
      ["add_to_cart", 70],
      ["shopify_theme_install", 14],
    ]);
    expect(res.steps[4].ofPrevious).toBe(20); // 14 / 70
    expect(res.steps[1].comparison!.users).toMatchObject({ current: 630, previous: 630, change: 0 });
    expect(res.meta.notes[0]).toMatch(/isn't a sequence/);
  });

  it("doesn't ask GA4 about filter values that have no stored rows", async () => {
    const ga4 = fakeGa4();
    const res = await getOverview(q("theme=adorn&range=last7&page=/does-not-exist"), { dataApiFor: async () => ga4.api, now: () => NOW });
    expect(ga4.runReport).not.toHaveBeenCalled();
    expect(res.current.users).toBe(0);
  });
});
