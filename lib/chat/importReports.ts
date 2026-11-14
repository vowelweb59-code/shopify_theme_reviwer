import { createHash } from "node:crypto";
import { ChatReport } from "@/models/chat-report";
import { TeamMember } from "@/models/team-member";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";
import { TimeEntry } from "@/models/time-entry";
import { syncBuildStatuses } from "@/lib/projects/syncBuildStatuses";
import { supersededReports } from "./superseded";
import { parseReport, splitReports, splitThemes } from "./parseReport";
import { isIgnoredThemeLine, resolveMember, resolveTheme, type ThemeRef } from "./resolve";

export type ImportInput = {
  /** Team member the reports belong to, when the importer already knows who posted them (a paste). */
  memberId?: string | null;
  /** The poster's name as the space shows it, matched to a team member when memberId isn't given. */
  sender?: string;
  text: string;
  /** The day the message was posted (YYYY-MM-DD); used for a report that has no date of its own. */
  postedOn?: string;
  /** The exact time the message was posted (ISO), kept on the report. */
  postedAt?: string;
  /** The Chat message's id; with it, an edited message replaces the reports its old text made. */
  messageId?: string;
};
export type ImportSummary = {
  created: number;
  /** Reports removed because their message was edited and its new text made new ones. */
  replaced?: number;
  alreadyImported: number;
  needsReview: { text: string; reason: string }[];
};
export type ReprocessSummary = {
  checked: number;
  fixed: number;
  stillNeedsReview: { text: string; reason: string }[];
  /** Only on a dry run: where each report that would be fixed goes. */
  wouldFix?: { sender: string; date: string; hours: number; line: string; to: string }[];
};

/** Puts each poster on the team of the Theme Update project their hours are logged on (once; nobody is added twice). */
async function addPostersToTeams(adds: { projectId: unknown; memberId: string }[]): Promise<void> {
  const unique = new Map(adds.map((a) => [`${String(a.projectId)}:${a.memberId}`, a]));
  if (unique.size === 0) return;
  await Project.bulkWrite(
    [...unique.values()].map((a) => ({
      updateOne: { filter: { _id: a.projectId, "members.memberId": { $ne: a.memberId } }, update: { $push: { members: { memberId: a.memberId, role: null } } } },
    })) as never,
    { ordered: false }
  );
}

/** Moves early-stage projects to Under Designing / Under Development by who has reported (lib/projects/buildStatus.ts); never fails an import. */
async function syncStatusesQuietly(): Promise<void> {
  try {
    await syncBuildStatuses();
  } catch (err) {
    console.error("[chat] build status sync failed:", err instanceof Error ? err.message : err);
  }
}

type Candidate = { sender: string; postedAt?: string; messageId?: string; key: string; wholeKey: string };

/**
 * For each Chat message read again: removes the stored reports (and the Theme Update hours made from them) that the message's current
 * text no longer makes, and records the message id on the ones it still makes. Returns how many were replaced.
 */
async function replaceEditedReports(candidates: Candidate[]): Promise<number> {
  const messages = new Map<string, { id: string; sender: string; postedAt?: string; keys: Set<string> }>();
  for (const c of candidates) {
    if (!c.messageId) continue;
    const m = messages.get(c.messageId) ?? { id: c.messageId, sender: c.sender, postedAt: c.postedAt, keys: new Set<string>() };
    m.keys.add(c.key);
    m.keys.add(c.wholeKey);
    messages.set(c.messageId, m);
  }
  if (messages.size === 0) return 0;

  const postedAts = [...messages.values()].flatMap((m) => (m.postedAt ? [new Date(m.postedAt)] : []));
  const existing = await ChatReport.find({ $or: [{ messageId: { $in: [...messages.keys()] } }, { messageId: null, postedAt: { $in: postedAts } }] })
    .select("key messageId sender postedAt locked")
    .lean<{ _id: unknown; key: string; messageId?: string | null; sender: string; postedAt?: Date | null; locked?: boolean }[]>();

  const stale = [...messages.values()].flatMap((m) => supersededReports(existing, m));
  if (stale.length > 0) {
    await TimeEntry.deleteMany({ chatReportKey: { $in: stale.map((r) => r.key) } });
    await ChatReport.deleteMany({ _id: { $in: stale.map((r) => r._id) } });
  }
  // The reports a message still makes remember where they came from, so a later edit finds them by id.
  for (const m of messages.values()) await ChatReport.updateMany({ key: { $in: [...m.keys] }, messageId: null }, { $set: { messageId: m.id } });
  return stale.length;
}

/** Stable per report, so the same one imported twice is stored once. */
function reportKey(who: string, text: string): string {
  return createHash("sha1").update(`${who}\n${text.replace(/\s+/g, " ").trim().toLowerCase()}`).digest("hex");
}

// Everything classification needs, loaded once per run.
type Context = {
  themeRefs: ThemeRef[];
  memberRefs: { id: string; name: string; aliases: string[] }[];
  updatesOnly: Set<string>;
  updateByTheme: Map<string, { _id: unknown; memberIds: Set<string> }[]>;
  /** Themes with a preset-development project that isn't Live: their preset hours are new development, not updates. */
  presetDev: Set<string>;
  /** Product Managers (designation contains "manager") and inactive members: never assigned to a project automatically. */
  managers: Set<string>;
  /** theme id -> its Theme Design & Development projects that aren't Live (a new-theme report puts its poster on the team when there is exactly one). */
  devProjectsByTheme: Map<string, unknown[]>;
};

async function loadContext(): Promise<Context> {
  const [themes, members, updateProjects, buildProjects] = await Promise.all([
    Theme.find().select("name themeStorePresets demoStorePresets").lean(),
    TeamMember.find().select("name aliases updatesAndPresetsOnly designation inactive").lean(),
    Project.find({ type: "theme_update" }).select("themeId members").lean(),
    // Projects saved before types existed have no type and are Theme Design & Development.
    Project.find({ type: { $in: ["theme_development", "preset_development", null] }, status: { $ne: "live" } }).select("themeId type").lean(),
  ]);
  const building = new Set(buildProjects.filter((p) => p.type !== "preset_development").map((p) => String(p.themeId)));
  const presetDev = new Set(buildProjects.filter((p) => p.type === "preset_development").map((p) => String(p.themeId)));
  const devProjectsByTheme = new Map<string, unknown[]>();
  for (const p of buildProjects) {
    if (p.type === "preset_development") continue;
    devProjectsByTheme.set(String(p.themeId), [...(devProjectsByTheme.get(String(p.themeId)) ?? []), p._id]);
  }
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
    memberRefs: members.map((m) => ({ id: String(m._id), name: m.name as string, aliases: (m.aliases ?? []) as string[] })),
    updatesOnly: new Set(members.filter((m) => m.updatesAndPresetsOnly).map((m) => String(m._id))),
    managers: new Set(members.filter((m) => /manager/i.test(String(m.designation ?? "")) || m.inactive).map((m) => String(m._id))),
    updateByTheme,
    presetDev,
    devProjectsByTheme,
  };
}

type Built = {
  /** Set when logging the hours needs the poster added to the Theme Update project's team. */
  addToTeam: { projectId: unknown; memberId: string } | null;
  doc: Record<string, unknown>;
  /** The Theme Update hours entry this report makes, when it is update work that can be logged. */
  entry: Record<string, unknown> | null;
  reasons: string[];
};

/** Classifies one report text: who, which theme, theme / preset / update, and whether it can be logged. Null when the text isn't a usable report. */
function buildReport(text: string, memberId: string | null, sender: string, key: string, ctx: Context, postedOn?: string, postedAt?: string): Built | { error: string } {
  const parsed = parseReport(text, postedOn);
  if (!parsed.ok) return { error: parsed.error };

  // Not theme work (client work, Webflow, the portals, one-off tasks): kept for the record, ignored everywhere.
  if (isIgnoredThemeLine(parsed.value.themeParts)) {
    return {
      addToTeam: null,
      doc: {
        key,
        sender,
        memberId,
        date: new Date(`${parsed.value.date}T00:00:00.000Z`),
        postedAt: postedAt ? new Date(postedAt) : null,
        themeName: parsed.value.themeParts[0],
        themeId: null,
        kind: null,
        preset: null,
        memo: parsed.value.memo,
        minutes: parsed.value.minutes,
        projectId: null,
        status: "ignored",
        reason: "Not theme work, so it isn't counted.",
        rawText: text,
      },
      entry: null,
      reasons: [],
    };
  }
  const theme = resolveTheme(parsed.value, ctx.themeRefs, { updatesAndPresetsOnly: memberId !== null && ctx.updatesOnly.has(memberId) });
  const reasons = [theme.ok ? "" : theme.reason, memberId ? "" : `Could not match "${sender || "the poster"}" to a team member.`].filter(Boolean);

  // Update work is logged as hours on the theme's "<Theme> Update" project (there must be exactly one). That is theme updates,
  // and preset work on a theme whose presets are not new development; the poster joins its team if they aren't on it yet.
  let updateProject: { _id: unknown } | null = null;
  let addToTeam: Built["addToTeam"] = null;
  const presetUpdate = theme.ok && theme.kind === "preset" && !ctx.presetDev.has(theme.themeId) && !ctx.themeRefs.find((t) => t.id === theme.themeId)?.building;
  if (theme.ok && (theme.kind === "update" || presetUpdate)) {
    const projects = ctx.updateByTheme.get(theme.themeId) ?? [];
    if (projects.length !== 1) reasons.push(projects.length === 0 ? `${theme.themeName} has no Theme Update project to log the hours on.` : `${theme.themeName} has more than one Theme Update project.`);
    else if (memberId) {
      updateProject = projects[0];
      if (!projects[0].memberIds.has(memberId) && !ctx.managers.has(memberId)) addToTeam = { projectId: projects[0]._id, memberId };
    }
  }

  // New-theme work: whoever reports on a theme being built joins that theme's design & development project (when it is the only one).
  if (!addToTeam && theme.ok && theme.kind === "theme" && memberId && !ctx.managers.has(memberId)) {
    const dev = ctx.devProjectsByTheme.get(theme.themeId) ?? [];
    if (dev.length === 1) addToTeam = { projectId: dev[0], memberId };
  }

  const date = new Date(`${parsed.value.date}T00:00:00.000Z`);
  return {
    addToTeam,
    doc: {
      key,
      sender,
      memberId,
      date,
      postedAt: postedAt ? new Date(postedAt) : null,
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
    // A message listing several themes is stored per theme, unless it was already stored whole (an earlier import): then it is left as it is.
    return splitReports(input.text).flatMap((chunk) => {
      const wholeKey = reportKey(memberId ?? sender, chunk);
      return splitThemes(chunk).map((text) => ({ text, memberId, sender, postedOn: input.postedOn, postedAt: input.postedAt, messageId: input.messageId, key: reportKey(memberId ?? sender, text), wholeKey }));
    });
  });
  const stored = new Set((await ChatReport.find({ key: { $in: candidates.flatMap((c) => [c.key, c.wholeKey]) } }).select("key").lean()).map((r) => r.key as string));

  // Edited messages: the reports their old text made are replaced by what the current text makes.
  const replaced = await replaceEditedReports(candidates);

  const summary: ImportSummary = { created: 0, replaced, alreadyImported: 0, needsReview: [] };
  const reports: Record<string, unknown>[] = [];
  const entries: Record<string, unknown>[] = [];
  const teamAdds: { projectId: unknown; memberId: string }[] = [];
  const seen = new Set<string>();

  for (const { text, memberId, sender, key, postedOn, postedAt, wholeKey, messageId } of candidates) {
    if (stored.has(key) || stored.has(wholeKey) || seen.has(key)) {
      summary.alreadyImported++;
      continue;
    }
    seen.add(key);
    const built = buildReport(text, memberId, sender, key, ctx, postedOn, postedAt);
    if ("error" in built) {
      // Nothing usable to store (no date or hours): report it back without saving.
      summary.needsReview.push({ text, reason: built.error });
      continue;
    }
    reports.push({ ...built.doc, messageId: messageId ?? null });
    if (built.entry) entries.push(built.entry);
    if (built.addToTeam) teamAdds.push(built.addToTeam);
    summary.created++;
    if (built.reasons.length > 0) summary.needsReview.push({ text, reason: built.reasons.join(" ") });
  }

  // ordered: false so one bad row (or a key stored by a concurrent run) doesn't stop the rest.
  if (reports.length > 0) await ChatReport.insertMany(reports, { ordered: false });
  await addPostersToTeams(teamAdds);
  await syncStatusesQuietly();
  if (entries.length > 0) await TimeEntry.insertMany(entries, { ordered: false });
  return summary;
}

/**
 * Re-classifies the stored reports that needed a look, with the current rules
 * (a new Theme Update project, a fixed team member, better name matching), without
 * reading the space again. Reports that now resolve become ok, and update work that
 * can now be logged gets its hours entry.
 */
export async function reprocessFlaggedReports(options: { dryRun?: boolean } = {}): Promise<ReprocessSummary> {
  const ctx = await loadContext();
  // The flagged ones, plus preset reports not yet logged as hours (a preset update on a finished theme is logged on its Update project).
  const flagged = await ChatReport.find({ locked: { $ne: true }, $or: [{ status: "needs_review" }, { kind: "preset", projectId: null }] }).lean();

  const operations: Record<string, unknown>[] = [];
  const entries: Record<string, unknown>[] = [];
  const teamAdds: { projectId: unknown; memberId: string }[] = [];
  const summary: ReprocessSummary = { checked: flagged.length, fixed: 0, stillNeedsReview: [], ...(options.dryRun ? { wouldFix: [] } : {}) };

  for (const report of flagged) {
    // The poster may have been matched since (a renamed team member).
    const memberId = report.memberId ? String(report.memberId) : report.sender ? resolveMember(report.sender, ctx.memberRefs) : null;
    const built = buildReport(report.rawText, memberId, report.sender ?? "", report.key, ctx, report.date ? new Date(report.date).toISOString().slice(0, 10) : undefined);
    if ("error" in built) {
      summary.stillNeedsReview.push({ text: report.rawText, reason: built.error });
      continue;
    }
    const fields = { ...built.doc };
    delete fields.key;
    operations.push({ updateOne: { filter: { _id: report._id }, update: { $set: fields } } });
    if (built.entry) entries.push(built.entry);
    if (built.addToTeam) teamAdds.push(built.addToTeam);
    if (built.reasons.length === 0 && report.status === "needs_review" && summary.wouldFix) {
      const d = built.doc as { themeName: string; kind: string | null; preset: string | null };
      const theme = ctx.themeRefs.find((t) => t.id === String(built.doc.themeId))?.name ?? d.themeName;
      summary.wouldFix.push({
        sender: report.sender ?? "",
        date: report.date ? new Date(report.date).toISOString().slice(0, 10) : "",
        hours: Math.round((report.minutes / 60) * 10) / 10,
        line: d.themeName,
        to: built.doc.status === "ignored" ? "ignored (not theme work, not counted)" : `${theme} | ${d.kind ?? "?"}${d.preset ? " | " + d.preset : ""}${built.entry ? " (hours logged on its Update project)" : ""}`,
      });
    }
    if (built.reasons.length === 0) summary.fixed += report.status === "needs_review" ? 1 : 0;
    else summary.stillNeedsReview.push({ text: report.rawText, reason: built.reasons.join(" ") });
  }

  if (options.dryRun) return summary;
  if (operations.length > 0) await ChatReport.bulkWrite(operations as never, { ordered: false });
  await addPostersToTeams(teamAdds);
  await syncStatusesQuietly();
  // A hours entry per report key, once: the unique chatReportKey index rejects a repeat.
  if (entries.length > 0) await TimeEntry.insertMany(entries, { ordered: false }).catch(() => undefined);
  return summary;
}
