/**
 * Sets one project's status (the same change as the status field on its project page), recorded in admin_audit_log.
 *
 *   npx tsx --env-file=.env.production.local scripts/set-project-status.ts "Apollo" theme_uploaded           # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-project-status.ts "Apollo" theme_uploaded --apply   # writes (owner runs it)
 *
 * Statuses: planning, under_designing, design_completed, under_development, theme_uploaded, under_review, error_given, live,
 * rejected, active, on_hold, completed. The project is found by its exact name (case ignored); several matches are listed and nothing
 * changes (add --type theme_development / preset_development / theme_update to pick one). A Theme Update project has no status.
 * Planning, Under Designing and Under Development are also kept in line with who reports by the automatic rule
 * (lib/projects/buildStatus.ts); later statuses such as theme_uploaded are never touched by it.
 */
import { connectToDatabase } from "../lib/db/connect";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from "../lib/projects/constants";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const typeIndex = args.indexOf("--type");
const type = typeIndex >= 0 ? args[typeIndex + 1] : undefined;
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--type"));
const [name, status] = positional;

async function main() {
  if (!name || !status) throw new Error('Usage: set-project-status.ts "<Project name>" <status> [--type theme_development] [--apply]');
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) throw new Error(`Status must be one of: ${PROJECT_STATUSES.join(", ")}`);
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const esc = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter: Record<string, unknown> = { name: new RegExp(`^${esc}$`, "i"), type: { $ne: "theme_update" } };
  if (type) filter.type = type === "theme_development" ? { $in: ["theme_development", null] } : type;
  const matches = await Project.find(filter).select("name type status").lean<{ _id: unknown; name: string; type?: string | null; status: string | null }[]>();
  if (matches.length === 0) throw new Error(`No project named "${name}" with a status was found.`);
  if (matches.length > 1) {
    console.log(`"${name}" matches ${matches.length} projects; nothing changed. Pick one with --type:`);
    for (const p of matches) console.log(`  ${p.name} (${p.type ?? "theme_development"}), now ${p.status ?? "no status"}`);
    return;
  }
  const p = matches[0];
  const to = status as ProjectStatus;
  if (p.status === to) {
    console.log(`"${p.name}" is already ${PROJECT_STATUS_LABELS[to]}. Nothing to do.`);
    return;
  }
  console.log(`"${p.name}": ${apply ? "setting" : "would set"} ${PROJECT_STATUS_LABELS[to]} (now ${p.status ? PROJECT_STATUS_LABELS[p.status as ProjectStatus] : "no status"}).`);
  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to do it.");
    return;
  }
  await Project.updateOne({ _id: p._id }, { $set: { status: to } });
  await AdminAudit.create({ action: "projects.set_status", detail: { project: p.name, projectId: String(p._id), was: p.status, now: to } });
  console.log("\nDone.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
