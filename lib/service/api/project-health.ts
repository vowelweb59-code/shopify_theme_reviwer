import { connectToDatabase } from "@/lib/db/connect";
import { loadAllTimeEntries } from "@/lib/service/hours/all-time";
import { expandAllocations, loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { workableMinutes } from "@/lib/service/hours/fixed-budget";
import { istDate } from "@/lib/service/import/text";
import { weekOf } from "@/lib/service/import/week";
import { combineHealth, numberReasons, type ChatHealth, type ProjectHealth } from "@/lib/service/projects/health";
import { ServiceProject } from "@/models/service-project";
import { ServiceProjectSpace } from "@/models/service-project-space";
import { ServiceSpaceReview } from "@/models/service-space-review";

// Which projects are "going in the incorrect direction" (owner, 2026-11-28: shown in red in the Live Project Chat Summary tabs and marked in the
// Projects tab's Active and On hold views). Two halves, combined by `combineHealth`: Claude Code's judgement of the project's Chat space(s), stored
// with the reviewed list (chat signals), and numbers computed here from the reported hours and the contract (`numberReasons`, running projects only).
// The map holds only projects with something to show (red or watch).

const WEEKS = 7; // this week and the six before it

export async function loadProjectHealth(now = new Date()): Promise<Map<string, ProjectHealth>> {
  await connectToDatabase();
  const [projects, att, entries, links, reviews] = await Promise.all([
    ServiceProject.find({ status: { $in: ["ACTIVE", "BLOCKED", "PARTIAL_HOLD", "ON_HOLD", "WAITING_FOR_CLIENT"] } })
      .select("name status contract")
      .lean<
        Array<{
          _id: string;
          status: string;
          contract?: { type?: string; hourlyRateCents?: number | null; weeklyLimitMinutes?: number | null; fixedPriceCents?: number | null } | null;
        }>
      >(),
    loadAttribution(),
    loadAllTimeEntries(),
    ServiceProjectSpace.find().lean(),
    ServiceSpaceReview.find().select("health projectId").lean(),
  ]);

  const today = istDate(now);
  const thisMonday = Date.parse(`${weekOf(today).start}T00:00:00Z`);
  const total = new Map<string, number>();
  const weeks = new Map<string, number[]>();
  const lastDay = new Map<string, string>();
  for (const e of expandAllocations(entries)) {
    const pid = projectOf(e, att.owner);
    if (!pid) continue;
    const day = e.entryDate.toISOString().slice(0, 10);
    if (day > today) continue; // dates after today are typing errors
    total.set(pid, (total.get(pid) ?? 0) + e.minutes);
    if (day > (lastDay.get(pid) ?? "")) lastDay.set(pid, day);
    const idx = Math.round((thisMonday - Date.parse(`${weekOf(day).start}T00:00:00Z`)) / (7 * 86_400_000));
    if (idx >= 0 && idx < WEEKS) {
      const w = weeks.get(pid) ?? Array<number>(WEEKS).fill(0);
      w[idx] += e.minutes;
      weeks.set(pid, w);
    }
  }

  // Chat judgement per project: its connected spaces (the link rows, and the legacy link stored on a review).
  const healthOfSpace = new Map(reviews.map((r) => [r._id, r.health as ChatHealth | null | undefined]));
  const spacesOf = new Map<string, Set<string>>();
  const addSpace = (projectId: string, space: string) => spacesOf.set(projectId, (spacesOf.get(projectId) ?? new Set()).add(space));
  for (const l of links) addSpace(l.projectId, l._id);
  for (const r of reviews) if (r.projectId && !links.some((l) => l._id === r._id)) addSpace(r.projectId, r._id);

  const out = new Map<string, ProjectHealth>();
  for (const p of projects) {
    const c = p.contract;
    const kind = c?.type === "FIXED" ? "fixed" : c && (c.hourlyRateCents != null || c.weeklyLimitMinutes != null) ? "hourly" : "unset";
    const numbers = numberReasons({
      status: p.status,
      kind,
      weeklyLimitMinutes: c?.weeklyLimitMinutes ?? null,
      // A fixed project that also has an hourly rate is billed by the hours: it has no cap to run out of.
      workableMinutes: kind === "fixed" && c?.hourlyRateCents == null ? workableMinutes(c?.fixedPriceCents) : null,
      totalMinutes: total.get(p._id) ?? 0,
      weekMinutes: weeks.get(p._id) ?? Array<number>(WEEKS).fill(0),
      lastReportDay: lastDay.get(p._id) ?? null,
      today,
    });
    const chat = [...(spacesOf.get(p._id) ?? [])].map((s) => healthOfSpace.get(s)).filter((h): h is ChatHealth => !!h);
    const health = combineHealth(chat, numbers);
    if (health.red || health.watch) out.set(p._id, health);
  }
  return out;
}
