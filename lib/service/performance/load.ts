import "server-only";
import { entriesForDm } from "./entries";
import { computePerformance, type MemberPerformance, type PerfProject, WEEKLY_CAPACITY_MINUTES } from "./compute";
import { periodParam } from "../api/hours";
import { DM_AVAILABILITY, DM_DAILY_AVAILABILITY, dmHasLeft } from "../dm-members";
import { istDate } from "../import/text";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceProject } from "@/models/service-project";

export const slugOf = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface PerfMember extends MemberPerformance {
  slug: string;
  name: string;
  designation: string | null;
  /** Reported in the last 2 months and has not left the company. */
  active: boolean;
  left: boolean;
}
export interface PerfProjectInfo { id: string; name: string; status: string; reviewRating: number | null; fixed: boolean; hourlyRateCents: number | null }

export async function loadPerformance(onRaw?: string | null) {
  const week = periodParam("week", onRaw);
  const today = istDate(new Date());
  const [projectRows, dm] = await Promise.all([
    ServiceProject.find().select("name status reviewRating contract").lean<Array<{ _id: string; name: string; status: string; reviewRating: number | null; contract: { type: "HOURLY" | "FIXED"; hourlyRateCents: number | null; weeklyLimitMinutes: number | null } | null }>>(),
    entriesForDm(),
  ]);
  const projects: PerfProject[] = projectRows.map((p) => ({
    id: p._id, name: p.name, status: p.status, reviewRating: p.reviewRating ?? null,
    fixed: p.contract?.type === "FIXED", hourlyRateCents: p.contract?.hourlyRateCents ?? null, weeklyLimitMinutes: p.contract?.weeklyLimitMinutes ?? null,
  }));
  const capacityByMember = Object.fromEntries(Object.entries(DM_AVAILABILITY).map(([k, f]) => [k, Math.round(WEEKLY_CAPACITY_MINUTES * f)]));
  const computed = computePerformance({ projects, entries: dm.entries, today, weekStart: week.start, weekEnd: week.end, capacityByMember, dailyRules: DM_DAILY_AVAILABILITY });

  const profiles = await ServiceChatSender.find().select("externalId displayName designation").lean<Array<{ externalId: string; displayName: string; designation: string | null }>>();
  const designation = new Map<string, string | null>();
  for (const s of profiles) { const k = dm.keyOf(s.displayName); if (k && s.designation && !designation.get(k)) designation.set(k, s.designation); }

  const twoMonthsAgo = (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 2); return d.toISOString().slice(0, 10); })();
  const members: PerfMember[] = computed.map((m) => {
    const name = dm.nameOf.get(m.key) ?? m.key;
    const left = dmHasLeft(m.key);
    return { ...m, slug: slugOf(m.key), name, designation: designation.get(m.key) ?? null, left, active: !left && (m.lastReport ?? "") >= twoMonthsAgo };
  });
  // Members in the DM list who never reported are not shown: there is nothing to measure.
  const projectInfo = new Map<string, PerfProjectInfo>(projects.map((p) => [p.id, { id: p.id, name: p.name, status: p.status, reviewRating: p.reviewRating, fixed: p.fixed, hourlyRateCents: p.hourlyRateCents }]));
  return { week, today, capacityMinutes: WEEKLY_CAPACITY_MINUTES, members, projectInfo };
}
