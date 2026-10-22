import type { ProjectStatus, RejectionStage } from "./constants";

// A theme is one project that can be submitted several times. The project's
// own status / members / days describe the *current* round; every earlier
// round is kept in `rounds`, so a rejection stays on record (and on the people
// who worked that round) after the theme is resubmitted and goes Live.
export type RoundMember = { memberId: string; role: string | null };
export type Round = {
  status: ProjectStatus;
  /** Where a rejected round was turned down; null when not recorded. */
  rejectionStage: RejectionStage | null;
  designDays: number | null;
  developmentDays: number | null;
  members: RoundMember[];
  /** Why it was rejected, or anything else worth remembering about this round. */
  note: string;
};

type RoundOf = { status: string; rejectionStage?: string | null; members: { memberId: unknown }[] };
type RoundsOf = { _id?: unknown; name?: string; status: string | null; rejectionStage?: string | null; members: { memberId: unknown }[]; rounds?: RoundOf[] };

/** A round rejected at the design stage is not the developers' doing, so it is left out of their success rate. */
export function isExcludedFromRound(round: { status: string; rejectionStage?: string | null }, designation: string | undefined): boolean {
  return round.status === "rejected" && round.rejectionStage === "design" && /developer/i.test(designation ?? "");
}

/** One decided round a member was on: which project, and which of its rounds when it has several. */
export type OutcomeEntry = { projectId: string; name: string; round: number | null };
export type Outcomes = { approved: number; rejected: number; approvedIn: OutcomeEntry[]; rejectedIn: OutcomeEntry[] };

/** Per member, the rounds that were decided: Live (approved) and Rejected. Rounds still in progress count for neither. */
export function countOutcomes(projects: RoundsOf[], designationById: Map<string, string> = new Map()): Map<string, Outcomes> {
  const out = new Map<string, Outcomes>();
  for (const project of projects) {
    const earlier = project.rounds ?? [];
    const all: RoundOf[] = [...earlier, { status: project.status ?? "", rejectionStage: project.rejectionStage, members: project.members }];
    all.forEach((round, i) => {
      if (round.status !== "live" && round.status !== "rejected") return;
      const entry: OutcomeEntry = { projectId: String(project._id ?? ""), name: project.name ?? "", round: earlier.length > 0 ? i + 1 : null };
      for (const m of round.members) {
        if (isExcludedFromRound(round, designationById.get(String(m.memberId)))) continue;
        const tally = out.get(String(m.memberId)) ?? { approved: 0, rejected: 0, approvedIn: [], rejectedIn: [] };
        if (round.status === "live") {
          tally.approved++;
          tally.approvedIn.push(entry);
        } else {
          tally.rejected++;
          tally.rejectedIn.push(entry);
        }
        out.set(String(m.memberId), tally);
      }
    });
  }
  return out;
}

/** Approved share of decided rounds as a whole percent; null until a member has any decided round. */
export function successRate(tally: { approved: number; rejected: number } | undefined): number | null {
  const decided = (tally?.approved ?? 0) + (tally?.rejected ?? 0);
  return decided === 0 ? null : Math.round(((tally?.approved ?? 0) / decided) * 100);
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

export type MergeInput = {
  id: string;
  themeId: string;
  portal: string | null;
  type: string;
  name: string;
  status: ProjectStatus | null;
  designDays: number | null;
  developmentDays: number | null;
  description: string;
  members: RoundMember[];
  createdAt: number;
};
export type MergeGroup = {
  /** The project that survives: the latest version. */
  keepId: string;
  name: string;
  rounds: Round[];
  /** The earlier versions, folded into `rounds` and then deleted. */
  removeIds: string[];
};

const VERSION_RE = /^(.*?)(?:\s+(?:version|vesion|v))?\s+(\d+)$/i;
const lower = (s: string) => s.trim().toLowerCase();

/** "Voltix 2" / "Voltix Version 2" -> { base: "Voltix", version: 2 }; a name without a number has version null. */
export function splitVersionName(name: string): { base: string; version: number | null } {
  const m = VERSION_RE.exec(name.trim());
  return m && m[1].trim() ? { base: m[1].trim(), version: Number(m[2]) } : { base: name.trim(), version: null };
}

/**
 * Groups one-project-per-version rows into one project per theme + portal +
 * type + base name ("Voltix 1", "Voltix 2" -> "Voltix"). Theme Update projects are never merged (they track hours, not rounds).
 * Pure; scripts/merge-project-rounds.ts applies it.
 */
export function planMerge(projects: MergeInput[]): MergeGroup[] {
  const groups = new Map<string, MergeInput[]>();
  for (const p of projects) {
    if (p.type === "theme_update") continue;
    // The base name too: one Theme record can hold differently named products (Adorn, Flaunt), which are not rounds of each other.
    const key = [p.themeId, p.portal ?? "", p.type, lower(splitVersionName(p.name).base)].join("|");
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const out: MergeGroup[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const parsed = members.map((p) => ({ p, ...splitVersionName(p.name) }));
    // Version numbers decide the order when every row has one; creation time breaks ties and covers the rest.
    const numbered = parsed.every((x) => x.version !== null);
    parsed.sort((a, b) => (numbered ? (a.version as number) - (b.version as number) : 0) || a.p.createdAt - b.p.createdAt);

    const latest = parsed[parsed.length - 1];
    out.push({
      keepId: latest.p.id,
      name: latest.base,
      rounds: parsed.slice(0, -1).map(({ p }) => ({
        status: p.status ?? "rejected",
        rejectionStage: null,
        designDays: p.designDays,
        developmentDays: p.developmentDays,
        members: p.members,
        note: p.description,
      })),
      removeIds: parsed.slice(0, -1).map((x) => x.p.id),
    });
  }
  return out;
}
