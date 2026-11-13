/**
 * Finds stored Theme Status Group reports whose counted hours or whose split don't match what the current parser reads from the
 * original message text (owner, 2026-11-13: a message with two reports and "2 hours 30 minutes" was under-counted).
 *
 *   A. Wrong minutes: the report's text now parses to a different number of minutes than stored (e.g. "Timer: 2 hours 30 minutes"
 *      was stored as 120). Fix: updates the report's minutes, and the hours of the Theme Update entry made from it.
 *   B. Stored whole: one stored report whose text holds several reports (several Date lines, or several Theme Name lines each with a
 *      timer), so only the first was counted. Fix: removes that report (and its hours entry) and imports its text again, which
 *      stores one report per block.
 * Reports marked locked (classified once by hand) are skipped. Every change is recorded in admin_audit_log with the old values.
 *
 *   npx tsx --env-file=.env.production.local scripts/recheck-report-hours.ts           # dry run: lists what would change
 *   npx tsx --env-file=.env.production.local scripts/recheck-report-hours.ts --apply   # writes (owner runs it, after a backup)
 */
import { connectToDatabase } from "../lib/db/connect";
import { importReports } from "../lib/chat/importReports";
import { parseReport, splitReports, splitThemes } from "../lib/chat/parseReport";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { TimeEntry } from "../models/time-entry";

const apply = process.argv.includes("--apply");

type Row = { _id: unknown; key: string; sender: string; memberId: unknown; date: Date; postedAt: Date | null; themeName: string; minutes: number; rawText: string; status: string };

const fmt = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
const day = (d: Date) => new Date(d).toISOString().slice(0, 10);

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const reports = await ChatReport.find({ locked: { $ne: true }, rawText: { $ne: "" } })
    .select("key sender memberId date postedAt themeName minutes rawText status")
    .lean<Row[]>();
  console.log(`${reports.length} stored reports checked.\n`);

  const wrongMinutes: { r: Row; now: number }[] = [];
  const storedWhole: { r: Row; parts: number }[] = [];
  for (const r of reports) {
    const parts = splitReports(r.rawText).flatMap(splitThemes);
    if (parts.length > 1) {
      storedWhole.push({ r, parts: parts.length });
      continue;
    }
    const parsed = parseReport(parts[0] ?? r.rawText, day(r.date));
    if (parsed.ok && parsed.value.minutes !== r.minutes) wrongMinutes.push({ r, now: parsed.value.minutes });
  }

  console.log(`A. Wrong minutes: ${wrongMinutes.length}`);
  for (const { r, now } of wrongMinutes) console.log(`   ${day(r.date)}  ${r.sender || "?"}  ${r.themeName}: stored ${fmt(r.minutes)}, text says ${fmt(now)}`);
  console.log(`\nB. Stored whole (several reports in one): ${storedWhole.length}`);
  for (const { r, parts } of storedWhole) console.log(`   ${day(r.date)}  ${r.sender || "?"}  ${r.themeName} + ${parts - 1} more block(s); stored ${fmt(r.minutes)}`);

  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to correct them.");
    return;
  }

  for (const { r, now } of wrongMinutes) {
    await ChatReport.updateOne({ _id: r._id }, { $set: { minutes: now } });
    await TimeEntry.updateMany({ chatReportKey: r.key }, { $set: { hours: Math.round((now / 60) * 100) / 100 } });
    await AdminAudit.create({ action: "reports.recheck_minutes", detail: { reportId: String(r._id), sender: r.sender, date: day(r.date), before: r.minutes, after: now } });
  }
  for (const { r } of storedWhole) {
    await AdminAudit.create({ action: "reports.split_stored_whole", detail: { before: JSON.parse(JSON.stringify(r)) } });
    await TimeEntry.deleteMany({ chatReportKey: r.key });
    await ChatReport.deleteOne({ _id: r._id });
    const summary = await importReports([{ sender: r.sender, memberId: r.memberId ? String(r.memberId) : undefined, text: r.rawText, postedOn: day(r.date), postedAt: r.postedAt ? new Date(r.postedAt).toISOString() : undefined }]);
    console.log(`   re-imported ${day(r.date)} ${r.sender}: ${summary.created} created, ${summary.alreadyImported} already there, ${summary.needsReview.length} to review`);
  }
  console.log("\nDone. Press Re-check on the Chat page for anything that now needs review.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
