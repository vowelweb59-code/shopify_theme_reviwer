import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { persistPlan } from "./persist";
import { planImport, type RawChatMessage, type SpaceInput } from "./plan";
import { clientRegistry } from "./client-registry";
import { autoAssignProjects } from "../hours/auto-assign";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceChatMessage } from "@/models/service-chat";

// Runs against a real MongoDB only when SERVICE_TEST_MONGODB_URI is set (e.g. mongodb://127.0.0.1:27017); each run uses its
// own throwaway database and drops it afterwards. Skipped otherwise, so `npm test` needs no database.
const BASE = process.env.SERVICE_TEST_MONGODB_URI;
const suite = BASE ? describe : describe.skip;

const SPACE = "spaces/TEST";
const msg = (id: string, at: string, text: string, sender = "users/1", name = "Asha Patel"): RawChatMessage => ({ externalId: `${SPACE}/messages/${id}`, senderExternalId: sender, senderName: name, postedAt: at, text });
const NOW = new Date("2026-10-20T12:00:00Z");

async function importMonth(messages: RawChatMessage[]) {
  const clients = clientRegistry((await ServiceClient.find().lean<Array<{ _id: string; name: string; aliases: string[] }>>()).map((c) => ({ id: c._id, name: c.name, aliases: c.aliases })));
  const spaces: SpaceInput[] = [{ externalId: SPACE, name: "Timer Status", type: "TIMER_STATUS", messages }];
  return persistPlan(planImport({ month: "2026-10", spaces, clients, now: NOW }), spaces);
}

suite("service import persist (MongoDB)", () => {
  beforeAll(async () => {
    const url = new URL(BASE!);
    url.pathname = `/service_test_${process.pid}_${Date.now()}`;
    await mongoose.connect(url.toString());
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  const day = [
    msg("1", "2026-10-15T04:00:00Z", "Acme | Sapana - TIMER ON"),
    msg("2", "2026-10-15T07:00:00Z", "Acme | Sapana - TIMER OFF"),
  ];

  it("imports a timer pair once and is idempotent", async () => {
    await ServiceClient.create({ name: "Acme" });
    const first = await importMonth(day);
    expect(first.entriesCreated).toBe(1);
    const again = await importMonth(day);
    expect(again.entriesCreated).toBe(0);
    expect(await ServiceTimeEntry.countDocuments()).toBe(1);
    expect(await ServiceChatMessage.countDocuments()).toBe(2);
    const e = await ServiceTimeEntry.findOne().lean<{ minutes: number; clientId: string; senderExternalId: string; state: string }>();
    expect(e).toMatchObject({ minutes: 180, senderExternalId: "users/1", state: "PARSED" });
  });

  it("keeps an entry a person approved across re-imports", async () => {
    await ServiceClient.create({ name: "Acme" });
    await importMonth(day);
    await ServiceTimeEntry.updateOne({}, { $set: { state: "APPROVED", minutes: 150 } });
    const r = await importMonth(day);
    expect(r.entriesKeptAsReviewed).toBe(1);
    expect((await ServiceTimeEntry.findOne().lean<{ minutes: number }>())!.minutes).toBe(150);
  });

  it("places an entry of a client with two projects by the word written first", async () => {
    const client = await ServiceClient.create({ name: "Stacy King", aliases: ["Mathew Gerson"] });
    const live = { type: "HOURLY", status: "ACTIVE" };
    const stacy = await ServiceProject.create({ name: "Stacy", clientId: client._id, status: "ACTIVE", chatKeywords: ["Stacy King"], contract: live });
    await ServiceProject.create({ name: "Mathew", clientId: client._id, status: "ACTIVE", chatKeywords: ["Mathew Gerson"], contract: live });
    await importMonth([msg("1", "2026-10-15T04:00:00Z", "Stacy King (Mathew Gerson) | Sapana - TIMER ON"), msg("2", "2026-10-15T06:00:00Z", "Stacy King (Mathew Gerson) | Sapana - TIMER OFF")]);
    expect(await autoAssignProjects()).toBe(0); // already placed by the import's follow-ups
    expect((await ServiceTimeEntry.findOne().lean<{ projectId: string }>())!.projectId).toBe(stacy._id);
    const p = await ServiceProject.findById(stacy._id).lean<{ people: Array<{ role: string; name: string }> }>();
    expect(p!.people).toEqual([expect.objectContaining({ role: "EXECUTIVE", name: "Asha Patel" })]);
  });

  it("keeps the written client name so the entry matches once the client exists", async () => {
    await importMonth(day);
    const e = await ServiceTimeEntry.findOne().lean<{ clientId: string | null; clientRaw: string; flags: string[] }>();
    expect(e).toMatchObject({ clientId: null, clientRaw: "Acme" });
    expect(e!.flags).toContain("UNKNOWN_CLIENT");
  });
});
