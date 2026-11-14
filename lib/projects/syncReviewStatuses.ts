import { detectReviewStatus, storeNameMatchesTheme, BEFORE_LIVE } from "./reviewStatus";
import { DemoStoreThemeRecord } from "@/models/demo-store-theme-record";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";

export type ReviewChange = { projectId: string; name: string; from: string; to: string; why: string };

type Facts = { onOpsStore: boolean; listed: boolean; why: string[] };

/** For each theme (by id): is it on an ops demo store, and is it live on the public Theme Store, and the evidence. */
async function loadFacts(): Promise<Map<string, Facts>> {
  const [themes, records] = await Promise.all([
    Theme.find().select("name themeStoreLive").lean<{ _id: unknown; name: string; themeStoreLive?: boolean | null }[]>(),
    DemoStoreThemeRecord.find().select("store themeName schemaName themeStoreListed endedAt").lean<{ store?: string; themeName: string; schemaName?: string | null; themeStoreListed?: boolean | null; endedAt?: Date | null }[]>(),
  ]);
  const out = new Map<string, Facts>();
  for (const theme of themes) {
    const seen = records.filter((r) => storeNameMatchesTheme(r.themeName, theme.name) || storeNameMatchesTheme(r.schemaName, theme.name));
    const why: string[] = [];
    for (const store of new Set(seen.map((r) => (r.store ?? "").replace(".myshopify.com", "")))) why.push(`seen on ${store || "an ops store"}`);
    const listed = theme.themeStoreLive === true || seen.some((r) => r.themeStoreListed === true);
    if (listed) why.push("on the public Theme Store");
    out.set(String(theme._id), { onOpsStore: seen.length > 0, listed, why });
  }
  return out;
}

/** Ids of themes already past building: seen on an ops store or live on the Theme Store (the build-stage rule leaves their projects alone). */
export async function themesPastBuild(): Promise<Set<string>> {
  const facts = await loadFacts();
  return new Set([...facts].filter(([, f]) => f.onOpsStore || f.listed).map(([id]) => id));
}

/**
 * Moves each Theme Design & Development project whose theme shows up on an ops demo store to Under Review, and one whose theme is
 * live on the Theme Store to Live (lib/projects/reviewStatus.ts). Preset projects are not touched (a preset isn't a theme on those
 * stores). Returns what changed (with `dryRun`, what would).
 */
export async function syncReviewStatuses(options: { dryRun?: boolean } = {}): Promise<ReviewChange[]> {
  const projects = await Project.find({ type: { $in: ["theme_development", null] }, status: { $in: [...BEFORE_LIVE] } })
    .select("name themeId status")
    .lean<{ _id: unknown; name: string; themeId: unknown; status: string }[]>();
  if (projects.length === 0) return [];
  const facts = await loadFacts();

  const changes: ReviewChange[] = [];
  for (const p of projects) {
    const f = facts.get(String(p.themeId));
    if (!f) continue;
    const next = detectReviewStatus(p.status, f);
    if (!next) continue;
    changes.push({ projectId: String(p._id), name: p.name, from: p.status, to: next, why: f.why.join(", ") });
    if (!options.dryRun) await Project.updateOne({ _id: p._id, status: p.status }, { $set: { status: next } });
  }
  return changes;
}
