import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import type { ProjectMatch } from "@/lib/service/import/space-match";
import { ServiceProject } from "@/models/service-project";
import { ServiceProjectSpace } from "@/models/service-project-space";

// Links the active projects to the Chat spaces found by name (owner, 2026-11-26: "connect the active projects to their spaces"). Reads
// ~/space-scan/spaces.json (saved by match-spaces.ts), and for every ACTIVE-list project whose name matched exactly ONE space creates the link.
// A project with no match, or with several, is listed and left alone. A project that is no longer in the file's list of projects, or has
// since left Active / Blocked / Partial hold, is skipped. Dry run unless --apply; the owner runs --apply. Audit: project_space.link_matched.
// --skip="Name 1|Name 2" leaves projects out (for a match not yet confirmed).
//
//   npx tsx --env-file=.env.production.local scripts/link-matched-spaces.ts [--skip="Carol XO Carolsworld"] [--apply]
const apply = process.argv.includes("--apply");
const arg = (name: string) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
    .trim();

async function main() {
  const skip = new Set(
    (arg("skip") ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const file = join(homedir(), "space-scan", "spaces.json");
  const { matches } = JSON.parse(await readFile(file, "utf8")) as { matches?: ProjectMatch[] };
  if (!matches?.length) throw new Error(`No matches in ${file}. Run match-spaces.ts first.`);
  await connectToDatabase();
  const live = new Set(
    (
      await ServiceProject.find({ status: { $in: ["ACTIVE", "BLOCKED", "PARTIAL_HOLD"] } })
        .select("_id")
        .lean<Array<{ _id: string }>>()
    ).map((p) => p._id)
  );
  const existing = new Map((await ServiceProjectSpace.find().lean()).map((d) => [d._id, d.projectId]));

  const toLink: Array<{ space: string; displayName: string; projectId: string; project: string }> = [];
  for (const m of matches) {
    const label = m.project.name.padEnd(36);
    if (skip.has(m.project.name)) console.log(`${label} skipped (--skip)`);
    else if (!live.has(m.project.id)) console.log(`${label} skipped: not Active / Blocked / Partial hold any more`);
    else if (m.candidates.length !== 1) console.log(`${label} left alone: ${m.candidates.length} matching spaces`);
    else {
      const c = m.candidates[0];
      const was = existing.get(c.name);
      console.log(
        `${label} -> ${c.displayName} [${c.name}]${was === m.project.id ? " (already linked)" : was ? ` (currently linked to another project, will move)` : ""}`
      );
      if (was !== m.project.id) toLink.push({ space: c.name, displayName: c.displayName, projectId: m.project.id, project: m.project.name });
    }
  }
  console.log(`\n${apply ? "APPLYING" : "Dry run"}: ${toLink.length} link(s) to write.`);
  if (!apply) return console.log("Nothing written. Add --apply to save.");
  for (const l of toLink)
    await ServiceProjectSpace.updateOne({ _id: l.space }, { $set: { projectId: l.projectId, displayName: l.displayName } }, { upsert: true });
  await recordServiceAudit("project_space.link_matched", { linked: toLink.map((l) => ({ space: l.space, project: l.project })) });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
