import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsSync } from "@/models/analytics-sync";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { AGGREGATE_BREAKDOWNS, ALL_EVENTS } from "../constants";
import type { AdminApi } from "../properties";
import { addDays } from "./dates";
import type { DataApi, ReportRequest } from "./ga4Client";
import { CHUNK_DAYS, executeSync, recoverInterruptedSyncs, startSync, type SyncDeps } from "./runSync";
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
  failures: { atCall: number; error: Error; times: number }[];
  onCall?: (call: number) => Promise<void>;
};

function fakeGa4(): FakeGa4 {
  return { dims: { country: "India" }, events: ["add_to_cart", "shopify_theme_install"], installCount: 2, calls: 0, failures: [] };
}

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

function makeDataApi(ga4: FakeGa4): DataApi {
  return {
    properties: {
      runReport: (async ({ requestBody }: { requestBody: ReportRequest }) => {
        ga4.calls++;
        await ga4.onCall?.(ga4.calls);
        const failure = ga4.failures.find((f) => ga4.calls >= f.atCall && f.times > 0);
        if (failure) {
          failure.times--;
          throw failure.error;
        }
        const names = requestBody.dimensions!.map((d) => d.name!);
        const [range] = requestBody.dateRanges!;
        const byEvent = names[1] === "eventName";
        const rest = names.slice(byEvent ? 2 : 1).map((n) => ga4.dims[n] ?? "X");
        const rows = datesBetween(range.startDate!, range.endDate!).flatMap((date) => {
          const d = date.replaceAll("-", "");
          return byEvent
            ? ga4.events.map((ev) => ({
                dimensionValues: [d, ev, ...rest].map((value) => ({ value })),
                metricValues: [ev === "shopify_theme_install" ? ga4.installCount : 10, 3].map((n) => ({ value: String(n) })),
              }))
            : [{ dimensionValues: [d, ...rest].map((value) => ({ value })), metricValues: [50, 45, 20, 60, 400].map((n) => ({ value: String(n) })) }];
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

    // Per breakdown per day: 2 tracked-event rows + 1 all-events row.
    expect(await AnalyticsAggregate.countDocuments()).toBe(days * BREAKDOWNS * 3);
    const install = await AnalyticsAggregate.findOne({ date: "2026-08-15", breakdown: "total", eventName: "shopify_theme_install" }).lean<{ metrics: { eventCount: number; totalUsers: number } }>();
    expect(install?.metrics).toMatchObject({ eventCount: 2, totalUsers: 3 });
    const totals = await AnalyticsAggregate.findOne({ date: "2026-08-15", breakdown: "total", eventName: ALL_EVENTS }).lean<{ metrics: { sessions: number } }>();
    expect(totals?.metrics.sessions).toBe(60);
    expect(ga4.calls).toBe(3 * BREAKDOWNS * 2);
  });

  it("incremental sync re-fetches only the trailing window, without duplicating rows", async () => {
    await (await startSync(themeId, "mapped", deps)).done;
    const before = await AnalyticsAggregate.countDocuments();
    ga4.calls = 0;

    const { sync, done } = await startSync(themeId, "manual", deps);
    expect(sync).toMatchObject({ syncType: "manual", rangeStart: addDays(TODAY, -3), rangeEnd: TODAY, chunksTotal: 1 });
    await done;
    expect(await AnalyticsAggregate.countDocuments()).toBe(before);
    expect(ga4.calls).toBe(BREAKDOWNS * 2);
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
    await expect(startSync(themeId, "manual", deps)).rejects.toMatchObject({ status: 409 });
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release();
    await first.done;
    expect(await AnalyticsSync.countDocuments()).toBe(1);
  });

  it("an outage mid-sync queues a retry that resumes from the last finished chunk", async () => {
    // Chunk 1 is 18 calls; fail the first call of chunk 2 past the in-request retries.
    ga4.failures.push({ atCall: BREAKDOWNS * 2 + 1, error: httpError(503), times: 3 });
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
    expect(ga4.calls).toBe(2 * BREAKDOWNS * 2); // only the two remaining chunks
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
    expect(result.resumed).toBe(1);
    expect(await job(sync.id)).toMatchObject({ status: "succeeded", chunksDone: 3 });
    expect(ga4.calls).toBe(BREAKDOWNS * 2);
  });

  it("the scheduler starts due themes and skips recently synced or unusable ones", async () => {
    // Job createdAt timestamps come from the system clock, while the
    // scheduler's cutoff comes from deps.now(). In production both are the
    // real clock; pin the system clock to the test's NOW so they agree here
    // too (otherwise this test breaks once the real date passes NOW).
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    try {
      await schedulerScenario();
    } finally {
      vi.useRealTimers();
    }
  });

  async function schedulerScenario() {
    // Each tick runs with the system clock at that tick's simulated time.
    const tickAt = (d: SyncDeps) => {
      vi.setSystemTime(d.now());
      return runSchedulerTick(d);
    };
    expect(await tickAt(deps)).toEqual({ resumed: 0, started: 1 }); // never synced → initial
    expect(await tickAt(deps)).toEqual({ resumed: 0, started: 0 }); // synced moments ago

    const later: SyncDeps = { ...deps, now: () => new Date(NOW.getTime() + 7 * 60 * 60 * 1000) };
    expect(await tickAt(later)).toEqual({ resumed: 0, started: 1 });
    expect((await AnalyticsSync.findOne().sort({ createdAt: -1 }).lean<{ syncType: string }>())?.syncType).toBe("scheduled");

    await GoogleConnection.updateOne({ _id: accountId }, { status: "revoked" });
    const muchLater: SyncDeps = { ...deps, now: () => new Date(NOW.getTime() + 20 * 60 * 60 * 1000) };
    expect(await tickAt(muchLater)).toEqual({ resumed: 0, started: 0 });
  }

  it("stops if the theme is remapped mid-sync, and the new property's first sync purges the old rows", async () => {
    ga4.onCall = async (call) => {
      if (call === BREAKDOWNS * 2) await AnalyticsTheme.updateOne({ _id: themeId }, { ga4PropertyId: "987654321", syncedThroughDate: null });
    };
    const { sync, done } = await startSync(themeId, "mapped", deps);
    await done;
    expect(await job(sync.id)).toMatchObject({ status: "cancelled", chunksDone: 1 });
    expect(await AnalyticsAggregate.countDocuments({ ga4PropertyId: PROPERTY })).toBeGreaterThan(0);
    expect((await theme())?.syncedThroughDate).toBeNull(); // the old job didn't overwrite the reset

    ga4.onCall = undefined;
    await (await startSync(themeId, "mapped", deps)).done;
    expect(await AnalyticsAggregate.countDocuments({ ga4PropertyId: PROPERTY })).toBe(0);
    expect(await AnalyticsAggregate.countDocuments({ ga4PropertyId: "987654321" })).toBeGreaterThan(0);
  });
});
