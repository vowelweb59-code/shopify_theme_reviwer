// Money taken (from the owner's sales sheet) against what the reported hours were worth ("should have taken"), per month and client.
// Should have taken = reported hours x the project's hourly rate; a fixed project with no rate is priced at the standard $15/h; hours of
// a project with no rate are counted but not priced. Only clients the sheet has are compared, so the app's other clients do not show as
// "should have taken, nothing taken". Pure.
import { matchClient } from "./match";
import { STANDARD_RATE_CENTS } from "../hours/fixed-budget";

export interface TakenRow { month: string; clientName: string; amountCents: number }
/** Where a client's projects stand: active (any project running), else on hold, else closed. Null when it has no project. */
export type ClientStatus = "active" | "on_hold" | "closed";
export interface AppClient { id: string; name: string; aliases: readonly string[]; status?: ClientStatus | null }
/** Reported minutes of one project in one month, with the project's client, type and current rate. */
export interface HoursRow { clientId: string; month: string; minutes: number; type: "HOURLY" | "FIXED" | null; rateCents: number | null }

export interface MonthLine { month: string; takenCents: number; shouldCents: number; hours: number; unpricedHours: number; sheetOnlyCents: number }
export interface ClientLine { clientId: string; name: string; status: ClientStatus | null; takenCents: number; shouldCents: number; hours: number; unpricedHours: number }
export interface Comparison { months: MonthLine[]; clients: ClientLine[]; sheetOnly: Array<{ name: string; cents: number }>; fuzzy: Array<{ sheet: string; client: string }> }

export function priceMinutes(minutes: number, type: HoursRow["type"], rateCents: number | null): number | null {
  const rate = rateCents ?? (type === "FIXED" ? STANDARD_RATE_CENTS : null);
  return rate === null ? null : (minutes / 60) * rate;
}

/** `only` limits the comparison to those client ids (sheet clients with no project here are then left out). */
export function compare(taken: readonly TakenRow[], clients: readonly AppClient[], hours: readonly HoursRow[], from: string, to: string, only?: ReadonlySet<string>): Comparison {
  const names = clients.map((c) => ({ id: c.id, names: [c.name, ...c.aliases] }));
  const nameOf = new Map(clients.map((c) => [c.id, c.name]));
  const statusOf = new Map(clients.map((c) => [c.id, c.status ?? null]));
  const cache = new Map<string, ReturnType<typeof matchClient>>();
  const matchOf = (n: string) => { let m = cache.get(n); if (!m) { m = matchClient(n, names); cache.set(n, m); } return m; };

  const monthMap = new Map<string, MonthLine>();
  const monthLine = (month: string) => { let l = monthMap.get(month); if (!l) { l = { month, takenCents: 0, shouldCents: 0, hours: 0, unpricedHours: 0, sheetOnlyCents: 0 }; monthMap.set(month, l); } return l; };
  const clientMap = new Map<string, ClientLine>();
  const clientLine = (id: string) => { let l = clientMap.get(id); if (!l) { l = { clientId: id, name: nameOf.get(id) ?? id, status: statusOf.get(id) ?? null, takenCents: 0, shouldCents: 0, hours: 0, unpricedHours: 0 }; clientMap.set(id, l); } return l; };
  const sheetOnly = new Map<string, number>();
  const tracked = new Set<string>();
  const fuzzy = new Map<string, string>();

  for (const t of taken) {
    if (t.month < from || t.month > to) continue;
    const m = matchOf(t.clientName);
    if (only && (m.clientId === null || !only.has(m.clientId))) continue;
    if (m.clientId === null) {
      monthLine(t.month).sheetOnlyCents += t.amountCents;
      sheetOnly.set(t.clientName, (sheetOnly.get(t.clientName) ?? 0) + t.amountCents);
      continue;
    }
    tracked.add(m.clientId);
    if (m.how === "fuzzy") fuzzy.set(t.clientName, nameOf.get(m.clientId) ?? m.clientId);
    monthLine(t.month).takenCents += t.amountCents;
    clientLine(m.clientId).takenCents += t.amountCents;
  }
  for (const h of hours) {
    if (!tracked.has(h.clientId) || (only && !only.has(h.clientId)) || h.month < from || h.month > to || h.minutes <= 0) continue;
    const cents = priceMinutes(h.minutes, h.type, h.rateCents);
    const ml = monthLine(h.month); const cl = clientLine(h.clientId);
    ml.hours += h.minutes / 60; cl.hours += h.minutes / 60;
    if (cents === null) { ml.unpricedHours += h.minutes / 60; cl.unpricedHours += h.minutes / 60; }
    else { ml.shouldCents += cents; cl.shouldCents += cents; }
  }
  return {
    months: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    clients: [...clientMap.values()].sort((a, b) => (a.takenCents - a.shouldCents) - (b.takenCents - b.shouldCents)),
    sheetOnly: [...sheetOnly].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents),
    fuzzy: [...fuzzy].map(([sheet, client]) => ({ sheet, client })).sort((a, b) => a.sheet.localeCompare(b.sheet)),
  };
}
