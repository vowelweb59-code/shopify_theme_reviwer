import { createHash } from "node:crypto";
import { ChatReport } from "@/models/chat-report";
import { TeamMember } from "@/models/team-member";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";
import { TimeEntry } from "@/models/time-entry";
import { parseReport, splitReports } from "./parseReport";
import { resolveMember, resolveTheme, type ThemeRef } from "./resolve";

export type ImportInput = {
  /** Team member the reports belong to, when the importer already knows who posted them (a paste). */
  memberId?: string | null;
  /** The poster's name as the space shows it, matched to a team member when memberId isn't given. */
  sender?: string;
  text: string;
};
export type ImportSummary = {
  created: number;
  alreadyImported: number;
  needsReview: { text: string; reason: string }[];
};
export type ReprocessSummary = { checked: number; fixed: number; stillNeedsReview: { text: string; reason: string }[] };

/** Stable per report, so the same one imported twice is stored once. */
function reportKey(who: string, text: string): string {
  return createHash("sha1").update(`${who}\n${text.replace(/\s+/g, " ").trim().toLowerCase()}`).digest("hex");
}

// Everything classification needs, loaded once per run.
type Context = {
  themeRefs: ThemeRef[];
  memberRefs: { id: string; name: string }[];
  updatesOnly: Set<string>;
  updateByTheme: Map<string, { _id: unknown; memberIds: Set<string> }[]>;
};

async function loadContext(): Promise<Context> {
  const [themes, members, updateProjects, buildProjects] = await Promise.all([
    Theme.find().select("name themeStorePresets demoStorePresets").lean(),
    TeamMember.find().select("name updatesAndPresetsOnly").lean(),
    Project.find({ type: "theme_update" }).select("themeId members").lean(),
    // Projects saved before types existed have no type and are Theme Design & Development.
    Project.find({ type: { $in: ["theme_development", null] }, status: { $ne: "live" } }).select("themeId").lean(),
  ]);
  const building = new Set(buildProjects.map((p) => String(p.themeId)));
  const updateByTheme = new Map<string, { _id: unknown; memberIds: Set<string> }[]>();
  for (const p of updateProjects) {
    const list = updateByTheme.get(String(p.themeId)) ?? [];
    list.push({ _id: p._id, memberIds: new Set(p.members.map((m: { memberId: unknown }) => String(m.memberId))) });
    updateByTheme.set(String(p.themeId), list);
  }
  return {
    themeRefs: themes.map((t) => ({
      id: String(t._id),
      name: t.name as string,
      presets: [...new Set([...(t.themeStorePresets ?? []).map((p: { name: string }) => p.name), ...(t.demoStorePresets ?? []).map((p: { label: string }) => p.label)])],
      building: building.has(String(t._id)),
    })),
    memberRefs: members.map((m) => ({ id: String(m._id), name: m.name as string })),
    updatesOnly: new Set(members.filter((m) => m.updatesAndPresetsOnly).map((m) => String(m._id))),
    updateByTheme,
  };
}

type Built = {
  doc: Record<string, unknown>;
  /** The Theme Update hours entry this report makes, when it is update work that can be logged. */
  entry: Record<string, unknown> | null;
  reasons: string[];
};

/** Classifies one report text: who, which theme, theme / preset / update, and whether it can be logged. Null when the text isn't a usable report. */
function buildReport(text: string, memberId: string | null, sender: string, key: string, ctx: Context): Built | { error: string } {
  const parsed = parseReport(text);
  if (!parsed.ok) return { error: parsed.error };
  const theme = resolveTheme(parsed.value, ctx.themeRefs, { updatesAndPresetsOnly: memberId !== null && ctx.updatesOnly.has(memberId) });
  const reasons = [theme.ok ? "" : theme.reason, memberId ? "" : `Could not match "${sender || "the poster"}" to a team member.`].filter(Boolean);

  // Update work is logged as hours on the theme's Theme Update project, when there is exactly one and the poster is on its team.
  let updateProject: { _id: unknown } | null = null;
  if (theme.ok && theme.kind === "update") {
    const projects = ctx.updateByTheme.get(theme.themeId) ?? [];
    if (projects.length !== 1) reasons.push(projects.length === 0 ? `${theme.themeName} has no Theme Update project to log the hours on.` : `${theme.themeName} has more than one Theme Update project.`);
    else if (memberId && !projects[0].memberIds.has(memberId)) reasons.push(`${sender || "The poster"} isn't on the ${theme.themeName} Theme Update team.`);
    else if (memberId) updateProject = projects[0];
  }

  const date = new Date(`${parsed.value.date}T00:00:00.000Z`);
  return {
    doc: {
      key,
      sender,
      memberId,
      date,
      themeName: parsed.value.themeParts[0],
      themeId: theme.ok ? theme.themeId : null,
      kind: theme.ok ? theme.kind : null,
      preset: theme.ok ? theme.preset : null,
      memo: parsed.value.memo,
      minutes: parsed.value.minutes,
      projectId: updateProject?._id ?? null,
      status: reasons.length === 0 ? "ok" : "needs_review",
      reason: reasons.join(" ") || null,
      rawText: text,
    },
    entry: updateProject && memberId ? { projectId: updateProject._id, memberId, date, hours: Math.round((parsed.value.minutes / 60) * 100) / 100, note: parsed.value.memo, chatReportKey: key } : null,
    reasons,
  };
}

/**
 * Parses, resolves and stores every report in the given texts. A text with
 * several reports is split at each "Date" line. Reports that can't be
 * matched are kept as needs_review with the reason, not dropped.
 *
 * Works in bulk (one lookup for what is already stored, one insert for the
 * rest) because a first sync of the space can be hundreds of reports and
 * one database round trip per report is far too slow for a web request.
 */
export async function importReports(inputs: ImportInput[]): Promise<ImportSummary> {
  const ctx = await loadContext();
  const memberIds = new Set(ctx.memberRefs.map((m) => m.id));

  // Every report in every input, with its key.
  const candidates = inputs.flatMap((input) => {
    const given = input.memberId && memberIds.has(input.memberId) ? input.memberId : null;
    const memberId = given ?? (input.sender ? resolveMember(input.sender, ctx.memberRefs) : null);
    const sender = input.sender?.trim() || ctx.memberRefs.find((m) => m.id === memberId)?.name || "";
    return splitReports(input.text).map((text) => ({ text, memberId, sender, key: reportKey(memberId ?? sender, text) }));
  });
  const stored = new Set((await ChatReport.find({ key: { $in: candidates.map((c) => c.key) } }).select("key").lean()).map((r) => r.key as string));

  const summary: ImportSummary = { created: 0, alreadyImported: 0, needsReview: [] };
  const reports: Record<string, unknown>[] = [];
  const entries: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const { text, memberId, sender, key } of candidates) {
    if (stored.has(key) || seen.has(key)) {
      summary.alreadyImported++;
      continue;
    }
    seen.add(key);
    const built = buildReport(text, memberId, sender, key, ctx);
    if ("error" in built) {
      // Nothing usable to store (no date or hours): report it back without saving.
      summary.needsReview.push({ text, reason: built.error });
      continue;
    }
    reports.push(built.doc);
    if (built.entry) entries.push(built.entry);
    summary.created++;
    if (built.reasons.length > 0) summary.needsReview.push({ text, reason: built.reasons.join(" ") });
  }

  // ordered: false so one bad row (or a key stored by a concurrent run) doesn't stop the rest.
  if (reports.length > 0) await ChatReport.insertMany(reports, { ordered: false });
  if (entries.length > 0) await TimeEntry.insertMany(entries, { ordered: false });
  return summary;
}

/**
 * Re-classifies the stored reports that needed a look, with the current rules
 * (a new Theme Update project, a fixed team member, better name matching), without
 * reading the space again. Reports that now resolve become ok, and update work that
 * can now be logged gets its hours entry.
 */
export async function reprocessFlaggedReports(): Promise<ReprocessSummary> {
  const ctx = await loadContext();
  const flagged = await ChatReport.find({ status: "needs_review" }).lean();

  const operations: Record<string, unknown>[] = [];
  const entries: Record<string, unknown>[] = [];
  const summary: ReprocessSummary = { checked: flagged.length, fixed: 0, stillNeedsReview: [] };

  for (const report of flagged) {
    // The poster may have been matched since (a renamed team member).
    const memberId = report.memberId ? String(report.memberId) : report.sender ? resolveMember(report.sender, ctx.memberRefs) : null;
    const built = buildReport(report.rawText, memberId, report.sender ?? "", report.key, ctx);
    if ("error" in built) {
      summary.stillNeedsReview.push({ text: report.rawText, reason: built.error });
      continue;
    }
    const fields = { ...built.doc };
    delete fields.key;
    operations.push({ updateOne: { filter: { _id: report._id }, update: { $set: fields } } });
    if (built.entry) entries.push(built.entry);
    if (built.reasons.length === 0) summary.fixed++;
    else summary.stillNeedsReview.push({ text: report.rawText, reason: built.reasons.join(" ") });
  }

  if (operations.length > 0) await ChatReport.bulkWrite(operations as never, { ordered: false });
  // A hours entry per report key, once: the unique chatReportKey index rejects a repeat.
  if (entries.length > 0) await TimeEntry.insertMany(entries, { ordered: false }).catch(() => undefined);
  return summary;
}
