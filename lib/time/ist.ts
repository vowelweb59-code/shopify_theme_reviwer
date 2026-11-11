// India Standard Time (UTC+05:30, no daylight saving) helpers shared by the theme and service sides, so a message posted
// between 00:00 and 05:30 IST lands on the same calendar day everywhere. Pure, no server-only imports.

const IST_OFFSET_MS = 330 * 60_000;

/** IST month "YYYY-MM" as [from, to) in UTC. */
export function istMonthWindow(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const at = (yy: number, mm: number) => new Date(`${yy}-${String(mm).padStart(2, "0")}-01T00:00:00+05:30`);
  return { from: at(y, m), to: at(ny, nm) };
}

/** The IST month "YYYY-MM" that contains `now`, moved back by `back` months. */
export function istMonth(now: Date, back = 0): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - back, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The IST calendar day "YYYY-MM-DD" of `now`. */
export function istDay(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
