// Who reported on which day, against who was on leave: the rules behind the Attendance page. Pure: plain days in, plain cells out.
//
// Owner rules (2026-11-10):
//  - Monday to Friday are working days; Sunday is off; Saturday is flexible (some take it as they wish), so a Saturday is shown
//    when someone reported but never flagged.
//  - The attendance space only announces leaves, so everyone is expected to report every working day unless a leave is announced.
//  - A day is flagged when nothing is announced and the person has no report in their own place: Upwork (TIMER STATUS), the
//    theme team (Theme Status Group), or both. A half-day leave still expects a report.
//  - The reverse is flagged too: a full-day leave on a day the person reported hours.
// A person is expected from their first report until INACTIVE_AFTER_DAYS after their last, so a leaver stops being flagged and
// nobody has to keep a list by hand.

export type Source = "upwork" | "theme";
export type Leave = { half: boolean; reason: string | null };
export type PersonInput = {
  key: string;
  name: string;
  /** Days ("YYYY-MM-DD", IST) the person reported in each place. */
  reports: Record<Source, Set<string>>;
};
export type DayStatus = "reported" | "leave" | "half-leave" | "leave-but-reported" | "missing" | "saturday" | "sunday" | "pending" | "inactive";
export type Cell = { day: string; status: DayStatus; reportedIn: Source[]; leave: Leave | null };
export type Flag = { key: string; name: string; day: string; kind: "missing" | "leave-but-reported"; expectedIn: Source[]; reportedIn: Source[]; leave: Leave | null };
export type PersonRow = { key: string; name: string; sources: Source[]; cells: Cell[]; counts: { reported: number; leave: number; missing: number; conflicts: number } };

export const INACTIVE_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;
const SOURCES: Source[] = ["upwork", "theme"];

/** 0 = Sunday … 6 = Saturday, of a calendar day. */
export function dayOfWeek(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

export function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Every calendar day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function buildGrid({ days, today, people, leaves }: { days: string[]; today: string; people: PersonInput[]; leaves: Map<string, Map<string, Leave>> }): { rows: PersonRow[]; flags: Flag[] } {
  const rows: PersonRow[] = [];
  const flags: Flag[] = [];
  for (const person of people) {
    const sources = SOURCES.filter((s) => person.reports[s].size > 0);
    const all = sources.flatMap((s) => [...person.reports[s]]).sort();
    if (all.length === 0) continue; // never reported anywhere: not part of the team being checked
    const first = all[0];
    const activeUntil = addDays(all[all.length - 1], INACTIVE_AFTER_DAYS);
    const myLeaves = leaves.get(person.key);
    const counts = { reported: 0, leave: 0, missing: 0, conflicts: 0 };
    const cells: Cell[] = days.map((day) => {
      const reportedIn = sources.filter((s) => person.reports[s].has(day));
      const leave = myLeaves?.get(day) ?? null;
      const cell = (status: DayStatus): Cell => ({ day, status, reportedIn, leave });
      const dow = dayOfWeek(day);
      if (dow === 0) return cell("sunday");
      if (dow === 6) return cell("saturday");
      if (day < first || day > activeUntil) return cell("inactive");
      if (day >= today) return cell("pending");
      if (leave && !leave.half) {
        if (reportedIn.length > 0) {
          counts.conflicts++;
          flags.push({ key: person.key, name: person.name, day, kind: "leave-but-reported", expectedIn: sources, reportedIn, leave });
          return cell("leave-but-reported");
        }
        counts.leave++;
        return cell("leave");
      }
      if (reportedIn.length > 0) {
        counts.reported++;
        return cell(leave ? "half-leave" : "reported");
      }
      counts.missing++;
      flags.push({ key: person.key, name: person.name, day, kind: "missing", expectedIn: sources, reportedIn, leave });
      return cell("missing");
    });
    rows.push({ key: person.key, name: person.name, sources, cells, counts });
  }
  rows.sort((a, b) => b.counts.missing + b.counts.conflicts - (a.counts.missing + a.counts.conflicts) || a.name.localeCompare(b.name));
  flags.sort((a, b) => a.day.localeCompare(b.day) || a.name.localeCompare(b.name));
  return { rows, flags };
}

/** The person (by normalized key) a leave's name refers to: an exact match, else the one person whose name contains it or is contained by it. */
export function matchPersonKey(leaveName: string, people: { key: string; names: string[] }[], normalize: (s: string) => string): string | null {
  const n = normalize(leaveName);
  if (!n) return null;
  const exact = people.filter((p) => p.names.some((x) => normalize(x) === n));
  if (exact.length === 1) return exact[0].key;
  if (exact.length > 1) return null;
  const tokens = new Set(n.split(" "));
  const loose = people.filter((p) =>
    p.names.some((x) => {
      const t = normalize(x).split(" ");
      const small = t.length <= tokens.size ? t : [...tokens];
      const big = t.length <= tokens.size ? tokens : new Set(t);
      return small.length >= 2 && small.every((w) => big.has(w));
    })
  );
  return loose.length === 1 ? loose[0].key : null;
}
