import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { runFollowUps } from "@/lib/service/import/persist";
import { rematchClients } from "@/lib/service/import/rematch";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkProfile } from "@/models/service-upwork";

// Adds a client and its project to the Service section when hours are reported for a client that has no project yet (first case,
// 2026-11-17: "Janell Saverin | Burhan (OFF TIMER)": 4 entries waiting in review, no client, no project). Creates the client if it is
// new, an Active hourly (Timer) project named "<Client> – <Profile>", then re-matches the waiting entries to it.
//
// A dry run unless --apply (the owner runs it; it writes to the live database):
//   npx tsx --env-file=.env.production.local scripts/add-service-project.ts "Janell Saverin" --profile Burhan [--ba Harsha] [--bd Pranit] [--rate 15] [--limit-hours 10] [--name "<Project name>"] [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const flag = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const client = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--")));
const profileName = flag("profile");
const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

async function main() {
  if (!client) throw new Error('Usage: add-service-project.ts "<Client>" --profile <Upwork profile> [--ba N] [--bd N] [--rate USD] [--limit-hours H] [--apply]');
  await connectToDatabase();
  const existing = await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const found = existing.find((c) => [c.name, ...c.aliases].some((n) => key(n) === key(client)));
  const profiles = await ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const profile = profileName ? profiles.find((p) => [p.name, ...p.aliases].some((n) => key(n) === key(profileName))) : undefined;
  if (profileName && !profile) throw new Error(`No Upwork profile called "${profileName}". Known: ${profiles.map((p) => p.name).join(", ")}`);
  // --name sets the project name when the default "<Client> – <Profile>" is already taken (a second project for the same client).
  const name = flag("name") ?? `${client}${profile ? ` – ${profile.name}` : ""}`;
  const clientId = found?._id ?? randomUUID();
  const open = found ? await ServiceProject.find({ clientId }).select("name status").lean<Array<{ name: string; status: string }>>() : [];
  const waiting = await ServiceTimeEntry.find({ clientId: null, clientRaw: new RegExp(`^(?:(?:R|App|DM)\\s*\\|\\s*)?${client.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") }).select("minutes").lean<Array<{ minutes: number }>>();

  console.log(`${apply ? "APPLYING" : "Dry run"}: client "${client}" ${found ? "exists" : "will be created"}; project "${name}" will be created (Active, Hourly, Timer).`);
  if (open.length) console.log(`  The client already has: ${open.map((p) => `${p.name} (${p.status})`).join(", ")}`);
  console.log(`  Waiting entries to attach: ${waiting.length} (${(waiting.reduce((n, e) => n + e.minutes, 0) / 60).toFixed(1)} h)`);
  if (!apply) return console.log("Nothing written. Add --apply to create it.");

  if (!found) await ServiceClient.create({ _id: clientId, name: client });
  const people = [
    ...(flag("ba") ? [{ role: "BUSINESS_ANALYST", name: flag("ba")! }] : []),
    ...(flag("bd") ? [{ role: "BUSINESS_DEVELOPER", name: flag("bd")! }] : []),
  ];
  const rate = flag("rate");
  const limit = flag("limit-hours");
  const now = new Date();
  const id = randomUUID();
  await ServiceProject.create({
    _id: id, name, clientId, status: "ACTIVE", startDate: now, upworkProfileId: profile?._id ?? null, people,
    history: [{ fromStatus: null, toStatus: "ACTIVE", reason: "Added by hand: hours were reported with no project", at: now }],
    contract: { type: "HOURLY", trackingMode: "TIMER", startDate: now, hourlyRateCents: rate ? Math.round(Number(rate) * 100) : null, weeklyLimitMinutes: limit ? Math.round(Number(limit) * 60) : null },
  });
  await recordServiceAudit("project.create", { projectId: id, name, via: "scripts/add-service-project.ts" });
  const moved = await rematchClients();
  await runFollowUps();
  console.log(`Done: project ${id} created; ${moved} entries re-matched to clients. Set the BA, BD, rate and weekly hours in the project's Settings if not given.`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
