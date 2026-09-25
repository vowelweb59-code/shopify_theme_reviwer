import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { pruneOldAuditRuns } from "./retention";

// Opt-in, like the other MongoDB-backed tests:
//   GA4_TEST_MONGODB_URI=mongodb://localhost:27017 npx vitest run lib/audit
const uri = process.env.GA4_TEST_MONGODB_URI;

describe.skipIf(!uri)("audit-run retention (MongoDB)", () => {
  const themeId = new Types.ObjectId();
  const otherTheme = new Types.ObjectId();
  const day = (n: number) => new Date(Date.UTC(2026, 8, n));

  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: "audit_test_retention" });
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    await Promise.all([AuditRun.deleteMany({}), Finding.deleteMany({})]);
  });

  async function run(status: string, startedAt: Date, theme = themeId) {
    const r = await AuditRun.create({ themeId: theme, status, startedAt });
    await Finding.create({ auditRunId: r._id, ruleId: "R", filePath: "x.liquid", category: "Bug", severity: "low", finding: "f" });
    return r._id.toString();
  }

  it("keeps the newest 3 complete runs and drops older ones with their findings", async () => {
    const ids = [];
    for (let d = 1; d <= 5; d++) ids.push(await run("complete", day(d)));
    const result = await pruneOldAuditRuns(themeId);
    expect(result).toEqual({ runs: 2, findings: 2 });
    const left = (await AuditRun.find({ themeId }).lean()).map((r) => r._id.toString()).sort();
    expect(left).toEqual(ids.slice(2).sort());
    expect(await Finding.countDocuments()).toBe(3);
  });

  it("drops failed runs older than the oldest kept run, keeps recent failures and in-progress runs", async () => {
    await run("failed", day(1));
    for (let d = 2; d <= 5; d++) await run("complete", day(d));
    const recentFail = await run("failed", day(6));
    const running = await run("running", day(1));
    await pruneOldAuditRuns(themeId);
    const statuses = (await AuditRun.find({ themeId }).sort({ startedAt: 1 }).lean()).map((r) => `${r.status}@${r.startedAt.getUTCDate()}`);
    expect(statuses).toEqual(["running@1", "complete@3", "complete@4", "complete@5", "failed@6"]);
    expect(await AuditRun.exists({ _id: recentFail })).toBeTruthy();
    expect(await AuditRun.exists({ _id: running })).toBeTruthy();
  });

  it("does nothing with 3 or fewer complete runs, and never touches other themes", async () => {
    for (let d = 1; d <= 3; d++) await run("complete", day(d));
    for (let d = 1; d <= 5; d++) await run("complete", day(d), otherTheme);
    expect(await pruneOldAuditRuns(themeId)).toEqual({ runs: 0, findings: 0 });
    expect(await AuditRun.countDocuments({ themeId: otherTheme })).toBe(5);
  });
});
