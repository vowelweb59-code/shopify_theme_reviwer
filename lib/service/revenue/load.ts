import { memo } from "@/lib/cache/memo";
import { senderNames } from "../api/hours";
import { dmMatch } from "../dm-members";
import { isManualSender } from "../hours/manual-hours";
import { loadAllTimeEntries } from "../hours/all-time";
import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import { profileKey, type AppClient, type ProjectHours, type RevProject, type SheetRow } from "./by-project";
import { normName } from "./match";
import { NOT_STARTED_HOLD_REASON } from "../projects/activity-rules";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceRevenueTaken } from "@/models/service-revenue";
import { ServiceUpworkProfile } from "@/models/service-upwork";

/**
 * Not started as the owner keeps it (2026-11-24): the status is Not started, or the project is On hold because the team worked on it
 * while it was still Not started (`NOT_STARTED_HOLD_REASON` is its newest status change; any later change by hand ends it).
 */
export function isNotStartedProject(status: string, history: Array<{ toStatus: string; reason: string | null; at: Date }>): boolean {
  if (status === "NOT_STARTED") return true;
  if (status !== "ON_HOLD") return false;
  const latest = [...(history ?? [])].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
  return latest?.reason === NOT_STARTED_HOLD_REASON;
}

/** What the Revenue tab compares: the imported sheet rows, the app's clients and the reported minutes per project and month. */
export const loadRevenueInput = () => memo("service:revenue-input", 30_000, loadRevenueInputUncached);

async function loadRevenueInputUncached(): Promise<{ taken: SheetRow[]; clients: AppClient[]; projects: RevProject[]; hours: ProjectHours[] }> {
  // Every project of the app (owner, 2026-11-21: the count must match the Projects tab), with the profile that tells which project a sheet row is for.
  const [takenDocs, clientDocs, projects, profileDocs, att] = await Promise.all([
    ServiceRevenueTaken.find()
      .select("month clientName profile amountCents")
      .lean<Array<{ month: string; clientName: string; profile: string | null; amountCents: number }>>(),
    ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>(),
    ServiceProject.find().select("name clientId status contract upworkProfileId history").lean<
      Array<{
        _id: string;
        name: string;
        clientId: string | null;
        status: string;
        upworkProfileId: string | null;
        history: Array<{ toStatus: string; reason: string | null; at: Date }>;
        contract: { type: "HOURLY" | "FIXED"; hourlyRateCents: number | null } | null;
      }>
    >(),
    ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>(),
    loadAttribution(),
  ]);
  const profileKeys = new Map(profileDocs.map((p) => [p._id, [p.name, ...(p.aliases ?? [])].map(profileKey).filter(Boolean)]));
  // The sales sheet is the Digital Marketing team's revenue only (owner, 2026-11-17), so only the team's own hours are worth counting
  // against it: some projects also have people from other teams reporting on them.
  const [allEntries, names] = await Promise.all([loadAllTimeEntries(), senderNames()]);
  const entries = allEntries.filter((e) => dmMatch(names.get(e.senderExternalId)) !== null || isManualSender(e.senderExternalId));
  const byProject = new Map(projects.map((p) => [p._id, p]));
  const sums = new Map<string, number>();
  for (const e of expandAllocations(entries)) {
    const pid = projectOf(e, att.owner);
    if (!pid || !byProject.has(pid)) continue;
    const k = `${pid}|${e.entryDate.toISOString().slice(0, 7)}`;
    sums.set(k, (sums.get(k) ?? 0) + e.minutes);
  }
  // Two client records with the same name are one client here (otherwise a sheet name would match two and be skipped).
  const canonical = new Map<string, string>();
  const idOf = (c: { _id: string; name: string }) => {
    const k = normName(c.name);
    if (!canonical.has(k)) canonical.set(k, c._id);
    return canonical.get(k)!;
  };
  const canonicalOf = new Map(clientDocs.map((c) => [c._id, idOf(c)]));
  const hours: ProjectHours[] = [...sums].map(([k, minutes]) => {
    const [projectId, month] = k.split("|");
    return { projectId: projectId!, month: month!, minutes };
  });
  const revProjects: RevProject[] = projects.map((p) => ({
    id: p._id,
    name: p.name,
    status: p.status,
    clientId: p.clientId ? (canonicalOf.get(p.clientId) ?? p.clientId) : null,
    profileKeys: p.upworkProfileId ? (profileKeys.get(p.upworkProfileId) ?? []) : [],
    type: p.contract?.type ?? null,
    rateCents: p.contract?.hourlyRateCents ?? null,
    notStarted: isNotStartedProject(p.status, p.history),
  }));
  const clients: AppClient[] = [];
  for (const c of clientDocs) {
    const id = canonicalOf.get(c._id)!;
    const have = clients.find((x) => x.id === id);
    if (have) have.aliases = [...have.aliases, ...c.aliases];
    else clients.push({ id, name: c.name, aliases: [...c.aliases] });
  }
  return {
    taken: takenDocs.map((t) => ({ month: t.month, clientName: t.clientName, profile: t.profile ?? null, amountCents: t.amountCents })),
    clients,
    projects: revProjects,
    hours,
  };
}
