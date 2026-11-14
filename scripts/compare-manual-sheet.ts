/**
 * Read-only: compares the owner's manual theme sheet (2026-11-14: portal, designers, developers, rejections, status, development and
 * design days per theme) with what the app holds for each theme's Theme Design & Development project, and prints every difference.
 * Nothing is written; what to change is decided from this list.
 *
 *   npx tsx --env-file=.env.production.local scripts/compare-manual-sheet.ts
 */
import { connectToDatabase } from "../lib/db/connect";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { TeamMember } from "../models/team-member";
import { Theme } from "../models/theme";

type Row = {
  portal: string;
  theme: string; // name in the sheet
  designers: string[];
  developers: string[];
  rejections: number | null; // null = "-" / none
  status: string;
  devDays: number | null;
  designDays: number | null;
};

const R = (portal: string, theme: string, designers: string[], developers: string[], rejections: number | null, status: string, devDays: number | null, designDays: number | null): Row => ({ portal, theme, designers, developers, rejections, status, devDays, designDays });

const SHEET: Row[] = [
  R("Vowel Web", "Adorn", ["Noman"], ["Shailesh"], 0, "Live", 100, null),
  R("Vowel Web", "Flaunt", ["Noman"], ["Shailesh"], 0, "Live", null, null),
  R("Vowel Web", "Dynamic", ["Junaid"], ["Shreyas"], 0, "Live", 45, 25),
  R("Vowel Web", "Renovate", ["Junaid"], ["Shailesh"], 0, "Live", 36, 22),
  R("Vowel Web", "Voltix", ["Junaid"], ["Shreyas"], 1, "Error Given", 51, 31),
  R("Vowel Web", "Velocity", ["Junaid"], ["Shreyas"], 1, "Rejected", 31, null),
  R("Fresco Solutions", "Zeal", ["Pranay"], ["Ehtesham"], 0, "Live", null, null),
  R("Fresco Solutions", "Noble", ["Pranay", "Mussadique"], ["Ehtesham"], 2, "Live", 84, null),
  R("Fresco Solutions", "Grocery", ["Pranay", "Mussadique", "Junaid"], ["Aarti", "Shailesh"], 2, "Rejected", 36, null),
  R("Fresco Solutions", "Breeze", ["Mussadique", "Noman", "Pranay"], ["Shailesh"], 1, "2 Version Under Development", 35, 27),
  R("Themeshopy", "Gravity", ["Noman", "Noman", "Pranay"], ["Ehtesham"], 2, "Live", 37, 23),
  R("Themeshopy", "Soft", ["Mussadique"], ["Ehtesham"], 0, "Live", 41, 13),
  R("Themeshopy", "Aspire", ["Pranay"], ["Ehtesham", "Shailesh"], null, "Under Review", 48, 24),
  R("Themeshopy", "Kombat", ["Pranay"], ["Aarti"], null, "Under Development", 27, 11),
  R("Themeshopy", "Pretty", ["Mussadique", "Pranay"], [], null, "Under Designing", 0, 18),
  R("SAMS", "Nexus", ["Mussadique"], ["Ehtesham"], 2, "Live", 38, null),
  R("SAMS", "Loyal", ["Mussadique"], ["Ehtesham"], 1, "Rejected", 32, 22),
  R("SAMS", "Apollo", ["Junaid"], ["Shailesh"], 1, "Rejected", 41, 13),
  R("SAMS", "Auto", ["Mussadique", "Pranay"], [], null, "Design Completed", null, 30),
  R("Flex", "Legacy", ["Mussadique"], ["Ehtesham"], null, "Theme Uploaded", 38, 15),
];

const THEME_ALIAS: Record<string, string> = { Aspire: "Rare" }; // Aspire's work is Rare's (owner, 2026-11-12)
const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  under_designing: "Under Designing",
  design_completed: "Design Completed",
  under_development: "Under Development",
  theme_uploaded: "Theme Uploaded",
  under_review: "Under Review",
  error_given: "Error Given",
  live: "Live",
  rejected: "Rejected",
};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const ALIAS: Record<string, string> = { noman: "noaman", mussadique: "musaddique", aarti: "arti", aaquib: "aaqib" };
const first = (s: string) => { const f = norm(s).split(" ")[0]; return ALIAS[f] ?? (f === "aaquib" ? "aaqib" : f); };

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`Read-only against ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const members = await TeamMember.find().select("name designation").lean<{ _id: unknown; name: string; designation: string }[]>();
  const memberName = new Map(members.map((m) => [String(m._id), m.name]));
  const themes = await Theme.find().select("name").lean<{ _id: unknown; name: string }[]>();
  let differences = 0;

  for (const row of SHEET) {
    const appName = THEME_ALIAS[row.theme] ?? row.theme;
    const theme = themes.find((t) => norm(t.name) === norm(appName)) ?? themes.find((t) => norm(t.name).startsWith(norm(appName)));
    console.log(`── ${row.theme}${appName !== row.theme ? ` (app: ${appName})` : ""}  [${row.portal}]`);
    if (!theme) {
      console.log("   NOT IN THE APP: no theme row of this name\n");
      differences++;
      continue;
    }
    const projects = await Project.find({ themeId: theme._id, type: { $in: ["theme_development", null] } })
      .select("name portal status rejectionType designDays developmentDays members rounds")
      .lean<{ _id: unknown; name: string; portal?: string | null; status?: string | null; designDays: number | null; developmentDays: number | null; members: { memberId: unknown }[]; rounds: unknown[] }[]>();
    if (projects.length === 0) {
      console.log("   NO Theme Design & Development project\n");
      differences++;
      continue;
    }
    for (const p of projects) {
      const diffs: string[] = [];
      const note = (label: string, sheet: unknown, app: unknown) => {
        const same = String(sheet ?? "-") === String(app ?? "-");
        if (!same) diffs.push(`${label}: sheet ${sheet ?? "-"}  |  app ${app ?? "-"}`);
      };
      note("portal", row.portal, p.portal);
      note("status", row.status, STATUS_LABELS[p.status ?? ""] ?? p.status);
      note("rejections", row.rejections ?? 0, (p.rounds ?? []).length + (p.status === "rejected" ? 1 : 0));
      note("development days (fixed)", row.devDays, p.developmentDays);
      note("design days (fixed)", row.designDays, p.designDays);
      const appMembers = (p.members ?? []).map((m) => memberName.get(String(m.memberId)) ?? "?");
      const sheetPeople = [...new Set([...row.designers, ...row.developers])];
      const missing = sheetPeople.filter((n) => !appMembers.some((a) => first(a) === first(n)));
      const extra = appMembers.filter((a) => !sheetPeople.some((n) => first(a) === first(n)));
      if (missing.length) diffs.push(`not on the project but in the sheet: ${missing.join(", ")}`);
      if (extra.length) diffs.push(`on the project but not in the sheet: ${extra.join(", ")}`);

      // What the reports say, by role, for context (8.5 h = 1 day).
      const reports = await ChatReport.find({ themeId: theme._id, kind: "theme", status: "ok" }).select("memberId minutes").lean<{ memberId: unknown; minutes: number }[]>();
      const byPerson = new Map<string, number>();
      for (const r of reports) {
        const n = r.memberId ? memberName.get(String(r.memberId)) ?? "?" : "(no member)";
        byPerson.set(n, (byPerson.get(n) ?? 0) + r.minutes);
      }
      const people = [...byPerson].map(([n, m]) => `${n} ${(m / 510).toFixed(1)}d`).join(", ") || "none";
      console.log(`   project "${p.name}" status=${STATUS_LABELS[p.status ?? ""] ?? p.status}`);
      console.log(`   reports (new-theme work): ${people}`);
      if (diffs.length === 0) console.log("   matches the sheet");
      else {
        differences++;
        for (const d of diffs) console.log(`   DIFF ${d}`);
      }
    }
    console.log("");
  }
  console.log(`${differences} theme(s) with at least one difference.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
