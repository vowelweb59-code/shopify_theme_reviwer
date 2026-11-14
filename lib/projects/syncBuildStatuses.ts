import { detectBuildStatus } from "./buildStatus";
import { themesPastBuild } from "./syncReviewStatuses";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";

export type StatusChange = { projectId: string; name: string; from: string; to: string };

/**
 * Moves each Theme / Preset Design & Development project that is Planning, Under Designing or Under Development to the stage its reporters show
 * (lib/projects/buildStatus.ts). A theme project is judged by its theme's new-theme reports, a preset project by the preset reports
 * linked to it (the same scoping as lib/projects/loadTotals.ts). Returns what changed (with `dryRun`, what would).
 */
export async function syncBuildStatuses(options: { dryRun?: boolean } = {}): Promise<StatusChange[]> {
  const projects = await Project.find({ type: { $in: ["theme_development", "preset_development", null] }, status: { $in: ["planning", "under_designing", "under_development"] } })
    .select("name themeId type status")
    .lean<{ _id: unknown; name: string; themeId: unknown; type?: string | null; status: string }[]>();
  if (projects.length === 0) return [];
  // A theme already on an ops demo store or live on the Theme Store is past building: the review rule owns its project's status.
  // (A new preset of such a theme is still being built, so preset projects always follow this rule.)
  const past = await themesPastBuild();
  const building = projects.filter((p) => p.type === "preset_development" || !past.has(String(p.themeId)));
  if (building.length === 0) return [];

  const themeIds = building.filter((p) => p.type !== "preset_development").map((p) => p.themeId);
  const presetIds = building.filter((p) => p.type === "preset_development").map((p) => p._id);
  const reports = await ChatReport.find({
    status: "ok",
    memberId: { $ne: null },
    $or: [
      { kind: "theme", themeId: { $in: themeIds } },
      { kind: "preset", projectId: { $in: presetIds } },
    ],
  })
    .select("kind themeId projectId memberId")
    .lean<{ kind: string; themeId: unknown; projectId: unknown; memberId: unknown }[]>();
  const members = await TeamMember.find({ _id: { $in: [...new Set(reports.map((r) => String(r.memberId)))] } }).select("designation").lean<{ _id: unknown; designation: string }[]>();
  const designation = new Map(members.map((m) => [String(m._id), m.designation]));

  const changes: StatusChange[] = [];
  for (const p of building) {
    const preset = p.type === "preset_development";
    const who = reports
      .filter((r) => (preset ? r.kind === "preset" && String(r.projectId) === String(p._id) : r.kind === "theme" && String(r.themeId) === String(p.themeId)))
      .map((r) => designation.get(String(r.memberId)));
    const next = detectBuildStatus(p.status, who);
    if (!next) continue;
    changes.push({ projectId: String(p._id), name: p.name, from: p.status, to: next });
    if (!options.dryRun) await Project.updateOne({ _id: p._id, status: p.status }, { $set: { status: next } });
  }
  return changes;
}
