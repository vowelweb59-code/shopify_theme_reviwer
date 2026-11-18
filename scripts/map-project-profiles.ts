import { readFileSync } from "node:fs";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { matchProfile, type MatchableProfile } from "@/lib/service/import/profile-match";
import { normalizeName } from "@/lib/service/import/text";
import { matchClient } from "@/lib/service/revenue/match";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceUpworkProfile } from "@/models/service-upwork";

// Fills the Upwork profile of Service projects that have none (owner, 2026-11-18: "many projects have missing profiles"). The profile is
// read from three places and used only when they do not disagree: (1) the project name's suffix ("Rahul Patil – Shailesh"), (2) the
// profile written in the project's hour entries in TIMER STATUS ("Client | Profile", the commonest), (3) the profile column of the sales
// sheet (the JSON made by the revenue import, kept outside the repo). A name must resolve to a known profile or alias; a profile the app
// does not have yet is created only if it is listed in NEW_PROFILES below, and a spelling variant only if it is in ALIASES. Anything else
// is listed as unresolved and left alone. Dry run unless --apply (the owner runs it); audit `projects.map_profiles`.
//   npx tsx --env-file=.env.production.local scripts/map-project-profiles.ts [--sheet <revenue-taken.json>] [--apply]
const NEW_PROFILES = ["Zainab", "Hamza", "Shailesh", "Aliasger Ezzi", "Mohammed Kapadia"];
/** spelling in Chat or the sheet -> profile name it stands for */
const ALIASES: Record<string, string> = { "zainab r": "Zainab", "zainab raja": "Zainab", "aliasger b": "Ali Asger Bagichawal", murtaza: "Murtuza Raverwala", "dreamzhub direct": "Direct", "sandra rose": "Direct", mhd: "Mohammed Kapadia" };

/** Projects whose profile is written nowhere, set by the owner (2026-11-18): project name -> profile name. */
const OWNER_SET: Record<string, string> = { "Jeff Jalali": "Mohammed Kapadia", "Kutaisi Airport Car Rental": "Direct", "Jay Hwang": "Direct" };

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const sheetPath = argv.includes("--sheet") ? argv[argv.indexOf("--sheet") + 1]! : `${process.env.USERPROFILE ?? ""}/Downloads/revenue-taken.json`;

const top = (xs: string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
};

async function main() {
  await connectToDatabase();
  const existing = await ServiceUpworkProfile.find().lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const known: MatchableProfile[] = existing.map((p) => ({ id: p._id, name: p.name, aliases: [...p.aliases] }));
  const toCreate: string[] = [];
  const toAlias: Array<{ id: string; alias: string }> = [];
  for (const n of NEW_PROFILES) {
    if (!matchProfile(n, known)) {
      known.push({ id: `new:${n}`, name: n, aliases: [] });
      toCreate.push(n);
    }
  }
  for (const [alias, target] of Object.entries(ALIASES)) {
    const t = known.find((p) => normalizeName(p.name) === normalizeName(target));
    if (!t || matchProfile(alias, known)) continue;
    (t.aliases as string[]).push(alias);
    if (!t.id.startsWith("new:")) toAlias.push({ id: t.id, alias });
  }
  const nameOf = new Map(known.map((p) => [p.id, p.name]));

  const projects = await ServiceProject.find({ upworkProfileId: null }).select("name status clientId").lean<Array<{ _id: string; name: string; status: string; clientId: string | null }>>();
  const clients = await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const clientNames = clients.map((c) => ({ id: c._id, names: [c.name, ...(c.aliases ?? [])] }));
  const att = await loadAttribution();
  // Profile ids found in each project's entries: the matched id, the profile text, or any "A | B | C" / "A - B" part of the client field.
  // (The shared all-time loader keeps only minute totals, so the entries are read here with their profile fields.)
  const idsByProject = new Map<string, string[]>();
  const rawByProject = new Map<string, string[]>();
  const entries = await ServiceTimeEntry.find({ state: { $ne: "REJECTED" } })
    .select("projectId clientId allocations profile profileId clientRaw")
    .lean<Array<{ projectId: string | null; clientId: string | null; allocations: Array<{ projectId: string }>; profile: string | null; profileId: string | null; clientRaw: string | null }>>();
  for (const e of entries) {
    const targets = e.allocations?.length ? e.allocations.map((a) => a.projectId) : [projectOf(e, att.owner) ?? e.projectId];
    const parts = [e.profile, ...(e.clientRaw ?? "").split(/\s*\|\s*|\s[-–—]\s/)].map((x) => x?.trim()).filter((x): x is string => !!x);
    const ids = [e.profileId && known.some((k) => k.id === e.profileId) ? e.profileId : null, ...parts.map((x) => matchProfile(x, known))].filter((x): x is string => !!x);
    const id = ids[0];
    for (const t of targets) {
      if (!t) continue;
      if (id) idsByProject.set(t, [...(idsByProject.get(t) ?? []), id]);
      else if (e.profile?.trim()) rawByProject.set(t, [...(rawByProject.get(t) ?? []), e.profile.trim()]);
    }
  }
  const sheetByClient = new Map<string, string[]>();
  try {
    const j = JSON.parse(readFileSync(sheetPath, "utf8")) as unknown;
    const rows = (Array.isArray(j) ? j : (j as { rows: unknown[] }).rows) as Array<{ client: string; profile?: string }>;
    for (const r of rows) {
      const m = matchClient(r.client, clientNames);
      if (m.clientId && r.profile?.trim()) sheetByClient.set(m.clientId, [...(sheetByClient.get(m.clientId) ?? []), r.profile.trim()]);
    }
  } catch {
    console.log(`(sales sheet not read from ${sheetPath}: continuing without it)`);
  }

  const chosen = new Map<string, string>(); // project id -> profile id (maybe "new:Name")
  const assign: Array<{ name: string; profile: string; from: string }> = [];
  const conflicts: string[] = [];
  const unresolved = new Map<string, string[]>();
  let nothing = 0;
  for (const p of projects) {
    const set = OWNER_SET[p.name] ? matchProfile(OWNER_SET[p.name], known) : null;
    if (set) {
      chosen.set(p._id, set);
      assign.push({ name: p.name, profile: nameOf.get(set)!, from: "owner" });
      continue;
    }
    const suffix = p.name.split(/\s[–-]\s/).slice(1).join(" - ").replace(/\(.*?\)/g, "").trim();
    const written = [
      { src: "name", raw: suffix || undefined },
      { src: "entries", raw: top(idsByProject.get(p._id) ?? []) ? nameOf.get(top(idsByProject.get(p._id) ?? [])!) : top(rawByProject.get(p._id) ?? []) },
      { src: "sheet", raw: top(sheetByClient.get(p.clientId ?? "") ?? []) },
    ].filter((x): x is { src: string; raw: string } => !!x.raw);
    if (!written.length) {
      nothing++;
      continue;
    }
    const resolved = written.map((w) => ({ ...w, id: matchProfile(w.raw, known) }));
    for (const w of resolved) if (!w.id) unresolved.set(w.raw, [...(unresolved.get(w.raw) ?? []), p.name]);
    const ids = new Set(resolved.filter((w) => w.id).map((w) => w.id!));
    if (ids.size === 0) continue;
    if (ids.size > 1) {
      conflicts.push(`${p.name}: ${resolved.map((w) => `${w.src}="${w.raw}"`).join(", ")}`);
      continue;
    }
    const id = [...ids][0]!;
    chosen.set(p._id, id);
    assign.push({ name: p.name, profile: nameOf.get(id)!, from: resolved.filter((w) => w.id).map((w) => w.src).join("+") });
  }

  console.log(`${apply ? "APPLYING" : "Dry run"}: ${projects.length} projects have no profile.`);
  console.log(`New profiles to create: ${toCreate.join(", ") || "none"}. Aliases to add: ${toAlias.map((a) => `${a.alias} -> ${nameOf.get(a.id)}`).join(", ") || "none"}`);
  const by = new Map<string, number>();
  for (const a of assign) by.set(a.profile, (by.get(a.profile) ?? 0) + 1);
  console.log(`Would set a profile on ${assign.length}: ${[...by].map(([k, v]) => `${k} ${v}`).join(", ")}`);
  if (!apply) console.log(assign.map((a) => `  ${a.name} -> ${a.profile} (${a.from})`).join("\n"));
  if (conflicts.length) console.log(`Sources disagree (left alone, ${conflicts.length}):\n  ${conflicts.join("\n  ")}`);
  if (unresolved.size) console.log(`Names found but not a known profile (left alone):\n  ${[...unresolved].map(([k, v]) => `"${k}" (${v.length}): ${v.slice(0, 3).join("; ")}`).join("\n  ")}`);
  console.log(`No profile written anywhere: ${nothing} projects (need your other sheet).`);
  if (!apply) return console.log("Nothing written. Add --apply to save it.");

  const created = new Map<string, string>();
  for (const n of toCreate) {
    const aliases = Object.entries(ALIASES).filter(([, t]) => normalizeName(t) === normalizeName(n)).map(([a]) => a);
    const doc = await ServiceUpworkProfile.create({ name: n, aliases });
    created.set(`new:${n}`, String(doc._id));
  }
  for (const a of toAlias) await ServiceUpworkProfile.updateOne({ _id: a.id }, { $addToSet: { aliases: a.alias } });
  let set = 0;
  for (const [projectId, id] of chosen) {
    await ServiceProject.updateOne({ _id: projectId, upworkProfileId: null }, { $set: { upworkProfileId: created.get(id) ?? id } });
    set++;
  }
  await recordServiceAudit("projects.map_profiles", { set, created: toCreate, aliases: toAlias.length, via: "scripts/map-project-profiles.ts" });
  console.log(`Done: ${set} projects updated.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
