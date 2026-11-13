/**
 * Moves the stored "Jewellery" reports of Rare (and of Aspire, merged into Rare) to Rare's own theme work (owner, 2026-11-13: all
 * the "Aspire Jewellery" work was Aspire's main theme, built by Ehtesham, Shailesh and Pranay; it is not a preset and not update
 * work). New reports already read this way (MAIN_THEME_PRESETS in lib/chat/resolve.ts); this corrects the ones stored before.
 *
 * A report on the Rare theme whose Theme Name line says Jewellery / Jewelry becomes kind "theme", no preset, no project link (a theme
 * project counts its theme's new-theme reports). If it was logged as update hours on Rare Update, that hours entry is removed (the same
 * hours now count as the theme's build). Flagged reports are only listed: press Re-check on the Chat page for them. Locked reports are
 * left alone. The old values go to admin_audit_log (reports.reclassify_main_theme).
 *
 *   npx tsx --env-file=.env.production.local scripts/reclassify-rare-jewellery.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/reclassify-rare-jewellery.ts --apply   # writes (owner runs it, after a backup)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { Theme } from "../models/theme";
import { TimeEntry } from "../models/time-entry";

const apply = process.argv.includes("--apply");
const THEME_LINE = /theme\s*name\s*[:\-–—]*\s*(.+)/i;

type Row = { _id: unknown; key: string; sender: string; date: Date; themeName: string; kind: string | null; preset: string | null; projectId: unknown; status: string; minutes: number; rawText: string; locked?: boolean };

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const rare = await Theme.findOne({ name: "Rare" }).select("_id").lean<{ _id: unknown }>();
  if (!rare) throw new Error("Theme Rare not found.");

  const reports = await ChatReport.find({ themeId: rare._id }).lean<Row[]>();
  const jewellery = reports.filter((r) => /jewel+e?ry/i.test(THEME_LINE.exec(r.rawText)?.[1] ?? r.themeName));
  const toFix = jewellery.filter((r) => !r.locked && r.status === "ok" && !(r.kind === "theme" && !r.preset && !r.projectId));
  const flagged = jewellery.filter((r) => r.status === "needs_review");
  const already = jewellery.length - toFix.length - flagged.length;

  const day = (d: Date) => new Date(d).toISOString().slice(0, 10);
  console.log(`${jewellery.length} Jewellery report(s) on Rare: ${toFix.length} to move to Rare's theme work, ${already} already there or locked, ${flagged.length} flagged.\n`);
  for (const r of toFix) console.log(`  ${day(r.date)}  ${r.sender || "?"}  ${(r.minutes / 60).toFixed(1)} h  was ${r.kind}${r.preset ? ` (${r.preset})` : ""}${r.kind === "update" ? ", its Rare Update hours entry is removed" : ""}`);
  if (flagged.length) {
    console.log(`\nFlagged (press Re-check on the Chat page after deploying; they now read as Rare's theme work):`);
    for (const r of flagged) console.log(`  ${day(r.date)}  ${r.sender || "?"}  ${(r.minutes / 60).toFixed(1)} h`);
  }
  const hours = toFix.reduce((n, r) => n + r.minutes, 0) / 60;
  console.log(`\nMoves ${hours.toFixed(1)} h (${(hours / 8.5).toFixed(1)} days) onto the Rare project.`);

  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to move them.");
    return;
  }
  for (const r of toFix) {
    await AdminAudit.create({ action: "reports.reclassify_main_theme", detail: { reportId: String(r._id), before: { kind: r.kind, preset: r.preset, projectId: r.projectId ? String(r.projectId) : null } } });
    await ChatReport.updateOne({ _id: r._id }, { $set: { kind: "theme", preset: null, projectId: null } });
    if (r.kind === "update") await TimeEntry.deleteMany({ chatReportKey: r.key });
  }
  console.log(`\nDone: ${toFix.length} report(s) moved.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
