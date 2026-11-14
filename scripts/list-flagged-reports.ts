/**
 * Read-only: every Chat time report still flagged (needs_review), grouped by the reason it was flagged, with who posted it, the
 * day, the hours and the theme line they wrote. Then what a Re-check would do with them today (nothing is written).
 *
 *   npx tsx --env-file=.env.production.local scripts/list-flagged-reports.ts
 */
import { connectToDatabase } from "../lib/db/connect";
import { reprocessFlaggedReports } from "../lib/chat/importReports";
import { ChatReport } from "../models/chat-report";

type Row = { sender?: string; date?: Date; minutes: number; themeName?: string; kind?: string | null; preset?: string | null; reason?: string | null; locked?: boolean };

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`Read-only against ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const rows = await ChatReport.find({ status: "needs_review" }).sort({ date: 1 }).lean<Row[]>();
  console.log(`${rows.length} flagged report(s), ${(rows.reduce((s, r) => s + r.minutes, 0) / 60).toFixed(1)} h in all\n`);

  const byReason = new Map<string, Row[]>();
  for (const r of rows) {
    const key = (r.reason ?? "no reason saved").trim();
    byReason.set(key, [...(byReason.get(key) ?? []), r]);
  }
  for (const [reason, list] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`== ${reason}  (${list.length}, ${(list.reduce((s, r) => s + r.minutes, 0) / 60).toFixed(1)} h)`);
    for (const r of list) {
      const day = r.date ? new Date(r.date).toISOString().slice(0, 10) : "?";
      console.log(`   ${day}  ${(r.sender ?? "?").padEnd(22)} ${(r.minutes / 60).toFixed(1).padStart(4)} h  "${r.themeName ?? ""}"${r.locked ? "  [locked]" : ""}`);
    }
    console.log("");
  }

  const dry = await reprocessFlaggedReports({ dryRun: true });
  console.log(`Re-check today would fix ${dry.fixed} of ${dry.checked} checked:`);
  for (const f of dry.wouldFix ?? []) console.log(`   ${f.date}  ${f.sender.padEnd(22)} ${String(f.hours).padStart(4)} h  "${f.line}"  ->  ${f.to}`);
  console.log(`\nStill flagged after a Re-check: ${dry.stillNeedsReview.length}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
