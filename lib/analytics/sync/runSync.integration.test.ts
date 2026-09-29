import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsSync } from "@/models/analytics-sync";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { AGGREGATE_BREAKDOWNS } from "../constants";
import type { AdminApi } from "../properties";
import { addDays } from "./dates";
import type { DataApi, ReportRequest } from "./ga4Client";
import { CHUNK_DAYS, drainSyncQueue, executeSync, recoverInterruptedSyncs, startSync, type SyncDeps } from "./runSync";
import { runSchedulerTick } from "./scheduler";

// The whole GA4 → MongoDB pipeline against a fake GA4 and a real MongoDB.
// Opt-in, like the other integration tests:
//   GA4_TEST_MONGODB_URI=mongodb://localhost:27017 npx vitest run lib/analytics
const uri = process.env.GA4_TEST_MONGODB_URI;

const NOW = new Date("2026-09-24T12:00:00Z"); // 17:30 in Kolkata: property-local "today" is 2026-09-24
const TODAY = "2026-09-24";
const PROPERTY = "123456789";
const CREATED = "2026-07-01T00:00:00Z"; // → 86 days of history = 3 chunks of 30 days
const BREAKDOWNS = Object.keys(AGGREGATE_BREAKDOWNS).length;

const httpError = (status: number, message = "") => Object.assign(new Error(message), { status });

// A tiny fake GA4 property: every day has add_to_cart + shopify_theme_install,
// with every dimension set to the value in `dims` (so tests can "revise" data).
type FakeGa4 = {
  dims: Record<string, string>;
  events: string[];
  installCount: number;
  calls: number;
  requests: { property: string; start: string; end: string; pageFiltered: boolean }[];
  failures: { atCall: number; error: Error; times: number }[];
  onCall?: (call: number) => Promise<void>;
};

function fakeGa4(): FakeGa4 {
  return { dims: { country: "India" }, events: ["add_to_cart", "shopify_theme_install"], installCount: 2, calls: 0, requests: [], failures: [] };
}

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

function makeDataApi(ga4: FakeGa4): DataApi {
  return {
    properties: {
      runReport: (async ({ property, requestBody }: { property: string; requestBody: ReportRequest }) => {
        ga4.calls++;
        const [r] = requestBody.dateRanges!;
        ga4.requests.push({ property, start: r.startDate!, end: r.endDate!, pageFiltered: JSON.stringify(requestBody.dimensionFilter ?? {}).includes("pagePath") });
        await ga4.onCall?.(ga4.calls);
        const failure = ga4.failures.find((f) => ga4.calls >= f.atCall && f.times > 0);
        if (failure) {
          failure.times--;
          throw failure.error;
        }
        const names = requestBody.dimensions!.map((d) => d.name!);
        const [range] = requestBody.dateRanges!;
        const rest = names.slice(2).map((n) => ga4.dims[n] ?? "X"); // after date, eventName
        const rows = datesBetween(range.startDate!, range.endDate!).flatMap((date) => {
          const d = date.replaceAll("-", "");
          return ga4.events.map((ev) => ({
            dimensionValues: [d, ev, ...rest].map((value) => ({ value })),
            metricValues: [{ value: String(ev === "shopify_theme_install" ? ga4.installCount : 10) }],
          }));
        });
        return { data: { rows, rowCount: rows.length } };
      }) as unknown as DataApi["properties"]["runReport"],
    },
  };
}

const fakeAdmin = {
  accountSummaries: { list: async () => ({ data: {} }) },
  properties: { get: async () => ({ data: { displayName: "Adorn", timeZone: "Asia/Kolkata", createTime: CREATED } }) },
} as unknown as AdminApi;

describe.skipIf(!uri)("GA4 sync pipeline (MongoDB)", () => {
  let themeId: string;
  let accountId: string;
  let ga4: FakeGa4;
  let deps: SyncDeps;
  let retries: { syncId: string; delayMs: number }[];

  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: "ga4_test_sync" });
    await Promise.all([AnalyticsAggregate.syncIndexes(), AnalyticsSync.syncIndexes(), AnalyticsTheme.syncIndexes(), GoogleConnection.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([AnalyticsAggregate.deleteMany({}), AnalyticsSync.deleteMany({}), AnalyticsTheme.deleteMany({}), GoogleConnection.deleteMany({})]);
    const account = await GoogleConnection.create({ googleAccountId: "sub-A", email: "a@example.com", status: "active" });
    accountId = account._id.toString();
    const theme = await AnalyticsTheme.create({
      name: "Adorn",
      slug: "adorn",
      googleConnectionId: account._id,
      ga4PropertyId: PROPERTY,
      ga4PropertyTimeZone: "Asia/Kolkata",
      connectionStatus: "connected",
    });
    themeId = theme._id.toString();
    ga4 = fakeGa4();
    retries = [];
    deps = {
      dataApiFor: async () => makeDataApi(ga4),
      adminFor: async () => fakeAdmin,
      now: () => NOW,
      sleep: async () => {},
      scheduleRetry: (syncId, delayMs) => retries.push({ syncId, delayMs }),
    };
  });

  const job = (id: string) => AnalyticsSync.findById(id).lean<Record<string, unknown> & { status: string; cursorDate: string; chunksDone: number; attempt: number; nextRetryAt: Date | null; isActive?: boolean; error?: { code: string } }>();
  const theme = () => AnalyticsTheme.findById(themeId).lean<Record<string, unknown> & { syncedThroughDate: string; historyStartDate: string; connectionStatus: string; lastSuccessfulSyncAt: Date | null }>();

  it("initial sync stores the property's whole history, from its creation date", async () => {
    const { sync, done } = await startSync(themeId, "mapped", deps);
    expect(sync).toMatchObject({ syncType: "initial", rangeStart: "2026-07-01", rangeEnd: TODAY, chunksTotal: 3 });
    await done;

    const days = datesBetween("2026-07-01", TODAY).length;
    expect(await job(sync.id)).toMatchObject({ status: "succeeded", chunksDone: 3, cursorDate: addDays(TODAY, 1) });
    expect((await job(sync.id))?.isActive).toBeUndefined(); // lock released
    expect(await theme()).toMatchObject({ historyStartDate: "2026-07-01", syncedThroughDate: TODAY, lastSuccessfulSyncAt: NOW });

    // Per breakdown per day: one row each for Try Theme and installs.
    expect(await AnalyticsAggregate.countDocuments()).toBe(days * BREAKDOWNS * 2);
    const install = await AnalyticsAggregate.findOne({ date: "2026-08-15", breakdown: "total", eventName: "shopify_theme_install" }).lean<{ metrics: Record<string, number> }>();
    expect(install?.metrics).toEqual({ eventCount: 2 });
    expect(ga4.calls).toBe(3 * BREAKDOWNS);
  });

  it("incremental sync re-fetches only the trailing window, without duplicating rows", async () => {
    await (await startSync(themeId, "mapped", deps)).done;
    const before = await AnalyticsAggregate.countDocuments();
    ga4.calls = 0;

    const { sync, done } = await startSync(themeId, "manual", deps);
    expect(sync).toMatchObject({ syncType: "manual", rangeStart: addDays(TODAY, -3), rangeEnd: TODAY, chunksTotal: 1 });
    await done;
    expect(await AnalyticsAggregate.countDocuments()).toBe(before);
    expect(ga4.calls).toBe(BREAKDOWNS);
  });

  it("applies GA4 revisions and drops rows GA4 no longer returns, only inside the re-fetched window", async () => {
    await (await startSync(themeId, "mapped", deps)).done;
    ga4.dims.country = "Nepal"; // GA4 re-attributed recent traffic
    ga4.installCount = 5;
    await (await startSync(themeId, "manual", deps)).done;

    const recent = addDays(TODAY, -1);
    const countries = await AnalyticsAggregate.distinct("dims.country", { breakdown: "country", date: recent });
    expect(countries).toEqual(["Nepal"]);
    expect(await AnalyticsAggregate.distinct("dims.country", { breakdown: "country", date: "2026-08-01" })).toEqual(["India"]);
    const install = await AnalyticsAggregate.findOne({ date: recent, breakdown: "total", eventName: "shopify_theme_install" }).lean<{ metrics: { eventCount: number } }>();
    expect(install?.metrics.eventCount).toBe(5);
  });

  it("allows only one active sync per theme", async () => {
    let release!: () => void;
    ga4.onCall = (call) => (call === 1 ? new Promise<void>((r) => (release = r)) : Promise.resolve());
    const first = await startSync(themeId, "mapped", deps);
    // Wait until the worker has claimed it: a *queued* job may be retried now, a running one not.
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    await expect(startSync(themeId, "manual", deps)).rejects.toMatchObject({ status: 409 });
    release();
    await first.done;
    expect(await AnalyticsSync.countDocuments()).toBe(1);
  });

  it("an outage mid-sync queues a retry that resumes from the last finished chunk", async () => {
    // Chunk 1 is 18 calls; fail the first call of chunk 2 past the in-request retries.
    ga4.failures.push({ atCall: BREAKDOWNS + 1, error: httpError(503), times: 3 });
    const { sync, done } = await startSync(themeId, "mapped", deps);
    await done;

    const queued = await job(sync.id);
    expect(queued).toMatchObject({ status: "queued", chunksDone: 1, cursorDate: addDays("2026-07-01", CHUNK_DAYS), attempt: 1, error: { code: "unavailable" } });
    expect(queued?.isActive).toBe(true); // still holds the lock
    expect(queued?.nextRetryAt).toEqual(new Date(NOW.getTime() + 5 * 60 * 1000));
    expect(retries).toEqual([{ syncId: sync.id, delayMs: 5 * 60 * 1000 }]);
    expect((await theme())?.syncedThroughDate).toBe(addDays("2026-07-01", CHUNK_DAYS - 1));

    ga4.calls = 0;
    await executeSync(sync.id, deps);
    expect(await job(sync.id)).toMatchObject({ status: "succeeded", chunksDone: 3, attempt: 2 });
    expect(ga4.calls).toBe(2 * BREAKDOWNS); // only the two remaining chunks
  });

  it("gives up after maxAttempts outages and releases the lock", async () => {
    ga4.failures.push({ atCall: 1, error: httpError(503), times: 1000 });
    const { sync, done } = await startSync(themeId, "mapped", deps);
    await done;
    await executeSync(sync.id, deps);
    await executeSync(sync.id, deps);
    const failed = await job(sync.id);
    expect(failed).toMatchObject({ status: "failed", attempt: 3, error: { code: "unavailable" } });
    expect(failed?.isActive).toBeUndefined();
  });

  it("waits out an hourly quota without using up an attempt", async () => {
    ga4.failures.push({ atCall: 5, error: httpError(429, "Exhausted property tokens per hour."), times: 1 });
    const { sync, done } = await startSync(themeId, "mapped", deps);
    await done;
    expect(await job(sync.id)).toMatchObject({ status: "queued", attempt: 0, error: { code: "quota_hourly" } });
    expect(retries[0].delayMs).toBe(65 * 60 * 1000);

    // "Sync now" mustn't cut the quota wait short: it would only burn more quota.
    await expect(startSync(themeId, "manual", deps)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/quota/) });
    expect(await job(sync.id)).toMatchObject({ status: "queued", error: { code: "quota_hourly" } });
  });

  it("lost access fails the job and flags the theme; a revoked token flags the account", async () => {
    ga4.failures.push({ atCall: 1, error: httpError(403, "PERMISSION_DENIED"), times: 1 });
    await (await startSync(themeId, "mapped", deps)).done;
    expect((await theme())?.connectionStatus).toBe("error");
    expect(await AnalyticsSync.findOne().lean()).toMatchObject({ status: "failed", error: { code: "permission_denied" } });

    await AnalyticsTheme.updateOne({ _id: themeId }, { connectionStatus: "connected" });
    ga4.failures.push({ atCall: ga4.calls + 1, error: Object.assign(new Error(), { response: { data: { error: "invalid_grant" } } }), times: 1 });
    await (await startSync(themeId, "manual", deps)).done;
    expect((await GoogleConnection.findById(accountId).lean<{ status: string }>())?.status).toBe("revoked");
  });

  it("refuses to start for unmapped themes and accounts needing reconnection", async () => {
    await GoogleConnection.updateOne({ _id: accountId }, { status: "revoked" });
    await expect(startSync(themeId, "manual", deps)).rejects.toMatchObject({ status: 422 });
    await AnalyticsTheme.updateOne({ _id: themeId }, { ga4PropertyId: null });
    await expect(startSync(themeId, "manual", deps)).rejects.toMatchObject({ status: 422 });
  });

  it("a job cut off by a server restart is re-queued and resumed by the scheduler", async () => {
    const { sync, done } = await startSync(themeId, "mapped", deps);
    await done;
    // Simulate a job that died mid-run an hour ago.
    await AnalyticsSync.collection.updateOne({ _id: new mongoose.Types.ObjectId(sync.id) }, { $set: { status: "running", isActive: true, cursorDate: "2026-08-30", chunksDone: 2, updatedAt: new Date(NOW.getTime() - 60 * 60 * 1000) } });

    expect(await recoverInterruptedSyncs(NOW)).toBe(1);
    ga4.calls = 0;
    const result = await runSchedulerTick(deps);
    expect(result).toMatchObject({ resumed: 1, started: 0 });
    expect(await job(sync.id)).toMatchObject({ status: "succeeded", chunksDone: 3 });
    expect(ga4.calls).toBe(BREAKDOWNS);
  });

  it("the scheduler rotates through the themes one per step, oldest sync first, then starts over", async () => {
    // Job createdAt timestamps come from the system clock; pin it and move
    // it forward per step so "synced longest ago" is well defined.
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    try {
      await schedulerScenario();
    } finally {
      vi.useRealTimers();
    }
  });

  async function schedulerScenario() {
    const dynamic = await AnalyticsTheme.create({ name: "Dynamic", slug: "dynamic", googleConnectionId: accountId, ga4PropertyId: "222222222", ga4PropertyTimeZone: "Asia/Kolkata", connectionStatus: "connected" });
    let step = 0;
    const tick = () => {
      const at = new Date(NOW.getTime() + step++ * 14 * 60 * 1000);
      vi.setSystemTime(at);
      return runSchedulerTick({ ...deps, now: () => at });
    };
    // Never-synced themes first, in name order; then the one synced longest ago.
    expect(await tick()).toEqual({ resumed: 0, started: 1, themeId });
    expect(await tick()).toEqual({ resumed: 0, started: 1, themeId: dynamic._id.toString() });
    expect(await tick()).toEqual({ resumed: 0, started: 1, themeId });
    expect((await AnalyticsSync.findOne({ analyticsThemeId: themeId }).sort({ createdAt: -1 }).lean<{ syncType: string }>())?.syncType).toBe("scheduled");
    expect(await tick()).toMatchObject({ started: 1, themeId: dynamic._id.toString() });

    // A job already waiting (e.g. "Sync now") runs first; the rotation waits a step.
    await AnalyticsSync.create({ analyticsThemeId: themeId, ga4PropertyId: PROPERTY, syncType: "manual", status: "queued", isActive: true, rangeStart: TODAY, rangeEnd: TODAY, cursorDate: TODAY, chunksTotal: 1 });
    expect(await tick()).toEqual({ resumed: 1, started: 0, themeId: null });

    await GoogleConnection.updateOne({ _id: accountId }, { status: "revoked" });
    expect(await tick()).toEqual({ resumed: 0, started: 0, themeId: null });
  }

  it("themes mapped together are queued and synced one at a time, oldest first", async () => {
    const others: { _id: { toString(): string } }[] = await AnalyticsTheme.create(
      ["Dynamic", "Nexus"].map((name, i) => ({
        name,
        slug: name.toLowerCase(),
        googleConnectionId: accountId,
        ga4PropertyId: `12345678${i}`,
        ga4PropertyTimeZone: "Asia/Kolkata",
        connectionStatus: "connected",
      }))
    );
    let inFlight = 0;
    let maxInFlight = 0;
    const order: string[] = [];
    const base = makeDataApi(ga4);
    const tracked: SyncDeps = {
      ...deps,
      dataApiFor: async () => ({
        properties: {
          runReport: (async (args: { property: string }) => {
            if (order.at(-1) !== args.property) order.push(args.property);
            maxInFlight = Math.max(maxInFlight, ++inFlight);
            await new Promise((r) => setTimeout(r, 1)); // let other jobs interleave, if they could
            try {
              return await (base.properties.runReport as unknown as (a: unknown) => Promise<unknown>)(args);
            } finally {
              inFlight--;
            }
          }) as unknown as DataApi["properties"]["runReport"],
        },
      }),
    };

    // Mapped back to back, like Settings does; the first job starts while the others are still being queued.
    const started = [];
    for (const id of [themeId, ...others.map((t) => t._id.toString())]) started.push(await startSync(id, "mapped", tracked));
    await Promise.all(started.map((s) => s.done));

    expect(maxInFlight).toBe(1);
    expect(order).toEqual([`properties/${PROPERTY}`, "properties/123456780", "properties/123456781"]);
    for (const s of started) expect(await job(s.sync.id)).toMatchObject({ status: "succeeded", chunksDone: 3 });
  }, 30_000); // three full histories

  it("a remap mid-sync cancels the old job and queues the new property's full sync, which purges the old rows", async () => {
    ga4.onCall = async (call) => {
      if (call === BREAKDOWNS) await AnalyticsTheme.updateOne({ _id: themeId }, { ga4PropertyId: "987654321", syncedThroughDate: null, historyStartDate: null });
    };
    const { sync, done } = await startSync(themeId, "mapped", deps);
    await done; // the worker also runs the job queued for the new property
    expect(await job(sync.id)).toMatchObject({ status: "cancelled", chunksDone: 1 });
    const next = await AnalyticsSync.findOne({ _id: { $ne: sync.id } }).lean<{ status: string; ga4PropertyId: string; syncType: string }>();
    expect(next).toMatchObject({ status: "succeeded", ga4PropertyId: "987654321", syncType: "initial" });
    expect(await AnalyticsAggregate.countDocuments({ ga4PropertyId: PROPERTY })).toBe(0);
    expect(await AnalyticsAggregate.countDocuments({ ga4PropertyId: "987654321" })).toBeGreaterThan(0);
    expect(await theme()).toMatchObject({ connectionStatus: "connected", syncedThroughDate: TODAY });
  });

  it("a page filter change mid-sync restarts the full history under the new filter; the old job never writes progress", async () => {
    ga4.onCall = async (call) => {
      // Mid-chunk (the chunk's last report): what Settings does when a filter is added.
      if (call === BREAKDOWNS) await AnalyticsTheme.updateOne({ _id: themeId }, { pagePathPrefix: "/themes/adorn/", syncedThroughDate: null, historyStartDate: null });
    };
    const { sync, done } = await startSync(themeId, "mapped", deps);
    await done;
    expect(await job(sync.id)).toMatchObject({ status: "cancelled", chunksDone: 1 });
    const next = await AnalyticsSync.findOne({ _id: { $ne: sync.id } }).lean<{ status: string; pagePathPrefix: string; syncType: string; rangeStart: string }>();
    // Full history again, not an incremental sync from the old job's progress.
    expect(next).toMatchObject({ status: "succeeded", pagePathPrefix: "/themes/adorn/", syncType: "initial", rangeStart: "2026-07-01" });
    expect(await theme()).toMatchObject({ syncedThroughDate: TODAY, historyStartDate: "2026-07-01" });
  });

  it("reads dates up to the cut-off from the earlier-history property (filtered), and later dates from the theme's own", async () => {
    await AnalyticsTheme.updateOne({ _id: themeId }, { earlierPropertyId: "444444444", earlierPagePathPrefix: "/themes/flaunt/", earlierUntil: "2026-07-20" });
    const { sync, done } = await startSync(themeId, "mapped", deps);
    expect(sync).toMatchObject({ syncType: "initial", rangeStart: "2026-07-01" });
    await done;

    const earlier = ga4.requests.filter((r) => r.property === "properties/444444444");
    const own = ga4.requests.filter((r) => r.property === `properties/${PROPERTY}`);
    expect(earlier.length).toBeGreaterThan(0);
    expect(earlier.every((r) => r.start >= "2026-07-01" && r.end <= "2026-07-20")).toBe(true);
    // Every earlier report is page-filtered, except the property-wide install estimate.
    expect(earlier.filter((r) => !r.pageFiltered)).toHaveLength(1);
    expect(own.every((r) => r.start >= "2026-07-21" && !r.pageFiltered)).toBe(true);

    const earlierDates = await AnalyticsAggregate.distinct("date", { ga4PropertyId: "444444444" });
    expect(earlierDates.sort().at(-1)).toBe("2026-07-20");
    expect((await AnalyticsAggregate.distinct("date", { ga4PropertyId: PROPERTY })).sort()[0]).toBe("2026-07-21");
    // Installs on the earlier dates are estimated (this theme had all of that day's Try Theme clicks).
    const install = await AnalyticsAggregate.findOne({ ga4PropertyId: "444444444", date: "2026-07-10", breakdown: "total", eventName: "shopify_theme_install" }).lean<{ metrics: { eventCount: number } }>();
    expect(install?.metrics.eventCount).toBe(2);
    expect(await theme()).toMatchObject({ syncedThroughDate: TODAY, connectionStatus: "connected" });
  });

  it("a queued job left over from an old mapping is cancelled and replaced, without marking the theme as broken", async () => {
    const stale = await AnalyticsSync.create({ analyticsThemeId: themeId, ga4PropertyId: "555555555", syncType: "scheduled", status: "queued", isActive: true, rangeStart: "2026-09-20", rangeEnd: TODAY, cursorDate: "2026-09-20", chunksTotal: 1 });
    await drainSyncQueue(deps);
    expect(await job(stale._id.toString())).toMatchObject({ status: "cancelled" });
    expect(await AnalyticsSync.findOne({ _id: { $ne: stale._id } }).lean<{ status: string; ga4PropertyId: string }>()).toMatchObject({ status: "succeeded", ga4PropertyId: PROPERTY });
    expect(await theme()).toMatchObject({ connectionStatus: "connected", syncedThroughDate: TODAY });
  });
});
