import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { buildDimsKey, type AggregateBreakdown } from "../constants";
import { addDays } from "../sync/dates";
import { getBreakdown, getOverview, getThemeComparison, getTrends, type EngineDeps } from "./metrics";
import { MetricsRequestError, parseBreakdownQuery, parseMetricsQuery } from "./params";

// The analytics service over real MongoDB rows. Opt-in, like the other
// integration tests:
//   GA4_TEST_MONGODB_URI=mongodb://localhost:27017 npx vitest run lib/analytics
const uri = process.env.GA4_TEST_MONGODB_URI;

// 12:00 UTC on the 25th: still the 25th in both UTC and Kolkata (17:30).
const NOW = new Date("2026-09-25T12:00:00Z");
const ADORN_PROPERTY = "111111111";
const DYNAMIC_PROPERTY = "222222222";

// Every day from Aug 1 to Sep 24, identical per day so expected sums are easy.
const DAYS: string[] = [];
for (let d = "2026-08-01"; d <= "2026-09-24"; d = addDays(d, 1)) DAYS.push(d);

function rowsFor(themeId: mongoose.Types.ObjectId, property: string, scale = 1) {
  const rows: Record<string, unknown>[] = [];
  const add = (date: string, breakdown: AggregateBreakdown, eventName: string, dims: Record<string, string>, eventCount: number) =>
    rows.push({ analyticsThemeId: themeId, ga4PropertyId: property, date, breakdown, eventName, dims, dimsKey: buildDimsKey(breakdown, dims), metrics: { eventCount: eventCount * scale } });
  for (const date of DAYS) {
    add(date, "total", "add_to_cart", {}, 12);
    add(date, "total", "shopify_theme_install", {}, 2);
    add(date, "country", "add_to_cart", { country: "India" }, 8);
    add(date, "country", "shopify_theme_install", { country: "India" }, 2);
    add(date, "country", "add_to_cart", { country: "Brazil" }, 4);
    add(date, "acquisition", "add_to_cart", { sessionSource: "google", sessionMedium: "organic", sessionCampaignName: "(organic)" }, 7);
    add(date, "acquisition", "add_to_cart", { sessionSource: "google", sessionMedium: "cpc", sessionCampaignName: "launch" }, 5);
    add(date, "acquisition", "shopify_theme_install", { sessionSource: "google", sessionMedium: "cpc", sessionCampaignName: "launch" }, 1);
  }
  return rows;
}

describe.skipIf(!uri)("GA4 analytics engine (MongoDB)", () => {
  let adornId: string;
  const deps: EngineDeps = { now: () => NOW };
  const q = (s: string) => parseMetricsQuery(new URLSearchParams(s));
  const bq = (s: string) => parseBreakdownQuery(new URLSearchParams(s));

  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: "ga4_test_engine" });
    await Promise.all([AnalyticsAggregate.syncIndexes(), AnalyticsTheme.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([AnalyticsAggregate.deleteMany({}), AnalyticsTheme.deleteMany({})]);
    const [adorn, dynamic, , gravity] = await AnalyticsTheme.create([
      { name: "Adorn", slug: "adorn", ga4PropertyId: ADORN_PROPERTY, ga4PropertyTimeZone: "UTC", connectionStatus: "connected", syncedThroughDate: "2026-09-24" },
      { name: "Dynamic", slug: "dynamic", ga4PropertyId: DYNAMIC_PROPERTY, ga4PropertyTimeZone: "Asia/Kolkata", connectionStatus: "connected", syncedThroughDate: "2026-09-24" },
      { name: "Flaunt", slug: "flaunt" },
      { name: "Gravity", slug: "gravity", ga4PropertyId: "333333333", ga4PropertyTimeZone: "UTC", connectionStatus: "connected", isActive: false },
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

  it("computes one theme's Try Theme, installs and install rate, against the previous period", async () => {
    const res = await getOverview(q("theme=adorn&range=last7"), deps);
    expect(res.meta).toMatchObject({ scope: "theme", theme: { slug: "adorn" }, breakdown: "total" });
    expect(res.meta.range).toMatchObject({ current: { start: "2026-09-18", end: "2026-09-24" }, previous: { start: "2026-09-11", end: "2026-09-17" } });
    expect(res.current).toEqual({ tryTheme: 84, installs: 14, installRate: (14 / 84) * 100 });
    expect(res.comparison!.installs).toEqual({ current: 14, previous: 14, change: 0, changePercent: 0 });
    expect(res.meta.notes.join(" ")).toMatch(/installs ÷ Try Theme clicks/);
  });

  it("accepts a theme id as well as a slug", async () => {
    expect((await getOverview(q(`theme=${adornId}&range=yesterday`), deps)).current.tryTheme).toBe(12);
  });

  it("adds themes together for All Themes, skipping inactive and unmapped ones and old-property rows", async () => {
    const res = await getOverview(q("range=yesterday&compare=none"), deps);
    expect(res.meta.scope).toBe("all");
    expect(res.meta.themes.map((t) => t.name)).toEqual(["Adorn", "Dynamic"]);
    expect(res.meta.mixedTimeZones).toBe(true);
    expect(res.current).toMatchObject({ tryTheme: 24, installs: 4 });
    expect(res.previous).toBeNull();
    expect(res.comparison).toBeNull();
  });

  it("returns one row per theme plus the total", async () => {
    const res = await getThemeComparison(q("range=last7"), deps);
    expect(res.themes.map((r) => [r.theme.name, r.current.tryTheme, r.current.installs])).toEqual([
      ["Adorn", 84, 14],
      ["Dynamic", 84, 14],
    ]);
    expect(res.total.current).toMatchObject({ tryTheme: 168, installs: 28 });
  });

  it("filters within a dimension family", async () => {
    const res = await getOverview(q("theme=adorn&range=last7&country=India"), deps);
    expect(res.meta.breakdown).toBe("country");
    expect(res.current).toMatchObject({ tryTheme: 56, installs: 14, installRate: 25 });
  });

  it("rejects filters that span dimension families, unknown themes, and bad ranges", async () => {
    await expect(getOverview(q("country=India&device=mobile"), deps)).rejects.toMatchObject({ status: 400 });
    await expect(getOverview(q("theme=nope"), deps)).rejects.toMatchObject({ status: 404 });
    await expect(getOverview(q("range=custom&start=2026-09-10&end=2026-09-01"), deps)).rejects.toBeInstanceOf(MetricsRequestError);
  });

  it("returns zeros with a warning for an unmapped theme", async () => {
    const res = await getOverview(q("theme=flaunt"), deps);
    expect(res.current).toEqual({ tryTheme: 0, installs: 0, installRate: null });
    expect(res.meta.themes).toEqual([]);
    expect(res.meta.warnings).toContain("Flaunt isn't mapped to a GA4 property yet.");
  });

  it("reads a theme's earlier history from its earlier property up to the cut-off, and its own property after", async () => {
    const flaunt = await AnalyticsTheme.create({
      name: "Flaunt2",
      slug: "flaunt2",
      ga4PropertyId: "555555555",
      ga4PropertyTimeZone: "UTC",
      connectionStatus: "connected",
      syncedThroughDate: "2026-09-24",
      earlierPropertyId: ADORN_PROPERTY,
      earlierPagePathPrefix: "/themes/flaunt/",
      earlierUntil: "2026-09-20",
    });
    const row = (property: string, date: string, eventCount: number) => ({
      analyticsThemeId: flaunt._id,
      ga4PropertyId: property,
      date,
      breakdown: "total",
      eventName: "add_to_cart",
      dims: {},
      dimsKey: `${property}`, // distinct per property so both can exist for one date
      metrics: { eventCount },
    });
    await AnalyticsAggregate.insertMany([
      row(ADORN_PROPERTY, "2026-09-19", 5), // earlier source, before the cut-off: counts
      row(ADORN_PROPERTY, "2026-09-22", 100), // earlier source after the cut-off: ignored
      row("555555555", "2026-09-18", 100), // own property before the cut-off: ignored
      row("555555555", "2026-09-23", 7), // own property after the cut-off: counts
    ]);
    const res = await getOverview(q("theme=flaunt2&range=last7&compare=none"), deps);
    expect(res.current.tryTheme).toBe(12);
    expect(res.meta.themes[0].installsEstimated).toBe(true);
  });

  it("breaks KPIs down by a dimension, sorted by installs and paginated", async () => {
    const res = await getBreakdown(bq("theme=adorn&range=last7&dimension=country&limit=1"), deps);
    expect(res.sort).toBe("installs");
    expect(res.totalRows).toBe(2);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ key: "country=India", values: { country: "India" }, current: { tryTheme: 56, installs: 14 } });

    const page2 = await getBreakdown(bq("theme=adorn&range=last7&dimension=country&limit=1&offset=1"), deps);
    expect(page2.rows[0]).toMatchObject({ key: "country=Brazil", current: { tryTheme: 28, installs: 0, installRate: 0 } });
  });

  it("sums a family's rows for a dimension within it", async () => {
    const res = await getBreakdown(bq("theme=adorn&range=last7&dimension=source&sort=tryTheme"), deps);
    expect(res.meta.breakdown).toBe("acquisition");
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ key: "sessionSource=google", current: { tryTheme: 84, installs: 7 } });
  });

  it("returns aligned daily trends for the current and previous periods", async () => {
    const res = await getTrends(q("range=last7"), deps);
    expect(res.dates).toEqual(["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]);
    expect(res.previousDates![0]).toBe("2026-09-11");
    expect(res.current).toHaveLength(7);
    expect(res.current[0]).toEqual({ tryTheme: 24, installs: 4 });
    expect(res.previous![6]).toEqual({ tryTheme: 24, installs: 4 });
  });

  it("zero-fills trend days with no data", async () => {
    const res = await getTrends(q("theme=adorn&range=thisWeek&compare=none"), deps);
    expect(res.dates.at(-1)).toBe("2026-09-25"); // today: not synced yet
    expect(res.current.at(-1)).toEqual({ tryTheme: 0, installs: 0 });
    expect(res.previous).toBeNull();
  });
});
