/**
 * Sets team members' pay from a JSON file kept OUTSIDE the repository (salaries must not be committed):
 *
 *   { "salaries": { "<name>": 45000, ... },                         monthly salary in INR
 *     "perLive":  { "<name>": { "theme": 10000, "preset": 5000 } } } commission per live theme / preset, no salary
 *
 * A name is matched to a team member by full name or alias (case and spacing ignored), else by a first name only one member has,
 * else by a last name only one member has. The dry run lists every match (and every name it could not place) so the owner checks
 * them before writing.
 *
 *   npx tsx --env-file=.env.production.local scripts/set-pay.ts <file.json>           # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-pay.ts <file.json> --apply   # writes (owner runs it)
 */
import { readFileSync } from "node:fs";
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { TeamMember } from "../models/team-member";

const apply = process.argv.includes("--apply");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));

type Member = { _id: unknown; name: string; designation: string; aliases?: string[] };
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Returns the member, or a reason it could not be placed. */
export function matchMember(key: string, members: Member[]): Member | string {
  const k = norm(key);
  const exact = members.filter((m) => norm(m.name) === k || (m.aliases ?? []).some((a) => norm(a) === k));
  if (exact.length === 1) return exact[0];
  const words = k.split(" ");
  const byFirst = members.filter((m) => norm(m.name).split(" ")[0] === words[0]);
  if (words.length === 1 && byFirst.length === 1) return byFirst[0];
  const byLast = members.filter((m) => norm(m.name).split(" ").at(-1) === words.at(-1));
  if (words.length > 1 && byLast.length === 1) return byLast[0];
  const candidates = [...new Set([...exact, ...byFirst, ...(words.length > 1 ? byLast : [])])];
  return candidates.length > 1 ? `ambiguous: ${candidates.map((m) => m.name).join(", ")}` : "no team member with that name";
}

async function main() {
  if (!file) throw new Error("Usage: set-pay.ts <file.json> [--apply]");
  const input = JSON.parse(readFileSync(file, "utf8")) as { salaries?: Record<string, number>; perLive?: Record<string, { theme?: number; preset?: number }> };
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const members = await TeamMember.find().select("name designation aliases").lean<Member[]>();

  const writes: { member: Member; set: Record<string, unknown>; label: string }[] = [];
  const problems: string[] = [];
  for (const [key, amount] of Object.entries(input.salaries ?? {})) {
    const m = matchMember(key, members);
    if (typeof m === "string") problems.push(`"${key}": ${m}`);
    else writes.push({ member: m, set: { payModel: "salary", monthlySalary: Math.round(amount), perLiveTheme: null, perLivePreset: null }, label: `salary ${amount}/month` });
  }
  for (const [key, rates] of Object.entries(input.perLive ?? {})) {
    const m = matchMember(key, members);
    if (typeof m === "string") problems.push(`"${key}": ${m}`);
    else writes.push({ member: m, set: { payModel: "per_live", monthlySalary: null, perLiveTheme: rates.theme ?? null, perLivePreset: rates.preset ?? null }, label: `commission ${rates.theme ?? 0} per live theme, ${rates.preset ?? 0} per live preset` });
  }
  const twice = writes.filter((w, i) => writes.findIndex((x) => String(x.member._id) === String(w.member._id)) !== i);
  for (const w of twice) problems.push(`${w.member.name} is matched by two names`);

  for (const w of writes) console.log(`  ${w.member.name} (${w.member.designation}): ${w.label}`);
  if (problems.length) console.log(`\nNot placed (fix the name in the file):\n  ${problems.join("\n  ")}`);
  const unpaid = members.filter((m) => !writes.some((w) => String(w.member._id) === String(m._id)));
  if (unpaid.length) console.log(`\nTeam members not in the file (left as they are): ${unpaid.map((m) => m.name).join(", ")}`);

  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to write.");
    return;
  }
  if (problems.length) throw new Error("Some names could not be placed; fix them first (nothing was written).");
  for (const w of writes) await TeamMember.updateOne({ _id: w.member._id }, { $set: w.set });
  // The record says who was changed, not the amounts.
  await AdminAudit.create({ action: "team.set_pay", detail: { members: writes.map((w) => w.member.name) } });
  console.log(`\nDone: ${writes.length} team members.`);
}

if (process.argv[1]?.includes("set-pay")) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  );
}
