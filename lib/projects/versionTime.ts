import { HOURS_PER_DAY } from "@/lib/chat/durations";
import type { StoreVersion } from "@/lib/themes/versionHistory";

export type TimeEntryDay = { date: string; hours: number; memberId: string; name: string };

export type VersionTimeRow = {
  /** The Theme Store version, or "Next release" for the work since the latest one. */
  version: string;
  /** YYYY-MM-DD the Theme Store shows for the release; null on the "Next release" row. */
  releasedOn: string | null;
  /** The previous dated release the window starts after (null for the first release listed). */
  since: string | null;
  /** Days between the previous release and this one (to today on the "Next release" row); null for the first release listed. */
  calendarDays: number | null;
  /** Distinct days on which a developer logged time in the window. */
  daysWorked: number;
  hours: number;
  /** Hours as working days at 8.5 h/day. */
  effortDays: number;
  people: { name: string; hours: number; days: number }[];
  inProgress: boolean;
};

export type VersionTimeResult = { rows: VersionTimeRow[]; /** Versions the Theme Store lists without a date; they can't mark a window, so their work sits in the next dated release. */ undated: string[] };

const round2 = (n: number) => Math.round(n * 100) / 100;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

/**
 * Time spent per Theme Store version of one theme: the window of a release is the days after the previous dated release up to and
 * including its own release day, and every hours-log entry of the Update project whose day falls in it counts for that release
 * (the first release listed takes everything logged up to its day). Work after the latest release is the "Next release" row, up
 * to `today`. Newest first.
 */
export function versionTimeRows(versions: StoreVersion[], entries: TimeEntryDay[], today: string): VersionTimeResult {
  const dated = versions.filter((v): v is { version: string; releasedOn: string } => v.releasedOn !== null).sort((a, b) => a.releasedOn.localeCompare(b.releasedOn));
  const undated = versions.filter((v) => v.releasedOn === null).map((v) => v.version);

  const summarize = (version: string, releasedOn: string | null, since: string | null, calendarDays: number | null, inProgress: boolean, inWindow: TimeEntryDay[]): VersionTimeRow => {
    const days = new Set(inWindow.map((e) => e.date));
    const byPerson = new Map<string, { name: string; hours: number; days: Set<string> }>();
    for (const e of inWindow) {
      const p = byPerson.get(e.memberId) ?? { name: e.name, hours: 0, days: new Set<string>() };
      p.hours += e.hours;
      p.days.add(e.date);
      byPerson.set(e.memberId, p);
    }
    const hours = inWindow.reduce((s, e) => s + e.hours, 0);
    return {
      version,
      releasedOn,
      since,
      calendarDays,
      daysWorked: days.size,
      hours: round2(hours),
      effortDays: round2(hours / HOURS_PER_DAY),
      people: [...byPerson.values()].map((p) => ({ name: p.name, hours: round2(p.hours), days: p.days.size })).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name)),
      inProgress,
    };
  };

  const rows: VersionTimeRow[] = dated.map((v, i) => {
    const since = i > 0 ? dated[i - 1].releasedOn : null;
    const inWindow = entries.filter((e) => e.date <= v.releasedOn && (since === null || e.date > since));
    return summarize(v.version, v.releasedOn, since, since === null ? null : daysBetween(since, v.releasedOn), false, inWindow);
  });

  const latest = dated.length > 0 ? dated[dated.length - 1].releasedOn : null;
  if (latest !== null) {
    rows.push(summarize("Next release", null, latest, Math.max(0, daysBetween(latest, today)), true, entries.filter((e) => e.date > latest)));
  }
  return { rows: rows.reverse(), undated };
}
