import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditRun } from "@/models/audit-run";
import { INTERRUPTED_AUDIT_ERROR, STALE_AUDIT_MS, failInterruptedAudits } from "./recovery";

// Opt-in, against a real MongoDB (same variable as the GA4 integration tests):
//   GA4_TEST_MONGODB_URI=mongodb://localhost:27017 npx vitest run lib/audit/recovery
const uri = process.env.GA4_TEST_MONGODB_URI;
const NOW = new Date("2026-09-29T12:00:00Z");

describe.skipIf(!uri)("interrupted audit recovery (MongoDB)", () => {
  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: "audit_test_recovery" });
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    await AuditRun.deleteMany({});
  });

  const run = (status: string, startedMsAgo: number) =>
    AuditRun.create({ themeId: new mongoose.Types.ObjectId(), status, startedAt: new Date(NOW.getTime() - startedMsAgo), currentStage: status === "running" ? "running_rules" : null });

  it("fails only runs stuck longer than an audit could take, then every running one at boot", async () => {
    const stuck = await run("running", STALE_AUDIT_MS + 60_000);
    const fresh = await run("running", 60_000);
    const done = await run("complete", STALE_AUDIT_MS * 10);

    expect(await failInterruptedAudits(NOW)).toBe(1);
    expect(await AuditRun.findById(stuck._id).lean()).toMatchObject({ status: "failed", error: INTERRUPTED_AUDIT_ERROR, currentStage: null, completedAt: NOW });
    expect((await AuditRun.findById(fresh._id).lean())?.status).toBe("running");

    expect(await failInterruptedAudits(NOW, { all: true })).toBe(1); // at boot nothing can really be running
    expect((await AuditRun.findById(fresh._id).lean())?.status).toBe("failed");
    expect((await AuditRun.findById(done._id).lean())?.status).toBe("complete");
  });
});
