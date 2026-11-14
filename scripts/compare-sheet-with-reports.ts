/**
 * Read-only: for the period the owner's manual sheet is correct (up to 12 Oct 2026; owner, 2026-11-14), first checks what the Chat
 * reports hold for each theme in that period, then compares the sheet to it. Per theme: the new-theme reports up to 12 Oct as design
 * and development days by person (8.5 h = 1 day; designers = designation with designer / UI/UX, everyone else but managers =
 * development), the sheet's days, the gap (sheet minus reports = work the reports never captured), and any report up to that date
 * that names the theme but is not counted as its new-theme work (flagged, ignored, preset, update) so a misfiled report is seen.
 *
 *   npx tsx --env-file=.env.production.local scripts/compare-sheet-with-reports.ts
 */
import { connectToDatabase } from "../lib/db/connect";
import { ChatReport } from "../models/chat-report";
import { TeamMember } from "../models/team-member";
import { Theme } from "../models/theme";

const CUTOFF = new Date("2026-10-12T23:59:59.999Z");
const DAY_MIN = 510;

// theme (app name), designers, developers (as written in the sheet), sheet design days, sheet development days
const SHEET: [string, string[], string[], number | null, number | null][] = [
  ["Adorn", ["Noman"], ["Shailesh"], null, 100],
  ["Flaunt", ["Noman"], ["Shailesh"], null, null],
  ["Dynamic", ["Junaid"], ["Shreyas"], 25, 45],
  ["Renovate", ["Junaid"], ["Shailesh"], 22, 36],
  ["Voltix", ["Junaid"], ["Shreyas"], 31, 51],
  ["Velocity", ["Junaid"], ["Shreyas"], null, 31],
  ["Zeal", ["Pranay"], ["Ehtesham"], null, null],
  ["Noble", ["Pranay", "Mussadique"], ["Ehtesham"], null, 84],
  ["Grocery", ["Pranay", "Mussadique", "Junaid"], ["Aarti", "Shailesh"], null, 36],
  ["Breeze", ["Mussadique", "Noman", "Pranay"], ["Shailesh"], 27, 35],
  ["Gravity", ["Noman", "Pranay"], ["Ehtesham"], 23, 37],
  ["Soft", ["Mussadique"], ["Ehtesham"], 13, 41],
  ["Rare", ["Pranay"], ["Ehtesham", "Shailesh"], 24, 48], // the sheet's "Aspire"
  ["Kombat", ["Pranay"], ["Aarti"], 11, 27],
  ["Pretty", ["Mussadique", "Pranay"], [], 18, 0],
  ["Nexus", ["Mussadique"], ["Ehtesham"], null, 38],
  ["Loyal", ["Mussadique"], ["Ehtesham"], 22, 32],
  ["Apollo", ["Junaid"], ["Shailesh"], 13, 41],
  ["Auto", ["Mussadique", "Pranay"], [], 30, null],
  ["Legacy", ["Mussadique"], ["Ehtesham"], 15, 38],
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const d1 = (n: number) => (Math.round(n * 10) / 10).toString();
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`Read-only against ${mongoose.connection.host} / ${mongoose.connection.name}; reports up to ${iso(CUTOFF)}\n`);
  const members = new Map((await TeamMember.find().select("name designation").lean<{ _id: unknown; name: string; designation: string }[]>()).map((m) => [String(m._id), m]));
  const themes = await Theme.find().select("name").lean<{ _id: unknown; name: string }[]>();

  for (const [name, designers, developers, sheetDesign, sheetDev] of SHEET) {
    const theme = themes.find((t) => norm(t.name) === norm(name));
    console.log(`── ${name}`);
    if (!theme) {
      console.log("   no theme row of this name\n");
      continue;
    }
    const all = await ChatReport.find({ themeId: theme._id, date: { $lte: CUTOFF } })
      .select("memberId sender minutes kind status date preset reason")
      .lean<{ memberId: unknown; sender: string; minutes: number; kind: string | null; status: string; date: Date; preset: string | null; reason: string | null }[]>();
    const counted = all.filter((r) => r.kind === "theme" && r.status === "ok");
    let design = 0;
    let dev = 0;
    const who = new Map<string, { role: string; min: number; first: Date; last: Date }>();
    for (const r of counted) {
      const m = r.memberId ? members.get(String(r.memberId)) : null;
      const desig = (m?.designation ?? "").toLowerCase();
      if (desig.includes("manager")) continue;
      const role = /designer|ui\/?ux/.test(desig) ? "design" : "development";
      if (role === "design") design += r.minutes;
      else dev += r.minutes;
      const key = `${m?.name ?? r.sender ?? "?"}`;
      const cur = who.get(key);
      who.set(key, { role, min: (cur?.min ?? 0) + r.minutes, first: cur && cur.first < r.date ? cur.first : r.date, last: cur && cur.last > r.date ? cur.last : r.date });
    }
    const people = [...who].map(([n, v]) => `${n} (${v.role}) ${d1(v.min / DAY_MIN)}d ${iso(v.first)}..${iso(v.last)}`);
    console.log(`   reports: design ${d1(design / DAY_MIN)} d, development ${d1(dev / DAY_MIN)} d   | sheet: design ${sheetDesign ?? "-"}, development ${sheetDev ?? "-"}`);
    console.log(`   people in reports: ${people.join("; ") || "none"}`);
    console.log(`   people in sheet:   designers ${designers.join(", ") || "-"}; developers ${developers.join(", ") || "-"}`);
    const gap = (label: string, sheet: number | null, reports: number) => {
      if (sheet === null) return;
      const g = sheet - reports / DAY_MIN;
      console.log(`   ${label}: sheet minus reports = ${g >= 0 ? "+" : ""}${d1(g)} d${g < -0.5 ? "   <- reports exceed the sheet" : g > 0.5 ? "   (work the reports never captured)" : "   (agrees)"}`);
    };
    gap("design", sheetDesign, design);
    gap("development", sheetDev, dev);

    const other = all.filter((r) => !(r.kind === "theme" && r.status === "ok"));
    if (other.length > 0) {
      const sum = new Map<string, number>();
      for (const r of other) {
        const k = r.status !== "ok" ? `${r.status}${r.reason ? " (" + r.reason.slice(0, 40) + ")" : ""}` : `${r.kind}${r.preset ? ":" + r.preset : ""}`;
        sum.set(k, (sum.get(k) ?? 0) + r.minutes);
      }
      console.log(`   other reports on this theme up to the cutoff (not new-theme work): ${[...sum].map(([k, m]) => `${k} ${d1(m / DAY_MIN)}d`).join(", ")}`);
    }
    console.log("");
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
