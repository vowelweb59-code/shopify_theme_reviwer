import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import type { AppClient, ClientStatus, HoursRow, TakenRow } from "./compare";
import { normName } from "./match";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceRevenueTaken } from "@/models/service-revenue";
import { ServiceTimeEntry } from "@/models/service-time-entry";

/** What the Revenue tab compares: the imported sheet rows, the app's clients and the reported minutes per project and month. */
export async function loadRevenueInput(): Promise<{ taken: TakenRow[]; clients: AppClient[]; hours: HoursRow[] }> {
  const [takenDocs, clientDocs, projects, att] = await Promise.all([
    ServiceRevenueTaken.find().select("month clientName amountCents").lean<Array<{ month: string; clientName: string; amountCents: number }>>(),
    ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>(),
    ServiceProject.find({ clientId: { $ne: null } }).select("clientId status contract").lean<Array<{ _id: string; clientId: string; status: string; contract: { type: "HOURLY" | "FIXED"; hourlyRateCents: number | null } | null }>>(),
    loadAttribution(),
  ]);
  const entries = await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } })
    .select("projectId clientId minutes allocations entryDate")
    .lean<Array<{ projectId: string | null; clientId: string | null; minutes: number; allocations: Array<{ projectId: string; minutes: number }>; entryDate: Date }>>();
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
  const idOf = (c: { _id: string; name: string }) => { const k = normName(c.name); if (!canonical.has(k)) canonical.set(k, c._id); return canonical.get(k)!; };
  const canonicalOf = new Map(clientDocs.map((c) => [c._id, idOf(c)]));
  const hours: HoursRow[] = [...sums].map(([k, minutes]) => {
    const [pid, month] = k.split("|");
    const p = byProject.get(pid)!;
    return { clientId: canonicalOf.get(p.clientId) ?? p.clientId, month, minutes, type: p.contract?.type ?? null, rateCents: p.contract?.hourlyRateCents ?? null };
  });
  // A client's status: active if any of its projects is running, else on hold, else closed.
  const rank: Record<ClientStatus, number> = { active: 0, on_hold: 1, closed: 2 };
  const statusOfProject = (st: string): ClientStatus => (st === "ON_HOLD" ? "on_hold" : ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(st) ? "closed" : "active");
  const clientStatus = new Map<string, ClientStatus>();
  for (const p of projects) {
    const id = canonicalOf.get(p.clientId) ?? p.clientId;
    const st = statusOfProject(p.status);
    const have = clientStatus.get(id);
    if (!have || rank[st] < rank[have]) clientStatus.set(id, st);
  }
  const clients: AppClient[] = [];
  for (const c of clientDocs) {
    const id = canonicalOf.get(c._id)!;
    const have = clients.find((x) => x.id === id);
    if (have) have.aliases = [...have.aliases, ...c.aliases];
    else clients.push({ id, name: c.name, aliases: [...c.aliases], status: clientStatus.get(id) ?? null });
  }
  return { taken: takenDocs.map((t) => ({ month: t.month, clientName: t.clientName, amountCents: t.amountCents })), clients, hours };
}
