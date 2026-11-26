import { spawn } from "node:child_process";
import { appendFile, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { fetchSpaceText } from "@/lib/service/chat/space-fetch";
import { changedThreads, parseExportThreads, toSnapshot, type Snapshot } from "@/lib/service/import/space-diff";
import { istDate } from "@/lib/service/import/text";
import { parseSpaceReview, type SpaceReview } from "@/lib/service/import/space-review";
import { ServiceSpaceReview } from "@/models/service-space-review";

// Daily job for the "Live Project Chat Summary" tab (owner, 2026-11-26: "work on its own, same download path every time, sync automatically").
// Everything stays in ONE folder, ~/space-scan:
//   space-latest.txt     the whole space, downloaded from the live app every run (same path each time)
//   snapshot.json        what the last successful run had seen (thread key -> hash)
//   space-changes.txt    only the threads that are new or changed since then
//   review-current.json  the list now stored in the database
//   review-next.json     what Claude Code writes (its only output); validated here, then imported
//   backup/              the previous list before every import;  space-daily.log: what each run did
// Claude Code (your subscription, `claude -p`) reads ONLY the changed threads and updates the list; no API key service is used.
// When nothing changed, Claude is not started at all. Run it from Windows Task Scheduler (see scripts/space-daily.cmd).
//
//   npx tsx --env-file=.env.production.local scripts/space-daily.ts [--baseline=<export.txt>] [--dry-run] [--force]
//   --baseline=<file>  first run only: treat that export as already reviewed (no download, no AI), so only newer threads are read next time
//   --dry-run          download and list the changes, but do not start Claude or write the database
//   --force            run even if today's run already succeeded
// Scheduling (owner, 2026-11-26: "if the PC is not on at 8 am, try again after 120 minutes"): Task Scheduler starts it at 8:00 and every 120
// minutes until 22:00 (scripts/space-daily-schedule.ps1); a run that finished today (last-success.json, IST day) makes the later starts exit at once,
// and a failed run (PC offline, Chat error) leaves no mark, so the next start tries again.
const SPACE = process.env.SERVICE_SPACE_SCAN_SPACE?.trim() || "spaces/AAQAYekyB1Y";
const dir = join(homedir(), "space-scan");
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const CLAUDE_TIMEOUT_MS = 40 * 60_000;

async function log(line: string) {
  const text = `${new Date().toISOString()} ${line}`;
  console.log(text);
  await appendFile(join(dir, "space-daily.log"), `${text}\n`, "utf8").catch(() => undefined);
}

async function ranToday(): Promise<boolean> {
  try {
    return (JSON.parse(await readFile(join(dir, "last-success.json"), "utf8")) as { day?: string }).day === istDate(new Date());
  } catch {
    return false;
  }
}
const markSuccess = (note: string) =>
  writeFile(join(dir, "last-success.json"), JSON.stringify({ day: istDate(new Date()), at: new Date().toISOString(), note }), "utf8");

async function readSnapshot(): Promise<Snapshot | null> {
  try {
    return (JSON.parse(await readFile(join(dir, "snapshot.json"), "utf8")) as { threads: Snapshot }).threads;
  } catch {
    return null;
  }
}
const writeSnapshot = (threads: Snapshot) => writeFile(join(dir, "snapshot.json"), JSON.stringify({ updatedAt: new Date().toISOString(), threads }), "utf8");

async function storedReview(): Promise<SpaceReview> {
  const d = await ServiceSpaceReview.findById(SPACE).lean();
  if (!d) throw new Error("No reviewed list is stored yet: load the first one with scripts/import-space-review.ts, then run this again.");
  return parseSpaceReview({
    space: d._id,
    client: d.client,
    reviewedAt: new Date(d.reviewedAt).toISOString(),
    source: d.source,
    tasks: d.tasks,
    opportunities: d.opportunities,
    notes: d.notes,
  });
}

function prompt(client: string | null, today: string, changes: number): string {
  return [
    `You maintain the reviewed list of PENDING TASKS and PITCH OPPORTUNITIES for the Google Chat space of the client "${client ?? "unknown"}" (a Shopify agency's service team). Today is ${today}.`,
    `Two files are in the current folder: review-current.json (the list as it stands) and space-changes.txt (ONLY the ${changes} Chat threads that are new or have new replies since the last run; "=== THREAD n ===" headers, "[date time IST] Sender: text" lines; thread numbers are the export's own and stay stable).`,
    "Read both completely, then write review-next.json: the same JSON object (keys space, client, reviewedAt, source, tasks, opportunities, notes), changed like this:",
    "1. Remove a task when the changed threads show it was done, delivered, answered or dropped. Update the text or evidence of a task that moved but is still open.",
    '2. Add a task for something newly asked, promised or awaited in the changed threads that is not done in them. Use group "client_waiting" when it was raised in the last 30 days and the client or our team is waiting, otherwise "older". Fields: group, text, asked (date text), who (who must act), evidence (one phrase), threads ("T123, T124").',
    "3. Add an opportunity (priority High, Medium or Low; title, evidence threads, pitch one sentence) only for something newly visible in the changed threads: the client asking for more, an upsell or next phase, a problem we could fix. Do not duplicate an existing one.",
    `4. Set reviewedAt to ${today}. Keep every other task, opportunity and note exactly as it is. Be conservative: do not invent, do not list greetings or finished work.`,
    "Rules: group must be client_waiting, older or unclear; priority must be High, Medium or Low; all text fields are plain strings (use null for an empty optional one). Write ONLY review-next.json (valid JSON). Do not run commands or edit any other file. Finish with a 3-line summary: tasks removed, tasks added, opportunities added.",
  ].join("\n");
}

function runClaude(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--permission-mode", "acceptEdits", "--allowedTools", "Read,Write,Edit,Glob"], { cwd: dir, shell: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Claude Code did not finish within 40 minutes."));
    }, CLAUDE_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Could not start Claude Code (${e.message}). Is the claude command installed and signed in for this user?`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`Claude Code exited with ${code}: ${(err || out).slice(0, 400)}`));
    });
    child.stdin.end(text);
  });
}

async function main() {
  await mkdir(join(dir, "backup"), { recursive: true });

  const baseline = arg("baseline");
  if (baseline) {
    const threads = parseExportThreads(await readFile(baseline, "utf8"));
    await writeSnapshot(toSnapshot(threads));
    return log(`Baseline set from ${baseline}: ${threads.length} threads treated as already reviewed.`);
  }

  if (!dryRun && !force && (await ranToday())) return log("Already ran successfully today (IST): nothing to do.");

  const previous = await readSnapshot();
  if (!previous) throw new Error("No snapshot yet. Run once with --baseline=<the export the current list was made from>.");

  await log("Downloading the space from the live app...");
  const text = await fetchSpaceText();
  await writeFile(join(dir, "space-latest.txt"), text, "utf8");
  const current = parseExportThreads(text);
  if (current.length < 10) throw new Error(`The export holds only ${current.length} threads; not trusting it.`);
  const changed = changedThreads(previous, current);
  await log(`${current.length} threads in the space, ${changed.length} new or changed since the last run.`);

  if (changed.length === 0) {
    await writeSnapshot(toSnapshot(current));
    if (!dryRun) await markSuccess("nothing new");
    return log("Nothing new: the list stays as it is (Claude not started).");
  }
  await writeFile(join(dir, "space-changes.txt"), `${changed.map((t) => t.text).join("\n\n")}\n`, "utf8");
  if (dryRun) return log("Dry run: changes written to space-changes.txt, Claude not started, database untouched.");

  await connectToDatabase();
  const before = await storedReview();
  await writeFile(join(dir, "review-current.json"), JSON.stringify(before, null, 2), "utf8");
  await writeFile(join(dir, "review-next.json"), "", "utf8");
  const today = new Date().toISOString().slice(0, 10);
  await log("Starting Claude Code to update the list from the changed threads...");
  const summary = await runClaude(prompt(before.client, today, changed.length));
  await log(`Claude Code: ${summary.replace(/\s+/g, " ").slice(0, 400)}`);

  const next = parseSpaceReview(JSON.parse(await readFile(join(dir, "review-next.json"), "utf8")));
  if (next.space !== SPACE) throw new Error("review-next.json names another space; not imported.");
  if (before.tasks.length >= 10 && next.tasks.length < before.tasks.length * 0.5) {
    throw new Error(`The new list dropped from ${before.tasks.length} to ${next.tasks.length} tasks; not imported, check review-next.json.`);
  }

  await copyFile(join(dir, "review-current.json"), join(dir, "backup", `review-${today}-${Date.now()}.json`));
  // $set, not a replace, so the project the space is connected to survives the daily update.
  const fields = { client: next.client, source: next.source, tasks: next.tasks, opportunities: next.opportunities, notes: next.notes };
  await ServiceSpaceReview.updateOne({ _id: SPACE }, { $set: { ...fields, reviewedAt: new Date(next.reviewedAt) } }, { upsert: true });
  await recordServiceAudit("space_review.daily", {
    space: SPACE,
    changedThreads: changed.length,
    tasks: next.tasks.length,
    opportunities: next.opportunities.length,
  }).catch(() => undefined);
  await writeSnapshot(toSnapshot(current));
  await markSuccess(`imported, ${changed.length} threads`);
  await log(
    `Imported: ${next.tasks.length} tasks (was ${before.tasks.length}), ${next.opportunities.length} opportunities (was ${before.opportunities.length}).`
  );
}

main().then(
  () => process.exit(0),
  async (e) => {
    const message = e instanceof Error ? e.message : String(e);
    await mkdir(dir, { recursive: true }).catch(() => undefined);
    await log(`FAILED: ${message}`);
    process.exit(1);
  }
);
