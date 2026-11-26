import { spawn } from "node:child_process";
import { appendFile, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { fetchLiveJson, fetchSpaceText } from "@/lib/service/chat/space-fetch";
import { changedThreads, chunkThreads, parseExportThreads, toSnapshot, type Snapshot } from "@/lib/service/import/space-diff";
import { istDate } from "@/lib/service/import/text";
import { parseSpaceReview, type SpaceReview } from "@/lib/service/import/space-review";
import type { ProjectMatch } from "@/lib/service/import/space-match";
import { ServiceProjectSpace } from "@/models/service-project-space";
import { ServiceSpaceReview } from "@/models/service-space-review";

// Daily job for the "Live Project Chat Summary" tabs (owner, 2026-11-26: "work on its own, same download path every time, sync automatically";
// "last 90 days for once ... store it and add daily updates there also"). The projects are the live app's Active list TODAY (the same list as the
// tabs: GET /api/service/space-scan/targets); a project that leaves it drops out (its stored list stays), one that returns is picked up again, and a
// NEW active project with exactly one matching space is linked automatically (see autoLink). For EVERY space connected to such a project, in turn:
//   1. downloads the last 90 days of the space from the live app into ~/space-scan/<space id>/space-latest.txt (same path every time);
//   2. compares it with that folder's snapshot.json (what the last successful run had seen): a thread is new or changed when its text differs;
//   3. nothing changed -> stops (Claude is not started, nothing is spent);
//   4. otherwise writes the changed threads to space-changes.txt (in chunks if big) and runs `claude -p` (the owner's subscription, tools limited to
//      Read / Write / Edit / Glob) to update the stored list: remove tasks the new messages finish, add new tasks and opportunities. A space with NO list
//      yet gets its first one from the whole 90 days;
//   5. validates review-next.json, backs up the previous list (backup/), stores the new one in the database (ServiceSpaceReview, per space) and
//      updates the snapshot. The tabs read it from there.
// Each space has its own folder, snapshot, success mark and log line; one space failing does not stop the others. A space that finished today is
// skipped on later starts. Task Scheduler starts it at 8:00 and every 120 minutes until 22:00 (scripts/space-daily-schedule.ps1): a PC that was off
// at 8:00 tries again, and a failed space is tried again at the next start. Everything outside the database stays in ~/space-scan.
//
//   npx tsx --env-file=.env.production.local scripts/space-daily.ts [--only="Project name"] [--sizes] [--dry-run] [--force]
//   --only=<project name | space id>   one space only
//   --sizes     download each space and print its size and thread count, nothing else (no snapshot, no Claude, no database)
//   --dry-run   as the real run up to the changes (written to space-changes.txt), but no Claude, no database, no snapshot
//   --force     ignore today's success mark
const root = join(homedir(), "space-scan");
const WINDOW_DAYS = 90;
const CHUNK_BYTES = 220_000; // text handed to one Claude run
const CLAUDE_TIMEOUT_MS = 40 * 60_000;
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = arg("only");
const sizesOnly = process.argv.includes("--sizes");
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

interface Target {
  space: string;
  project: string;
  projectId: string;
  dir: string;
}

async function log(line: string) {
  const text = `${new Date().toISOString()} ${line}`;
  console.log(text);
  await appendFile(join(root, "space-daily.log"), `${text}\n`, "utf8").catch(() => undefined);
}

async function jsonOr<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

interface LiveTargets {
  liveProjects: Array<{ id: string; name: string }>;
  targets: Array<{ projectId: string; project: string; space: string }>;
}

/** The spaces connected to the projects on the live app's Active list today (the same list as the tabs). New active projects get linked first. */
async function targets(): Promise<Target[]> {
  let live = await fetchLiveJson<LiveTargets>("/api/service/space-scan/targets");
  if (!dryRun && !sizesOnly && (await autoLink(live))) live = await fetchLiveJson<LiveTargets>("/api/service/space-scan/targets");
  return live.targets
    .map((t) => ({ space: t.space, project: t.project, projectId: t.projectId, dir: join(root, t.space.replace("spaces/", "")) }))
    .filter((t) => !only || t.project === only || t.space === only)
    .sort((a, b) => a.project.localeCompare(b.project));
}

/**
 * A new active project has no space yet. When exactly ONE space not used by another project fits its client name (score 75 or more, the name
 * match of match-spaces.ts), it is linked here (audit `project_space.auto_link`); several or none are only reported and wait for the owner.
 * Returns true when something was linked.
 */
async function autoLink(live: LiveTargets): Promise<boolean> {
  const linked = new Set(live.targets.map((t) => t.projectId));
  const unlinked = live.liveProjects.filter((p) => !linked.has(p.id));
  if (!unlinked.length) return false;
  const { matches } = await fetchLiveJson<{ matches: ProjectMatch[] }>("/api/service/space-scan/spaces");
  const taken = new Set((await ServiceProjectSpace.find().select("_id").lean<Array<{ _id: string }>>()).map((d) => d._id));
  let any = false;
  for (const p of unlinked) {
    const found = matches.find((m) => m.project.id === p.id)?.candidates.filter((c) => c.score >= 75 && !taken.has(c.name)) ?? [];
    if (found.length !== 1) {
      await log(
        `[${p.name}] new active project with no space: ${found.length ? `${found.length} spaces fit its name, needs you` : "no space fits its name, needs you"}.`
      );
      continue;
    }
    const c = found[0];
    await ServiceProjectSpace.updateOne({ _id: c.name }, { $set: { projectId: p.id, displayName: c.displayName } }, { upsert: true });
    await recordServiceAudit("project_space.auto_link", { space: c.name, project: p.name, projectId: p.id, score: c.score }).catch(() => undefined);
    taken.add(c.name);
    any = true;
    await log(`[${p.name}] linked automatically to the space "${c.displayName}" (${c.name}).`);
  }
  return any;
}

async function storedReview(space: string): Promise<SpaceReview | null> {
  const d = await ServiceSpaceReview.findById(space).lean();
  if (!d) return null;
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

function prompt(client: string | null, today: string, threads: number, part: string, firstRead: boolean): string {
  return [
    `You maintain the reviewed list of PENDING TASKS and PITCH OPPORTUNITIES for the Google Chat space of the client "${client ?? "unknown"}" (a Shopify / marketing agency's service team). Today is ${today}.`,
    `Two files are in the current folder: review-current.json (the list as it stands) and space-changes.txt (${firstRead ? `the last ${WINDOW_DAYS} days of the space, ` : "ONLY the Chat threads that are new or have new replies since the last run, "}${threads} threads, part ${part}; "=== THREAD n ===" headers, "[date time IST] Sender: text" lines; thread numbers are the export's own).`,
    firstRead ? "The list is empty or incomplete: this is the FIRST read of the space. Build it fully from these threads." : "",
    "Read both completely, then write review-next.json: the same JSON object (keys space, client, reviewedAt, source, tasks, opportunities, notes), changed like this:",
    "1. Remove a task when the threads show it was done, delivered, answered or dropped. Update the text or evidence of a task that moved but is still open.",
    '2. Add a task for something asked, promised or awaited in these threads that is not done in them. Do not add one that is already in the list (same matter). Use group "client_waiting" when it was raised in the last 30 days and the client or our team is waiting, otherwise "older". Fields: group, text, asked (date text), who (who must act), evidence (one phrase), threads ("T123, T124").',
    "3. Add an opportunity (priority High, Medium or Low; title, evidence threads, pitch one sentence) only for something visible in these threads: the client asking for more, an upsell or next phase, a problem we could fix. Do not duplicate an existing one.",
    `4. Set reviewedAt to ${today}. Keep every other task, opportunity and note exactly as it is. Be conservative: do not invent, do not list greetings or finished work.`,
    "Rules: group must be client_waiting, older or unclear; priority must be High, Medium or Low; all text fields are plain strings (use null for an empty optional one). Write ONLY review-next.json (valid JSON). Do not run commands or edit any other file. Finish with a 3-line summary: tasks removed, tasks added, opportunities added.",
  ]
    .filter(Boolean)
    .join("\n");
}

function runClaude(cwd: string, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--permission-mode", "acceptEdits", "--allowedTools", "Read,Write,Edit,Glob"], { cwd, shell: true });
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

async function processSpace(t: Target): Promise<"done" | "skipped" | "nothing"> {
  const tag = `[${t.project}]`;
  await mkdir(join(t.dir, "backup"), { recursive: true });
  const today = istDate(new Date());
  if (!sizesOnly && !dryRun && !force && (await jsonOr<{ day?: string }>(join(t.dir, "last-success.json")))?.day === today) {
    await log(`${tag} already done today.`);
    return "skipped";
  }

  const text = await fetchSpaceText({ space: t.space, days: WINDOW_DAYS });
  const current = parseExportThreads(text);
  if (sizesOnly) {
    await log(`${tag} ${t.space}: ${(Buffer.byteLength(text, "utf8") / 1024).toFixed(0)} KB, ${current.length} threads in the last ${WINDOW_DAYS} days.`);
    return "nothing";
  }
  await writeFile(join(t.dir, "space-latest.txt"), text, "utf8");

  const review = await storedReview(t.space);
  let snapshot = (await jsonOr<{ threads: Snapshot }>(join(t.dir, "snapshot.json")))?.threads ?? null;
  // The first space (Lulu) was set up before the folders: carry its snapshot over once.
  if (!snapshot && review) {
    const legacy = await jsonOr<{ threads: Snapshot }>(join(root, "snapshot.json"));
    if (legacy && t.space === "spaces/AAQAYekyB1Y") snapshot = legacy.threads;
  }
  const firstRead = !review || !snapshot;
  if (review && !snapshot) {
    // A list exists but there is no record of what it was made from: take today's export as the baseline instead of re-reading everything.
    await writeFile(join(t.dir, "snapshot.json"), JSON.stringify({ updatedAt: new Date().toISOString(), threads: toSnapshot(current) }), "utf8");
    await log(`${tag} a list exists but no snapshot: baseline set from today's export (${current.length} threads), nothing read.`);
    return "nothing";
  }
  const changed = changedThreads(firstRead ? {} : snapshot!, current);
  await log(
    `${tag} ${current.length} threads in the last ${WINDOW_DAYS} days, ${changed.length} ${firstRead ? "to read for the first time" : "new or changed since the last run"}.`
  );

  const markDone = async (note: string) =>
    writeFile(join(t.dir, "last-success.json"), JSON.stringify({ day: today, at: new Date().toISOString(), note }), "utf8");
  if (changed.length === 0) {
    if (!dryRun) {
      await writeFile(join(t.dir, "snapshot.json"), JSON.stringify({ updatedAt: new Date().toISOString(), threads: toSnapshot(current) }), "utf8");
      await markDone("nothing new");
    }
    await log(`${tag} nothing new: the list stays as it is (Claude not started).`);
    return "nothing";
  }
  if (dryRun) {
    await writeFile(join(t.dir, "space-changes.txt"), `${changed.map((c) => c.text).join("\n\n")}\n`, "utf8");
    await log(`${tag} dry run: changes written to space-changes.txt, Claude not started, database untouched.`);
    return "nothing";
  }

  const chunks = chunkThreads(changed, CHUNK_BYTES);
  let list: SpaceReview = review ?? {
    space: t.space,
    client: t.project,
    reviewedAt: today,
    source: `last ${WINDOW_DAYS} days, ${current.length} threads`,
    tasks: [],
    opportunities: [],
    notes: [],
  };
  for (let i = 0; i < chunks.length; i++) {
    await writeFile(join(t.dir, "space-changes.txt"), `${chunks[i].map((c) => c.text).join("\n\n")}\n`, "utf8");
    await writeFile(join(t.dir, "review-current.json"), JSON.stringify(list, null, 2), "utf8");
    await writeFile(join(t.dir, "review-next.json"), "", "utf8");
    await log(`${tag} Claude Code, part ${i + 1} of ${chunks.length} (${chunks[i].length} threads)...`);
    const summary = await runClaude(t.dir, prompt(list.client, today, chunks[i].length, `${i + 1} of ${chunks.length}`, firstRead));
    await log(`${tag} Claude Code: ${summary.replace(/\s+/g, " ").slice(0, 300)}`);
    const next = parseSpaceReview(JSON.parse(await readFile(join(t.dir, "review-next.json"), "utf8")));
    if (next.space !== t.space) throw new Error("review-next.json names another space; not stored.");
    if (list.tasks.length >= 10 && next.tasks.length < list.tasks.length * 0.5) {
      throw new Error(`The list dropped from ${list.tasks.length} to ${next.tasks.length} tasks; not stored, check review-next.json.`);
    }
    await copyFile(join(t.dir, "review-current.json"), join(t.dir, "backup", `review-${today}-${Date.now()}.json`));
    const fields = { client: next.client, source: next.source ?? list.source, tasks: next.tasks, opportunities: next.opportunities, notes: next.notes };
    await ServiceSpaceReview.updateOne({ _id: t.space }, { $set: { ...fields, reviewedAt: new Date(next.reviewedAt) } }, { upsert: true });
    list = { ...next, source: fields.source };
  }
  await recordServiceAudit("space_review.daily", {
    space: t.space,
    project: t.project,
    firstRead,
    changedThreads: changed.length,
    tasks: list.tasks.length,
    opportunities: list.opportunities.length,
  }).catch(() => undefined);
  await writeFile(join(t.dir, "snapshot.json"), JSON.stringify({ updatedAt: new Date().toISOString(), threads: toSnapshot(current) }), "utf8");
  await markDone(firstRead ? "first read" : `${changed.length} threads`);
  await log(
    `${tag} stored: ${list.tasks.length} tasks, ${list.opportunities.length} opportunities (${firstRead ? "first read" : `${changed.length} threads read`}).`
  );
  return "done";
}

async function main() {
  await mkdir(root, { recursive: true });
  await connectToDatabase();
  const list = await targets();
  if (!list.length) throw new Error(only ? `No connected active project matches "${only}".` : "No space is connected to an active project.");
  await log(`${list.length} space(s) connected to active projects${only ? ` (only ${only})` : ""}.`);
  const failed: string[] = [];
  for (const t of list) {
    try {
      await processSpace(t);
    } catch (e) {
      failed.push(t.project);
      await log(`[${t.project}] FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await log(
    failed.length ? `Finished with ${failed.length} failed: ${failed.join(", ")} (they are tried again at the next start).` : "Finished: all spaces done."
  );
  if (failed.length) process.exitCode = 1;
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  async (e) => {
    await mkdir(root, { recursive: true }).catch(() => undefined);
    await log(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
);
