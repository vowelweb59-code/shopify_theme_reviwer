// Which project an entry counts toward: the one a person (or the auto-assign rules) chose, else its client's only project
// with a live contract, else none. Contracts are one per project, so "contract" and "project" are the same thing here.
import { ServiceProject } from "@/models/service-project";

export type AttributionProject = { _id: string; name: string; clientId: string | null; status: string; inHouse: boolean; contract: { weeklyLimitMinutes: number | null; type: string; status: string } | null };

export async function loadAttribution() {
  const projects = await ServiceProject.find({ contract: { $ne: null }, "contract.status": { $ne: "ENDED" } })
    .select("name clientId status inHouse contract")
    .lean<AttributionProject[]>();
  const byClient = new Map<string, AttributionProject[]>();
  for (const p of projects) if (p.clientId) byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), p]);
  return {
    projects,
    /** client -> its only live project */
    owner: new Map([...byClient].filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]!._id])),
    /** clients with several live projects: their entries need a rule or a person to place them */
    shared: new Set([...byClient].filter(([, v]) => v.length > 1).map(([k]) => k)),
  };
}

export function projectOf(e: { projectId: string | null; clientId: string | null }, owner: Map<string, string>): string | null {
  return e.projectId ?? (e.clientId ? owner.get(e.clientId) ?? null : null);
}

/**
 * An entry shared across several projects counts once per share: one copy per project, with that share of the minutes.
 * Every figure that adds up hours per project goes through this, so a shared entry is never counted twice or dropped.
 */
export function expandAllocations<T extends { projectId: string | null; minutes: number; allocations?: ReadonlyArray<{ projectId: string; minutes: number }> }>(entries: readonly T[]): T[] {
  return entries.flatMap((e) => (e.allocations && e.allocations.length > 0 ? e.allocations.map((a) => ({ ...e, projectId: a.projectId, minutes: a.minutes })) : [e]));
}

/** Splits minutes into `parts` whole-minute shares that add up exactly (the remainder goes to the first shares). */
export function splitMinutes(minutes: number, parts: number): number[] {
  const base = Math.floor(minutes / parts);
  const extra = minutes - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}
