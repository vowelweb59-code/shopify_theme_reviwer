import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { runFollowUps } from "@/lib/service/import/persist";
import { rematchClients } from "@/lib/service/import/rematch";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkProfile } from "@/models/service-upwork";

// Creates a client and an Active hourly (Timer) project for each client below (owner, 2026-11-18: "yes, create a project for each" of
// the larger names whose hours were waiting in Review with no client), as scripts/add-service-project.ts does one at a time. Then
// re-matches the waiting entries and runs the follow-ups. A client that already exists only gets its missing project. No rate is
// set: price them afterwards (the sales sheet has San Bruno Smile, Alex Gordon and Ronnie Paiva; scripts/set-unset-prices-from-sheet.ts
// --include-approximate would pick those up). Audit `project.create`. Dry run unless --apply (the owner runs it):
//   npx tsx --env-file=.env.production.local scripts/add-service-projects-batch.ts [--apply]
const SPECS: Array<{ client: string; profile: string | null }> = [
  { client: "San Bruno", profile: "Zainab" },
  { client: "DizeBeyond", profile: "Direct" },
  { client: "Alex Gordon", profile: "Rahul" },
  { client: "Glow Dazzle", profile: null },
  { client: "Ronnie Paiva", profile: "Shraddha" },
  { client: "Sharron", profile: "Zainab" },
  { client: "Summitfinds", profile: null },
  { client: "Chevon Patrick", profile: "Shraddha" },
];
const apply = process.argv.includes("--apply");
const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function main() {
  await connectToDatabase();
  const clients = await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const profiles = await ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  console.log(apply ? "APPLYING:" : "Dry run:");
  const todo: Array<{ client: string; profileId: string | null; profileName: string | null; clientId: string; isNew: boolean; name: string }> = [];
  for (const s of SPECS) {
    const found = clients.find((c) => [c.name, ...c.aliases].some((n) => key(n) === key(s.client)));
    const profile = s.profile ? profiles.find((p) => [p.name, ...p.aliases].some((n) => key(n) === key(s.profile!))) : undefined;
    if (s.profile && !profile) {
      console.log(`  ${s.client}: no Upwork profile "${s.profile}"; skipped`);
      continue;
    }
    const name = `${s.client}${profile ? ` – ${profile.name}` : ""}`;
    if (await ServiceProject.countDocuments({ name })) {
      console.log(`  ${name}: a project with this name exists; skipped`);
      continue;
    }
    const waiting = await ServiceTimeEntry.find({ clientId: null, clientRaw: new RegExp(`^${escape(s.client)}\\b`, "i") })
      .select("minutes")
      .lean<Array<{ minutes: number }>>();
    console.log(
      `  ${name}: client ${found ? "exists" : "new"}, ${profile ? `profile ${profile.name}` : "no profile"}, ${waiting.length} waiting entries (${(waiting.reduce((n, e) => n + e.minutes, 0) / 60).toFixed(1)} h)`
    );
    todo.push({
      client: s.client,
      profileId: profile?._id ?? null,
      profileName: profile?.name ?? null,
      clientId: found?._id ?? randomUUID(),
      isNew: !found,
      name,
    });
  }
  if (!apply) return console.log("Nothing written. Add --apply to create them.");

  const now = new Date();
  for (const t of todo) {
    if (t.isNew) await ServiceClient.create({ _id: t.clientId, name: t.client });
    const id = randomUUID();
    await ServiceProject.create({
      _id: id,
      name: t.name,
      clientId: t.clientId,
      status: "ACTIVE",
      startDate: now,
      upworkProfileId: t.profileId,
      people: [],
      history: [{ fromStatus: null, toStatus: "ACTIVE", reason: "Added by hand: hours were reported with no project", at: now }],
      contract: { type: "HOURLY", trackingMode: "TIMER", startDate: now, hourlyRateCents: null, weeklyLimitMinutes: null },
    });
    await recordServiceAudit("project.create", { projectId: id, name: t.name, via: "scripts/add-service-projects-batch.ts" });
  }
  const moved = await rematchClients();
  await runFollowUps();
  console.log(`Done: ${todo.length} projects created; ${moved} entries re-matched to clients. Set rates, BA and BD in each project's Settings.`);
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
