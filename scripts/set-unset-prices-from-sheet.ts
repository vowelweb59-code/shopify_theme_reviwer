import { readFileSync } from "node:fs";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { workableMinutes } from "@/lib/service/hours/fixed-budget";
import { matchProfile } from "@/lib/service/import/profile-match";
import { matchClient } from "@/lib/service/revenue/match";
import { ServiceUpworkProfile } from "@/models/service-upwork";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";

// "Not set" projects (owner, 2026-11-18): a contract with no hourly rate, no weekly hours and no fixed price, so the overview cannot say
// Timer or Fixed and Closed "Taken" shows a dash. Where the sales sheet has an amount for the client (the JSON made by the revenue
// import, kept outside the repo; read at run time, never written into code or notes), the project becomes FIXED with that total as its
// price, as the Direct projects did. Only EXACT client-name matches are used (approximate matches are listed for a person to check),
// a client with more than one project is split by the sheet's PROFILE column (owner, 2026-11-18: "Angela was first on Zainab then Batul"; "Sam Taye" Aliasger B / Ashfaque): each project gets the rows whose profile is its own, and a project that already has a rate, weekly
// hours or price is never touched. Dry run unless --apply (the owner runs it); audit `projects.set_unset_prices`.
// `--include-approximate` also uses a unique approximate match (sheet "Saad M" for the client "Saad Malick"); the owner asked for it on
// 2026-11-18 ("set those that you can"), and `matchClient` only returns one when exactly one client fits.
//   npx tsx --env-file=.env.production.local scripts/set-unset-prices-from-sheet.ts [--sheet <revenue-taken.json>] [--include-approximate] [--apply]
/** Not Digital Marketing work (owner, 2026-11-18: "Ashfaque one was for Front End"): never priced from the DM sales sheet. */
const SKIP = new Set(["Sam Taye – Ashfaque"]);

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const includeApprox = argv.includes("--include-approximate");
const sheetPath = argv.includes("--sheet") ? argv[argv.indexOf("--sheet") + 1]! : `${process.env.USERPROFILE ?? ""}/Downloads/revenue-taken.json`;

type Row = { _id: string; name: string; status: string; clientId: string | null; upworkProfileId: string | null; contract: { type: string; hourlyRateCents: number | null; weeklyLimitMinutes: number | null; fixedPriceCents: number | null } | null };

async function main() {
  await connectToDatabase();
  const all = await ServiceProject.find().select("name status clientId upworkProfileId contract").lean<Row[]>();
  const perClient = new Map<string, number>();
  for (const p of all) if (p.clientId) perClient.set(p.clientId, (perClient.get(p.clientId) ?? 0) + 1);
  const unset = all.filter((p) => p.contract && p.contract.type !== "FIXED" && p.contract.hourlyRateCents == null && p.contract.weeklyLimitMinutes == null && p.contract.fixedPriceCents == null);
  const clients = await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const clientNames = clients.map((c) => ({ id: c._id, names: [c.name, ...(c.aliases ?? [])] }));
  const j = JSON.parse(readFileSync(sheetPath, "utf8")) as unknown;
  const rows = (Array.isArray(j) ? j : (j as { rows: unknown[] }).rows) as Array<{ client: string; total: number | string }>;
  const sheet = new Map<string, { total: number; exact: boolean; names: Set<string> }>();
  for (const r of rows) {
    const m = matchClient(r.client, clientNames);
    if (!m.clientId) continue;
    const s = sheet.get(m.clientId) ?? { total: 0, exact: true, names: new Set<string>() };
    s.total += Number(r.total) || 0;
    if (m.how !== "exact") s.exact = false;
    s.names.add(r.client);
    sheet.set(m.clientId, s);
  }
  const profiles = (await ServiceUpworkProfile.find().lean<Array<{ _id: string; name: string; aliases: string[] }>>()).map((x) => ({ id: x._id, name: x.name, aliases: x.aliases ?? [] }));
  const rowsByClient = new Map<string, Array<{ total: number; profileId: string | null }>>();
  for (const r of rows) {
    const m = matchClient(r.client, clientNames);
    if (!m.clientId) continue;
    const prof = (r as { profile?: string }).profile;
    rowsByClient.set(m.clientId, [...(rowsByClient.get(m.clientId) ?? []), { total: Number(r.total) || 0, profileId: prof ? matchProfile(prof, profiles) : null }]);
  }
  const att = await loadAttribution();
  const minutes = new Map<string, number>();
  const ids = new Set(unset.map((p) => p._id));
  for (const e of await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } }).select("projectId clientId minutes allocations").lean<
    Array<{ projectId: string | null; clientId: string | null; minutes: number; allocations: Array<{ projectId: string; minutes: number }> }>
  >()) {
    const parts: Array<[string | null, number]> = e.allocations?.length ? e.allocations.map((a) => [a.projectId, a.minutes]) : [[projectOf(e, att.owner) ?? e.projectId, e.minutes]];
    for (const [pid, m] of parts) if (pid && ids.has(pid)) minutes.set(pid, (minutes.get(pid) ?? 0) + m);
  }

  const todo: Array<{ id: string; name: string; cents: number }> = [];
  const fuzzy: string[] = [];
  const shared: string[] = [];
  let noSheet = 0;
  for (const p of unset) {
    if (SKIP.has(p.name)) { console.log(`  ${p.name}: front-end work, not priced (owner)`); continue; }
    const s = p.clientId ? sheet.get(p.clientId) : undefined;
    if (!s || s.total <= 0) { noSheet++; continue; }
    const isShared = (perClient.get(p.clientId!) ?? 0) > 1;
    if (!s.exact && !includeApprox) { fuzzy.push(`${p.name}  <-  sheet "${[...s.names].join(" / ")}"`); continue; }
    let total = s.total;
    if (isShared) {
      total = p.upworkProfileId ? (rowsByClient.get(p.clientId!) ?? []).filter((x) => x.profileId === p.upworkProfileId).reduce((n, x) => n + x.total, 0) : 0;
      if (total <= 0) { shared.push(p.name); continue; }
    }
    const cents = Math.round(total * 100);
    const used = (minutes.get(p._id) ?? 0) / 60;
    const workable = (workableMinutes(cents) ?? 0) / 60;
    todo.push({ id: p._id, name: p.name, cents });
    console.log(`  ${p.name.slice(0, 34).padEnd(34)} [${p.status.slice(0, 4)}]${s.exact ? "" : " ~"}${isShared ? " (split by profile)" : ""} $${(cents / 100).toFixed(2).padStart(9)}  hours ${used.toFixed(1).padStart(6)} of ${workable.toFixed(1).padStart(6)} workable${used > workable ? "  OVER" : ""}`);
  }
  console.log(`${apply ? "APPLYING" : "Dry run"}: ${unset.length} projects are Not set. Would set ${todo.length} to FIXED at the sheet total. Left alone: ${noSheet} with no sheet amount, ${shared.length} sharing a client with another project and no sheet rows under their own profile (${shared.join("; ") || "-"}), ${fuzzy.length} with only an approximate name match:`);
  for (const f of fuzzy) console.log(`    ${f}`);
  if (!apply) return console.log("Nothing written. Add --apply to save it.");
  for (const t of todo) await ServiceProject.updateOne({ _id: t.id, "contract.fixedPriceCents": null }, { $set: { "contract.type": "FIXED", "contract.fixedPriceCents": t.cents } });
  await recordServiceAudit("projects.set_unset_prices", { count: todo.length, via: "scripts/set-unset-prices-from-sheet.ts" });
  console.log(`Done: ${todo.length} projects updated.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
