import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { versionTimeRows, type TimeEntryDay } from "@/lib/projects/versionTime";
import { istDay } from "@/lib/time/ist";
import { fetchStoreVersionHistory, type StoreVersion } from "@/lib/themes/versionHistory";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";
import { Theme } from "@/models/theme";
import { TimeEntry } from "@/models/time-entry";

const FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Time spent per Theme Store version, for a Theme Update project: the Theme Store's release dates (read from its release notes,
 * cached on the theme for a day, or sooner when the store has a newer version than the cache) set the windows, and the project's
 * hours log (the developers' reports) fills them. See lib/projects/versionTime.ts.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();

  const project = await Project.findById(projectId).select("themeId type").lean<{ themeId: unknown; type?: string | null }>();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (project.type !== "theme_update") return NextResponse.json({ error: "Time per version is only for Theme Update projects." }, { status: 400 });

  const theme = await Theme.findById(project.themeId)
    .select("name themeStoreSlug themeStorePresets themeStoreVersion themeStoreVersions themeStoreVersionsAt")
    .lean<{
      name: string;
      themeStoreSlug?: string | null;
      themeStorePresets?: { slug: string }[];
      themeStoreVersion?: string | null;
      themeStoreVersions?: StoreVersion[];
      themeStoreVersionsAt?: Date | null;
    }>();
  if (!theme) return NextResponse.json({ error: "Theme not found." }, { status: 404 });

  let versions: StoreVersion[] = theme.themeStoreVersions ?? [];
  let refreshedAt = theme.themeStoreVersionsAt ?? null;
  const cacheOld = !refreshedAt || Date.now() - refreshedAt.getTime() > FRESH_MS;
  const storeIsNewer = Boolean(theme.themeStoreVersion && versions[0] && versions[0].version !== theme.themeStoreVersion);
  let error: string | null = null;
  if (theme.themeStoreSlug && (versions.length === 0 || cacheOld || storeIsNewer)) {
    const fetched =
      (await fetchStoreVersionHistory(theme.themeStoreSlug)) ??
      (theme.themeStorePresets?.[0]?.slug ? await fetchStoreVersionHistory(theme.themeStoreSlug, theme.themeStorePresets[0].slug) : null);
    if (fetched) {
      versions = fetched;
      refreshedAt = new Date();
      await Theme.updateOne({ _id: project.themeId }, { $set: { themeStoreVersions: fetched, themeStoreVersionsAt: refreshedAt } });
    } else if (versions.length === 0) {
      error = "Couldn't read this theme's release notes from the Shopify Theme Store.";
    }
  } else if (!theme.themeStoreSlug) {
    error = "This theme has no Shopify Theme Store listing saved yet (use Check Theme Store on the theme page).";
  }

  const entries = await TimeEntry.find({ projectId }).select("memberId date hours").lean<{ memberId: unknown; date: Date; hours: number }[]>();
  const members = await TeamMember.find({ _id: { $in: [...new Set(entries.map((e) => String(e.memberId)))] } }).select("name").lean<{ _id: unknown; name: string }[]>();
  const nameById = new Map(members.map((m) => [String(m._id), m.name]));
  const days: TimeEntryDay[] = entries.map((e) => ({
    date: e.date.toISOString().slice(0, 10),
    hours: e.hours,
    memberId: String(e.memberId),
    name: nameById.get(String(e.memberId)) ?? "Removed member",
  }));

  const result = versionTimeRows(versions, days, istDay(new Date()));
  return NextResponse.json({
    themeName: theme.name,
    rows: result.rows,
    undated: result.undated,
    refreshedAt,
    entryCount: entries.length,
    // The earliest day anything was logged: releases before it have no reports to count, which is not the same as no work.
    firstEntryOn: days.length > 0 ? days.map((d) => d.date).sort()[0] : null,
    error,
  });
}
