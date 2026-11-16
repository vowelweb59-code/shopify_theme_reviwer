// Posts in the Chat space "New Project Update" (spaces/AAAAVIeFrm4). Two shapes seen so far (owner, 2026-11-16):
//   "Accepted the project of Sumer Kashyap - Ashfaque - $20 hr - Ashfaque | Mohit | 5th November"
//   "Contract ended of Danisa with 3-star ratings on Rahul"
// Owner, 2026-11-16: client - Upwork profile - hourly rate - BD | BA | (start date). Anything that does not read cleanly returns null and goes to a list for a person to check.
export type NewProjectPost =
  | { kind: "accepted"; client: string; hourlyRateCents: number | null; profile: string | null; businessDeveloper: string | null; businessAnalyst: string | null; startDate: Date | null }
  | { kind: "ended"; client: string; rating: number | null; profile: string | null };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "5th November" -> that day (UTC midnight) in the year of `posted`; a date after the posting day belongs to the year before. */
export function parseDayMonth(text: string, posted: Date): Date | null {
  const m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:\s+(\d{4}))?$/i.exec(text.trim());
  if (!m) return null;
  const month = MONTHS.findIndex((n) => n.startsWith(m[2].toLowerCase()) && m[2].length >= 3);
  if (month < 0) return null;
  let d = new Date(Date.UTC(m[3] ? +m[3] : posted.getUTCFullYear(), month, +m[1]));
  if (!m[3] && d.getTime() > posted.getTime() + 86_400_000 * 2) d = new Date(Date.UTC(d.getUTCFullYear() - 1, month, +m[1]));
  return d.getUTCDate() === +m[1] ? d : null;
}

export function parseNewProjectPost(text: string, posted: Date): NewProjectPost | null {
  const t = text.replace(/\s+/g, " ").trim();
  const acc = /^accepted the project of\s+(.+)$/i.exec(t);
  if (acc) {
    const parts = acc[1].split(/\s+-\s+/).map((s) => s.trim());
    const client = parts[0];
    if (!client) return null;
    const rateIdx = parts.findIndex((p, i) => i > 0 && /^\$\s*\d/.test(p));
    const rate = rateIdx > 0 ? /\$\s*(\d+(?:\.\d+)?)/.exec(parts[rateIdx]) : null;
    const profile = rateIdx > 1 ? parts[1] : null;
    const tail = (rateIdx > 0 ? parts.slice(rateIdx + 1).join(" - ") : parts.slice(1).join(" - ")).split("|").map((s) => s.trim()).filter(Boolean);
    const last = tail[tail.length - 1];
    const startDate = last ? parseDayMonth(last, posted) : null;
    const people = startDate ? tail.slice(0, -1) : tail;
    const [businessDeveloper = null, businessAnalyst = null] = people;
    return { kind: "accepted", client, hourlyRateCents: rate ? Math.round(parseFloat(rate[1]) * 100) : null, profile, businessDeveloper, businessAnalyst, startDate };
  }
  const end = /^contract ended (?:of|for)\s+(.+?)(?:\s+with\s+(\d(?:\.\d)?)[\s-]*stars?(?:\s+(?:ratings?|reviews?))?)?(?:\s+(?:on|by)\s+(.+))?$/i.exec(t);
  if (end) return { kind: "ended", client: end[1].trim(), rating: end[2] ? parseFloat(end[2]) : null, profile: end[3]?.trim() || null };
  return null;
}
