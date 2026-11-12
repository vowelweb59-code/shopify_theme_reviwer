import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { withLease } from "@/lib/jobs/lease";
import { executeAuditRun } from "@/lib/audit/executeAuditRun";
import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";
import { ThemeZip } from "@/models/theme-zip";
import { Project } from "@/models/project";
import { Finding } from "@/models/finding";
import { MAX_DESCRIPTION } from "@/lib/projects/constants";
import { pickLatestVersion } from "./compareVersions";
import { sanitizePresets } from "./presets";
import { fetchGitZip } from "./gitSource";
import { localUploadSource } from "./themeSource";
import { uploadThemeVersion } from "./uploadThemeVersion";
import { fetchPresetDemoStoreUrls } from "./themeStoreFeatures";
import { pickNextDueTheme } from "./autoAuditPlan";

const LEASE_TTL_MS = 90 * 60 * 1000;
const SEVERITY_ORDER: Record<string, number> = { blocker: 0, high: 1, medium: 2, low: 3 };

type ThemeRow = {
  _id: unknown;
  name: string;
  autoAuditAt?: Date | null;
  themeStoreLive?: boolean | null;
  gitRepoUrl?: string | null;
  gitBranch?: string | null;
  gitLastCommit?: string | null;
  demoStorePresets?: { label: string; url: string }[];
  themeStoreSlug?: string | null;
  themeStorePresets?: { name: string; slug: string }[];
};

/**
 * One turn of the automatic audit: takes the one live theme that is due (48 hours since its last attempt, see autoAuditPlan.ts),
 * pulls its latest code from Git, audits it against its live demo store, and makes sure a Theme Update project exists.
 * Only one theme runs at a time, across server instances too. Returns the theme's name, or null when nothing was due.
 */
export async function runNextAutoAudit(now: Date = new Date()): Promise<string | null> {
  await connectToDatabase();
  const themes = await Theme.find({ themeStoreLive: { $ne: false } }).lean<ThemeRow[]>();
  const next = pickNextDueTheme(themes, now);
  if (!next) return null;

  const outcome = await withLease("theme-auto-audit", LEASE_TTL_MS, async () => {
    // Marked first: a theme that fails or crashes the server waits its 48 hours instead of being retried in a tight loop.
    await Theme.updateOne({ _id: next._id }, { $set: { autoAuditAt: new Date(), autoAuditError: null } });
    const error = await auditTheme(next).catch((err) => (err instanceof Error ? err.message : String(err)));
    await Theme.updateOne({ _id: next._id }, { $set: { autoAuditError: error } });
  });
  return outcome.ran ? next.name : null;
}

/** Returns an error message, or null when the audit completed. */
async function auditTheme(theme: ThemeRow): Promise<string | null> {
  let gitNote: string | null = null;

  // 1. Code: a new commit becomes a stored version (the version is read from the theme's own files, never guessed).
  if (theme.gitRepoUrl) {
    try {
      const { buffer, commit } = await fetchGitZip(theme.gitRepoUrl, theme.gitBranch ?? null);
      if (commit !== theme.gitLastCommit) {
        const uploaded = await uploadThemeVersion(theme._id as never, new File([new Uint8Array(buffer)], `${theme.name}-${commit.slice(0, 8)}.zip`));
        if (uploaded.ok) await Theme.updateOne({ _id: theme._id }, { $set: { gitLastCommit: commit } });
        else gitNote = uploaded.error;
      }
    } catch (err) {
      gitNote = err instanceof Error ? err.message : String(err);
    }
  }

  // 2. The newest stored ZIP (from Git just now, or an earlier upload).
  const versions = await ThemeVersion.find({ themeId: theme._id }).lean();
  const latest = pickLatestVersion(versions);
  const zip = latest ? await ThemeZip.findOne({ themeVersionId: latest._id }).sort({ uploadedAt: -1 }) : null;
  if (!latest || !zip) return gitNote ?? "No Git repository is set and no ZIP has been uploaded for this theme.";

  // 3. The live demo stores: saved ones, else the ones the Theme Store listing shows for each preset.
  let presets = sanitizePresets(theme.demoStorePresets);
  if (presets.length === 0 && theme.themeStoreSlug && theme.themeStorePresets?.length) {
    const found = await fetchPresetDemoStoreUrls(theme.themeStoreSlug, theme.themeStorePresets);
    presets = sanitizePresets(found.filter((p) => p.url).map((p) => ({ label: p.name, url: p.url })));
    if (presets.length > 0) await Theme.updateOne({ _id: theme._id }, { $set: { demoStorePresets: presets } });
  }

  // 4. The audit itself (the same one the Run Audit button starts).
  const buffer = await localUploadSource(zip).getZipBuffer();
  const result = await executeAuditRun({ theme: { _id: theme._id }, buffer, demoStorePresets: presets, themeVersionId: latest._id, themeZipId: zip._id });
  if (!result.ok) return result.error;

  await ensureUpdateProject(theme, String((result.auditRun as { _id: unknown })._id));
  return gitNote; // an audit of the older ZIP still ran; say why the newest code wasn't read
}

/** A theme gets one Theme Update project (they track hours, not statuses); its description starts as the audit's top issues. */
async function ensureUpdateProject(theme: ThemeRow, auditRunId: string): Promise<void> {
  if (await Project.exists({ themeId: theme._id, type: "theme_update" })) return;
  const findings = await Finding.find({ auditRunId, status: { $nin: ["ignored", "resolved"] } })
    .select("ruleId severity finding recommendation")
    .lean<{ ruleId: string; severity: string; finding: string; recommendation?: string | null }[]>();
  const bestByRule = new Map<string, (typeof findings)[number]>();
  for (const f of findings) {
    const seen = bestByRule.get(f.ruleId);
    if (!seen || (SEVERITY_ORDER[f.severity] ?? 99) < (SEVERITY_ORDER[seen.severity] ?? 99)) bestByRule.set(f.ruleId, f);
  }
  const top = [...bestByRule.values()].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)).slice(0, 5);
  const description = top.length
    ? `Created automatically from the latest audit. Top issues:\n${top.map((f) => `- [${f.severity}] ${f.recommendation || f.finding}`).join("\n")}`.slice(0, MAX_DESCRIPTION)
    : "Created automatically from the latest audit (no open issues were found).";
  await Project.create({ themeId: theme._id, name: `${theme.name} update`, type: "theme_update", description });
}
