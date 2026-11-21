import "server-only";
import { computeAnalytics, type AProject } from "./compute";
import { DM_AVAILABILITY, dmHasLeft } from "../dm-members";
import { istDate } from "../import/text";
import { weekOf } from "../import/week";
import { WEEKLY_CAPACITY_MINUTES } from "../performance/compute";
import { entriesForDm } from "../performance/entries";
import { slugOf } from "../performance/load";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceUpworkProfile } from "@/models/service-upwork";

export const RANGES = [
  { id: "12w", label: "Last 12 weeks", weeks: 12 },
  { id: "26w", label: "Last 26 weeks", weeks: 26 },
  { id: "52w", label: "Last 52 weeks", weeks: 52 },
  { id: "all", label: "All time", weeks: null },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export async function loadAnalytics(rangeRaw?: string | null) {
  const range = RANGES.find((r) => r.id === rangeRaw) ?? RANGES[0];
  const today = istDate(new Date());
  const monday = weekOf(today).start;
  const fromDate = range.weeks ? new Date(Date.parse(`${monday}T00:00:00Z`) - (range.weeks - 1) * 7 * 86_400_000).toISOString().slice(0, 10) : null;

  const [rows, profiles, clients, dm] = await Promise.all([
    ServiceProject.find().select("name status clientId reviewRating contract upworkProfileId people").lean<Array<{ _id: string; name: string; status: string; clientId: string | null; reviewRating: number | null; upworkProfileId: string | null; people: Array<{ role: string; name: string }>; contract: { type: "HOURLY" | "FIXED"; hourlyRateCents: number | null; weeklyLimitMinutes: number | null } | null }>>(),
    ServiceUpworkProfile.find().select("name").lean<Array<{ _id: string; name: string }>>(),
    ServiceClient.find().select("name").lean<Array<{ _id: string; name: string }>>(),
    entriesForDm(),
  ]);
  const profileName = new Map(profiles.map((p) => [p._id, p.name]));
  const projects: AProject[] = rows.map((p) => ({
    id: p._id, name: p.name, status: p.status, reviewRating: p.reviewRating ?? null, fixed: p.contract?.type === "FIXED", hourlyRateCents: p.contract?.hourlyRateCents ?? null,
    weeklyLimitMinutes: p.contract?.weeklyLimitMinutes ?? null, clientId: p.clientId, profile: p.upworkProfileId ? profileName.get(p.upworkProfileId) ?? null : null, people: p.people ?? [],
  }));
  const capacityByMember = Object.fromEntries(Object.entries(DM_AVAILABILITY).map(([k, f]) => [k, Math.round(WEEKLY_CAPACITY_MINUTES * f)]));
  const data = computeAnalytics({
    projects, clientNames: Object.fromEntries(clients.map((c) => [c._id, c.name])), entries: dm.entries, today, fromDate,
    capacityMinutes: WEEKLY_CAPACITY_MINUTES, capacityByMember,
  });
  const memberName = (key: string) => dm.nameOf.get(key) ?? key;
  // Leaderboards list only people who are still here: not left, and a report in the last 2 months.
  const twoMonthsAgo = (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 2); return d.toISOString().slice(0, 10); })();
  const isActive = (key: string) => !dmHasLeft(key) && (data.lastReportByMember[key] ?? "") >= twoMonthsAgo;
  return { range, today, fromDate, data, memberName, memberSlug: slugOf, left: (key: string) => dmHasLeft(key), isActive };
}
