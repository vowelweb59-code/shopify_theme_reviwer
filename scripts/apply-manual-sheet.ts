/**
 * Brings each theme's Theme Design & Development project in line with the owner's manual sheet, which is correct up to 12 Oct 2026
 * (owner, 2026-11-14). Two things only, and only ever adds:
 *
 *  1. Fixed design / development days = the sheet's days minus what the Chat reports already hold up to 12 Oct (designers' reports
 *     = design, other non-manager reports = development; 8.5 h = 1 day), because the project's total is fixed days PLUS reports
 *     (lib/projects/loadTotals.ts): the sheet's figure then holds exactly, and later reports add on top. Never below 0. A theme
 *     with a blank in the sheet, or 0, is left alone.
 *  2. When the sheet names exactly ONE designer (developer) for a theme, that person is recorded as having worked all the fixed
 *     design (development) days, so they are priced in the cost (designDaysBy / developmentDaysBy; owner: "the 32 days in design
 *     were all worked by Junaid"). Two or more people: not split, the days stay unpriced until the owner gives the split.
 *  3. Rejections (owner, 2026-11-14: "yes"): where the sheet shows MORE rejections than the app counts, earlier rejected rounds are
 *     added until they agree (Noble, Grocery, Nexus: 2; Velocity, Apollo: 1). A round added this way has no date, stage or type, and
 *     its members are the sheet's people for that theme (so their rejection counts rise). Never removes a round: the sheet is older
 *     than the app (Adorn: sheet 0, app 2; Legacy: sheet 0, app 1, rejected after 12 Oct).
 *  4. People the sheet names that are not on the project yet are added (role empty); nobody is removed.
 *
 * Statuses, portals and rejection counts are NOT touched (the sheet is older than the app for those).
 * Old values are saved in admin_audit_log (projects.apply_manual_sheet).
 *
 *   npx tsx --env-file=.env.production.local scripts/apply-manual-sheet.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/apply-manual-sheet.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { rejectionCount } from "../lib/projects/rounds";
import { Project } from "../models/project";
import { TeamMember } from "../models/team-member";
import { Theme } from "../models/theme";

const apply = process.argv.includes("--apply");
const CUTOFF = new Date("2026-10-12T23:59:59.999Z");
const DAY_MIN = 510;

// app theme name, project name in the app, designers, developers (sheet spellings), sheet design days, sheet development days
const SHEET: [string, string, string[], string[], number | null, number | null][] = [
  ["Adorn", "Adorn", ["Noman"], ["Shailesh"], null, 100],
  ["Flaunt", "Flaunt", ["Noman"], ["Shailesh"], null, null],
  ["Dynamic", "Dynamic", ["Junaid"], ["Shreyas"], 25, 45],
  ["Renovate", "Renovate", ["Junaid"], ["Shailesh"], 22, 36],
  ["Voltix", "Voltix", ["Junaid"], ["Shreyas"], 31, 51],
  ["Velocity", "Velocity", ["Junaid"], ["Shreyas"], null, 31],
  ["Zeal", "Zeal", ["Pranay"], ["Ehtesham"], null, null],
  ["Noble", "Noble", ["Pranay", "Mussadique"], ["Ehtesham"], null, 84],
  ["Grocery", "Grocery", ["Pranay", "Mussadique", "Junaid"], ["Aarti", "Shailesh"], null, 36],
  ["Breeze", "Breeze", ["Mussadique", "Noman", "Pranay"], ["Shailesh"], 27, 35],
  ["Gravity", "Gravity", ["Noman", "Pranay"], ["Ehtesham"], 23, 37],
  ["Soft", "Soft", ["Mussadique"], ["Ehtesham"], 13, 41],
  ["Rare", "Rare", ["Pranay"], ["Ehtesham", "Shailesh"], 24, 48], // the sheet's "Aspire"
  ["Kombat", "Kombat", ["Pranay"], ["Aarti"], 11, 27],
  ["Pretty", "Pretty", ["Mussadique", "Pranay"], [], 18, null],
  ["Nexus", "Nexus", ["Mussadique"], ["Ehtesham"], null, 38],
  ["Loyal", "Loyal 1", ["Mussadique"], ["Ehtesham"], 22, 32],
  ["Apollo", "Apollo", ["Junaid"], ["Shailesh"], 13, 41],
  ["Auto", "Automobile", ["Mussadique", "Pranay"], [], 30, null],
  ["Legacy", "Legacy 1", ["Mussadique"], ["Ehtesham"], 15, 38],
];

// The sheet's first names to the team member (Pranay is Pranay Nimje, the designer; the other Pranay is not on these themes).
// Rejections the sheet shows per theme (as of 12 Oct); only themes where it is higher than the app are acted on.
const REJECTIONS: Record<string, number> = { Noble: 2, Grocery: 2, Nexus: 2, Velocity: 1, Apollo: 1 };

const PERSON: Record<string, string> = {
  noman: "noaman ather",
  mussadique: "musaddique afsar",
  aarti: "arti mishra",
  pranay: "pranay nimje",
  ehtesham: "ehtesham deshmukh",
  shailesh: "shailesh parshionikar",
  shreyas: "shreyas dolaskar",
  junaid: "junaid ahmad",
};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const r1 = (n: number) => Math.round(n * 10) / 10;

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const members = await TeamMember.find().select("name designation inactive").lean<{ _id: unknown; name: string; designation: string; inactive?: boolean }[]>();
  const byName = new Map(members.map((m) => [norm(m.name), m]));
  const memberById = new Map(members.map((m) => [String(m._id), m]));
  const themes = await Theme.find().select("name").lean<{ _id: unknown; name: string }[]>();
  const audit: Record<string, unknown>[] = [];

  for (const [themeName, projectName, designers, developers, sheetDesign, sheetDev] of SHEET) {
    const theme = themes.find((t) => norm(t.name) === norm(themeName));
    // The project is found by its own name (a project may hang on another theme row: Dynamic and Flaunt sit on Adorn's).
    const project = await Project.findOne({ name: new RegExp(`^${projectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), type: { $in: ["theme_development", null] } })
      .select("name themeId status rounds designDays developmentDays designDaysBy developmentDaysBy members")
      .lean<{ _id: unknown; name: string; themeId: unknown; designDays: number | null; developmentDays: number | null; designDaysBy?: unknown; developmentDaysBy?: unknown; status?: string | null; rounds?: { status: string }[]; members: { memberId: unknown; role?: string | null }[] } | null>();
    if (!project) {
      console.log(`${themeName}: no project "${projectName}" — skipped`);
      continue;
    }
    console.log(`── ${projectName}`);

    // What the reports hold up to the cutoff. Reports of the project's own theme row (Dynamic's project's theme is Adorn's row, so look up by name too).
    const themeIds = [theme?._id, project.themeId].filter(Boolean);
    const reports = await ChatReport.find({ themeId: { $in: themeIds }, kind: "theme", status: "ok", date: { $lte: CUTOFF } }).select("memberId minutes themeName").lean<{ memberId: unknown; minutes: number; themeName: string }[]>();
    let design = 0;
    let dev = 0;
    for (const r of reports) {
      const m = r.memberId ? memberById.get(String(r.memberId)) : null;
      const desig = (m?.designation ?? "").toLowerCase();
      if (desig.includes("manager")) continue;
      if (/designer|ui\/?ux/.test(desig)) design += r.minutes;
      else dev += r.minutes;
    }

    const update: Record<string, unknown> = {};
    const want = (label: string, sheet: number | null, reportsMin: number, current: number | null, field: string) => {
      if (sheet === null || sheet === 0) return;
      const fixed = Math.max(0, r1(sheet - reportsMin / DAY_MIN));
      if (current !== null && Math.abs(current - fixed) < 0.05) return console.log(`   ${label}: fixed days already ${fixed}`);
      console.log(`   ${label}: sheet ${sheet} - reports ${r1(reportsMin / DAY_MIN)} = fixed ${fixed} d   (now ${current ?? "none"})`);
      update[field] = fixed;
    };
    want("design", sheetDesign, design, project.designDays ?? null, "designDays");
    want("development", sheetDev, dev, project.developmentDays ?? null, "developmentDays");

    // One named person for a role = they worked all its fixed days.
    const sole = (names: string[]) => {
      const ids = [...new Set(names.map((n) => byName.get(PERSON[norm(n)] ?? "")).filter((m): m is NonNullable<typeof m> => Boolean(m)).map((m) => String(m._id)))];
      return names.length === 1 && ids.length === 1 ? ids[0] : null;
    };
    const designBy = sole(designers);
    const devBy = sole(developers);
    const dayDays = { design: update.designDays ?? project.designDays ?? sheetDesign, dev: update.developmentDays ?? project.developmentDays ?? sheetDev };
    if (designBy && dayDays.design && String(project.designDaysBy ?? "") !== designBy) {
      update.designDaysBy = designBy;
      console.log(`   design days worked by ${memberById.get(designBy)?.name}`);
    }
    if (devBy && dayDays.dev && String(project.developmentDaysBy ?? "") !== devBy) {
      update.developmentDaysBy = devBy;
      console.log(`   development days worked by ${memberById.get(devBy)?.name}`);
    }

    const have = new Set((project.members ?? []).map((m) => String(m.memberId)));
    const add: { memberId: unknown; name: string }[] = [];
    for (const first of [...designers, ...developers]) {
      const m = byName.get(PERSON[norm(first)] ?? "");
      if (!m) {
        console.log(`   person "${first}": no team member found — not added`);
        continue;
      }
      if (m.inactive || have.has(String(m._id)) || add.some((a) => String(a.memberId) === String(m._id))) continue;
      add.push({ memberId: m._id, name: m.name });
    }
    if (add.length) console.log(`   add to the team: ${add.map((a) => a.name).join(", ")}`);

    // Rejected rounds the sheet shows that the app does not count.
    const missingRounds = Math.max(0, (REJECTIONS[themeName] ?? 0) - rejectionCount({ status: project.status ?? null, rounds: project.rounds }));
    const roundMembers = [...new Set([...designers, ...developers].map((n) => byName.get(PERSON[norm(n)] ?? "")).filter((m): m is NonNullable<typeof m> => Boolean(m) && !m!.inactive).map((m) => String(m._id)))];
    if (missingRounds > 0) console.log(`   rejections: sheet ${REJECTIONS[themeName]}, app ${rejectionCount({ status: project.status ?? null, rounds: project.rounds })} -> add ${missingRounds} earlier rejected round(s) with ${roundMembers.length} people`);

    if (Object.keys(update).length === 0 && add.length === 0 && missingRounds === 0) {
      console.log("   nothing to change");
      continue;
    }
    audit.push({ project: project.name, before: { designDays: project.designDays, developmentDays: project.developmentDays, designDaysBy: project.designDaysBy ?? null, developmentDaysBy: project.developmentDaysBy ?? null }, after: update, added: add.map((a) => a.name), roundsAdded: missingRounds });
    if (apply) {
      const ops: Record<string, unknown> = {};
      if (Object.keys(update).length) ops.$set = update;
      const push: Record<string, unknown> = {};
      if (add.length) push.members = { $each: add.map((a) => ({ memberId: a.memberId, role: null })) };
      if (missingRounds > 0) {
        push.rounds = { $each: Array.from({ length: missingRounds }, () => ({ status: "rejected", rejectionStage: null, rejectionType: null, rejectedOn: null, designDays: null, developmentDays: null, members: roundMembers.map((id) => ({ memberId: id, role: null })), note: "Added from the owner's manual sheet (rejection count up to 12 Oct 2026)." })), $position: 0 };
      }
      if (Object.keys(push).length) ops.$push = push;
      await Project.updateOne({ _id: project._id }, ops);
    }
  }
  if (apply && audit.length > 0) await AdminAudit.create({ action: "projects.apply_manual_sheet", detail: { changes: audit } });
  console.log(`\n${audit.length} project(s) ${apply ? "changed" : "would change"}.${apply ? "" : " Dry run: nothing written. Pass --apply to do it."}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
