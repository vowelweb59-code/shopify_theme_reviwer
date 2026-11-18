import { readFileSync } from "node:fs";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { workableMinutes } from "@/lib/service/hours/fixed-budget";
import { dmMatch } from "@/lib/service/dm-members";
import { normName } from "@/lib/service/revenue/match";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";

// Owner, 2026-11-18: the Direct projects are fixed-price. Each project below gets contract type FIXED and a fixed price: the total the
// sales sheet recorded for its client (the JSON made by the revenue import, kept outside the repo; the amounts are read at run time and
// never written into code or notes), or, where the owner gave one, that budget. A project that already has a fixed price is left alone,
// so the script can be run again. Its hourly rate is cleared (a fixed project with a rate is billed by the hours instead).
// Dry run unless --apply (the owner runs it); audit `projects.set_direct_fixed_prices`.
//   npx tsx --env-file=.env.production.local scripts/set-direct-fixed-prices.ts [--sheet <revenue-taken.json>] [--apply]
/** project name -> the client name(s) the sheet uses for it (summed). */
const SHEET_NAMES: Record<string, string[]> = {
  "Kris Brown": ["Kris Brown"],
  "Luke Walsh": ["Luke Walsh"],
  "Swarnima Sanganeri": ["Swarnima"],
  "Aman Malhotra": ["Aman Malhotra"],
  "Anthony Thomas": ["Anthony Thomas"],
  "Cory Lawler": ["Cory"],
  "Dave Woolsey": ["Dave Woolsey"],
  "Haim Ifrach": ["Haimn"],
  "Maria Petridou": ["Maria Petridou"],
  "Sangeeta Lund": ["Sangeeta", "Sangeeta Lund"],
  "Thiago Rabello": ["Thiago Rabello"],
};
/** Budgets the owner stated, in USD cents. Nikhil Gosavi: fixed budget INR 5,000 (owner, 2026-11-18), about $58 at the rate of the sheet's April 2026 row for him. */
const EXPLICIT_CENTS: Record<string, number> = {
  "Nikhil Gosavi": 5800,
  // Owner, 2026-11-18: Doug Laugher $1,800 (the budget is spent at $15/h, i.e. price / $15 workable hours), vaxtanggeradze $250 taken, Ajmera Tyres $172.
  "Doug Laugher": 180000,
  vaxtanggeradze: 25000,
  "Ajmera Tyres": 17200,
};
/** Projects whose price is re-set from the sheet even when one is already saved (owner, 2026-11-18: Sam Taye's $530 under the Ashfaque profile goes to the Sam Taye project that was worked on, "Aliasger B"). */
const OVERRIDE_FROM_SHEET: Record<string, string[]> = { "Sam Taye – Aliasger B": ["Sam Taye"] };

/**
 * One sheet client, several projects (owner, 2026-11-18, Morten Minde): the sheet amount is the Digital Marketing team's money only (the
 * other teams' work has no amount), so it is shared between the projects in proportion to the DM team's own hours on each.
 */
const DM_SPLIT: Record<string, string[]> = { "Morten Minde": ["Morten – Marketplace", "Morten – WordPress"] };

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const sheetPath = argv.includes("--sheet") ? argv[argv.indexOf("--sheet") + 1]! : `${process.env.USERPROFILE ?? ""}/Downloads/revenue-taken.json`;

async function main() {
  await connectToDatabase();
  const names = [...Object.keys(SHEET_NAMES), ...Object.keys(EXPLICIT_CENTS), ...Object.values(DM_SPLIT).flat(), ...Object.keys(OVERRIDE_FROM_SHEET)];
  const projects = await ServiceProject.find({ name: { $in: names } }).select("name status clientId contract").lean<
    Array<{ _id: string; name: string; status: string; clientId: string | null; contract: { type: string; fixedPriceCents: number | null; hourlyRateCents: number | null } | null }>
  >();
  const j = JSON.parse(readFileSync(sheetPath, "utf8")) as unknown;
  const rows = (Array.isArray(j) ? j : (j as { rows: unknown[] }).rows) as Array<{ client: string; total: number | string }>;
  const sheetTotal = (clientNames: string[]) => {
    const want = new Set(clientNames.map(normName));
    return rows.filter((r) => want.has(normName(r.client))).reduce((n, r) => n + (Number(r.total) || 0), 0);
  };
  const att = await loadAttribution();
  const minutes = new Map<string, number>();
  for (const e of await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, clientId: { $in: projects.map((p) => p.clientId) } }).select("projectId clientId minutes allocations").lean<
    Array<{ projectId: string | null; clientId: string | null; minutes: number; allocations: Array<{ projectId: string; minutes: number }> }>
  >()) {
    const parts: Array<[string | null, number]> = e.allocations?.length ? e.allocations.map((a) => [a.projectId, a.minutes]) : [[projectOf(e, att.owner) ?? e.projectId, e.minutes]];
    for (const [pid, m] of parts) if (pid) minutes.set(pid, (minutes.get(pid) ?? 0) + m);
  }

  // The DM team's minutes per project (for DM_SPLIT).
  const senderName = new Map((await ServiceChatSender.find().select("externalId displayName").lean<Array<{ externalId: string; displayName: string }>>()).map((x) => [x.externalId, x.displayName]));
  const dmMinutes = new Map<string, number>();
  for (const e of await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, clientId: { $in: projects.map((p) => p.clientId) } }).select("projectId clientId minutes allocations senderExternalId").lean<
    Array<{ projectId: string | null; clientId: string | null; minutes: number; allocations: Array<{ projectId: string; minutes: number }>; senderExternalId: string }>
  >()) {
    if (dmMatch(senderName.get(e.senderExternalId)) === null) continue;
    const parts: Array<[string | null, number]> = e.allocations?.length ? e.allocations.map((a) => [a.projectId, a.minutes]) : [[projectOf(e, att.owner) ?? e.projectId, e.minutes]];
    for (const [pid, m] of parts) if (pid) dmMinutes.set(pid, (dmMinutes.get(pid) ?? 0) + m);
  }
  const splitCents = new Map<string, number>();
  for (const [client, projNames] of Object.entries(DM_SPLIT)) {
    const ps = projNames.map((n) => projects.find((x) => x.name === n)).filter((x): x is NonNullable<typeof x> => !!x);
    const sum = ps.reduce((n, x) => n + (dmMinutes.get(x._id) ?? 0), 0);
    const total = sheetTotal([client]);
    if (!sum || !total) continue;
    for (const x of ps) splitCents.set(x.name, Math.round(total * 100 * ((dmMinutes.get(x._id) ?? 0) / sum)));
  }

  const usd = (c: number | null | undefined) => (c == null ? "none" : `$${(c / 100).toFixed(2)}`);
  console.log(`${apply ? "APPLYING" : "Dry run"}:`);
  const todo: Array<{ id: string; name: string; cents: number; override: boolean }> = [];
  for (const name of names) {
    const p = projects.filter((x) => x.name === name);
    if (p.length !== 1) { console.log(`  ${name}: ${p.length} projects match; skipped`); continue; }
    const proj = p[0]!;
    const override = !!OVERRIDE_FROM_SHEET[name];
    if (proj.contract?.fixedPriceCents != null && !override) { console.log(`  ${name}: already has a price (${usd(proj.contract.fixedPriceCents)}); left alone`); continue; }
    const cents = EXPLICIT_CENTS[name] ?? splitCents.get(name) ?? Math.round(sheetTotal(OVERRIDE_FROM_SHEET[name] ?? SHEET_NAMES[name] ?? []) * 100);
    if (override && proj.contract?.fixedPriceCents === cents) { console.log(`  ${name}: already ${usd(cents)}; left alone`); continue; }
    if (!cents) { console.log(`  ${name}: no amount found; skipped`); continue; }
    const used = (minutes.get(proj._id) ?? 0) / 60;
    const workable = (workableMinutes(cents) ?? 0) / 60;
    console.log(`  ${name} [${proj.status}]: ${proj.contract?.type} rate ${usd(proj.contract?.hourlyRateCents)} -> FIXED price ${usd(cents)} (${EXPLICIT_CENTS[name] ? "owner's budget" : override ? "sheet, all Sam Taye rows" : splitCents.has(name) ? `sheet, split by DM team hours (${((dmMinutes.get(proj._id) ?? 0) / 60).toFixed(1)} h)` : "sheet"}), rate cleared. Hours ${used.toFixed(1)} of ${workable.toFixed(1)} workable${used > workable ? ", OVER by " + (used - workable).toFixed(1) + " h" : ""}`);
    todo.push({ id: proj._id, name, cents, override });
  }
  if (!apply) return console.log("Nothing written. Add --apply to save it.");
  for (const t of todo) await ServiceProject.updateOne(t.override ? { _id: t.id } : { _id: t.id, "contract.fixedPriceCents": null }, { $set: { "contract.type": "FIXED", "contract.fixedPriceCents": t.cents, "contract.hourlyRateCents": null } });
  await recordServiceAudit("projects.set_direct_fixed_prices", { projects: todo.map((t) => t.name), via: "scripts/set-direct-fixed-prices.ts" });
  console.log(`Done: ${todo.length} projects updated.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
