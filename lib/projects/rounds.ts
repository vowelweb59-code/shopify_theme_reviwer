import type { ProjectStatus, RejectionStage, RejectionType } from "./constants";

// A theme is one project that can be submitted several times. The project's
// own status / members / days describe the *current* round; every earlier
// round is kept in `rounds`, so a rejection stays on record (and on the people
// who worked that round) after the theme is resubmitted and goes Live.
export type RoundMember = { memberId: string; role: string | null };
export type Round = {
  status: ProjectStatus;
  /** Where a rejected round was turned down; null when not recorded. */
  rejectionStage: RejectionStage | null;
  /** Who rejected it (our own review or Shopify); null when not recorded. */
  rejectionType: RejectionType | null;
  designDays: number | null;
  developmentDays: number | null;
  members: RoundMember[];
  /** Why it was rejected, or anything else worth remembering about this round. */
  note: string;
};

type RoundMemberOf = { memberId: unknown; role?: string | null };
type RoundOf = { status: string; rejectionStage?: string | null; rejectionType?: string | null; members: RoundMemberOf[] };
type RoundsOf = { _id?: unknown; themeId?: unknown; name?: string; status: string | null; rejectionStage?: string | null; rejectionType?: string | null; members: RoundMemberOf[]; rounds?: RoundOf[] };

/** How much of a rejection counts against a member's success rate: an internal rejection counts half for a Team Lead (their role on the round, or their designation), everything else in full. */
export const INTERNAL_REJECTION_TEAM_LEAD_WEIGHT = 0.5;
const isTeamLead = (role: string | null | undefined, designation: string | undefined) => /team\s*lead/i.test(role ?? "") || /team\s*lead/i.test(designation ?? "");
export function rejectionWeight(round: { rejectionType?: string | null }, role: string | null | undefined, designation: string | undefined): number {
  return round.rejectionType === "internal" && isTeamLead(role, designation) ? INTERNAL_REJECTION_TEAM_LEAD_WEIGHT : 1;
}

/** A round rejected at the design stage is not the developers' doing, so it is left out of their success rate. */
export function isExcludedFromRound(round: { status: string; rejectionStage?: string | null }, designation: string | undefined): boolean {
  return round.status === "rejected" && round.rejectionStage === "design" && /developer/i.test(designation ?? "");
}

/** One decided round a member was on: which project, and which of its rounds when it has several. */
export type OutcomeEntry = { projectId: string; name: string; round: number | null; /** Rejected rounds only: who rejected it. */ rejectionType?: RejectionType | null; /** Rejected rounds only: how much of it counted (0.5 for a Team Lead's internal rejection). */ weight?: number };
/** `rejected` is the number of rejected rounds; `rejectedWeight` is what they count for in the success rate (see rejectionWeight). */
export type Outcomes = { approved: number; rejected: number; rejectedWeight: number; approvedIn: OutcomeEntry[]; rejectedIn: OutcomeEntry[] };

/**
 * Who reported time on which theme (from the Google Chat reports). Once a theme has any reports, its current round only counts
 * for the people who worked on it; its earlier rounds, and a theme with no reports yet, count everyone listed on them.
 */
export type WorkedOn = { themesWithReports: Set<string>; byTheme: Map<string, Set<string>> };

/** Product Managers' time is not tracked, so they always count by being on a round. */
function skippedForNotWorking(themeId: unknown, memberId: string, designation: string | undefined, worked: WorkedOn | undefined): boolean {
  if (!worked || !worked.themesWithReports.has(String(themeId)) || /manager/i.test(designation ?? "")) return false;
  return !worked.byTheme.get(String(themeId))?.has(memberId);
}

/** Per member, the rounds that were decided: Live (approved) and Rejected. Rounds still in progress count for neither. */
export function countOutcomes(projects: RoundsOf[], designationById: Map<string, string> = new Map(), worked?: WorkedOn): Map<string, Outcomes> {
  const out = new Map<string, Outcomes>();
  for (const project of projects) {
    const earlier = project.rounds ?? [];
    const all: RoundOf[] = [...earlier, { status: project.status ?? "", rejectionStage: project.rejectionStage, rejectionType: project.rejectionType, members: project.members }];
    all.forEach((round, i) => {
      if (round.status !== "live" && round.status !== "rejected") return;
      const baseEntry: OutcomeEntry = { projectId: String(project._id ?? ""), name: project.name ?? "", round: earlier.length > 0 ? i + 1 : null };
      for (const m of round.members) {
        if (isExcludedFromRound(round, designationById.get(String(m.memberId)))) continue;
        // Only the current round is checked against the time reports: they cover recent work, and earlier rounds can predate them.
        if (i === earlier.length && skippedForNotWorking(project.themeId, String(m.memberId), designationById.get(String(m.memberId)), worked)) continue;
        const tally = out.get(String(m.memberId)) ?? { approved: 0, rejected: 0, rejectedWeight: 0, approvedIn: [], rejectedIn: [] };
        if (round.status === "live") {
          tally.approved++;
          tally.approvedIn.push(baseEntry);
        } else {
          const weight = rejectionWeight(round, m.role, designationById.get(String(m.memberId)));
          tally.rejected++;
          tally.rejectedWeight += weight;
          tally.rejectedIn.push({ ...baseEntry, rejectionType: (round.rejectionType as RejectionType | null | undefined) ?? null, weight });
        }
        out.set(String(m.memberId), tally);
      }
    });
  }
  return out;
}

/**
 * Approved share of decided rounds as a whole percent; null until a member has any decided round. A rejection counts for its weight
 * (`rejectedWeight`, e.g. 0.5 for a Team Lead's internal rejection); without it each rejected round counts as 1.
 */
export function successRate(tally: { approved: number; rejected: number; rejectedWeight?: number } | undefined): number | null {
  const approved = tally?.approved ?? 0;
  const rejected = tally?.rejectedWeight ?? tally?.rejected ?? 0;
  const decided = approved + rejected;
  return decided === 0 ? null : Math.round((approved / decided) * 100);
}

/** Rejections per member: a round counts when its status is Rejected, for everyone on that round. */
export function countRejections(projects: { status: string | null; members: { memberId: unknown }[]; rounds?: { status: string; members: { memberId: unknown }[] }[] }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const project of projects) {
    for (const round of [...(project.rounds ?? []), { status: project.status ?? "", members: project.members }]) {
      if (round.status !== "rejected") continue;
      for (const m of round.members) counts.set(String(m.memberId), (counts.get(String(m.memberId)) ?? 0) + 1);
    }
  }
  return counts;
}

/** How many times the project has been rejected, across its earlier rounds and the current one. */
export function rejectionCount(project: { status: string | null; rounds?: { status: string }[] }): number {
  return (project.rounds ?? []).filter((r) => r.status === "rejected").length + (project.status === "rejected" ? 1 : 0);
}
