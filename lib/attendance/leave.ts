// Reads the attendance space's leave announcements. The space holds only leaves, in a fixed shape such as
//   "@Huzefa kapadia Kunal Mendhe has applied for a leave on 16th Nov 2026.(Diwali Festival - Bhaiduj)"
// where the @mention is the team lead and the name after it is the person taking the leave. Pure: text in, plain data out.
// A message that is not a leave (or is one with no readable date) is returned as such, so the page can list it for review
// rather than the day silently going unaccounted for.

export type Mention = { start: number; length: number; displayName: string | null };

export type LeaveMessage =
  | { kind: "leave"; person: string; lead: string | null; dates: string[]; half: boolean; reason: string | null }
  | { kind: "cancel"; person: string; lead: string | null; dates: string[] }
  | { kind: "unparsed"; why: string }
  | { kind: "other" };

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MAX_RANGE_DAYS = 62;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const valid = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Lower case, single spaces, no punctuation: the form names are compared in. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

type Token = { day: number; month: number | null; year: number | null; start: number; end: number; suffix: boolean };

/** Every date the text names. "16th & 17th Nov 2026" gives two; "16 Nov to 18 Nov" is a range; a missing year is the post's. */
export function parseDates(text: string, postedAt: Date): string[] {
  const tokens: Token[] = [];
  const re = /\b(\d{1,2})(st|nd|rd|th)?\b(?:\s+(?:of\s+)?([A-Za-z]{3,9})\b\.?(?:,?\s*(\d{4})\b)?)?/g;
  for (const m of text.matchAll(re)) {
    const month = m[3] ? (MONTHS[m[3].slice(0, 3).toLowerCase()] ?? null) : null;
    tokens.push({ day: Number(m[1]), month, year: month && m[4] ? Number(m[4]) : null, start: m.index, end: m.index + m[0].length, suffix: Boolean(m[2]) });
  }
  // Numeric dates, day first: 16/11/2026, 16-11-26.
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    tokens.push({ day: Number(m[1]), month: Number(m[2]), year: y, start: m.index, end: m.index + m[0].length, suffix: true });
  }
  tokens.sort((a, b) => a.start - b.start);
  // Drop tokens swallowed by a numeric date, and day-only numbers that are not dates ("for 2 days").
  const kept = tokens.filter((t, i) => !tokens.some((o, j) => j !== i && o.start <= t.start && o.end >= t.end && (o.end - o.start > t.end - t.start)));
  // A day without a month takes the next dated token's month and year ("16th & 17th Nov 2026").
  const filled: Token[] = [];
  for (let i = 0; i < kept.length; i++) {
    const t = { ...kept[i] };
    if (t.month === null) {
      const next = kept.slice(i + 1).find((o) => o.month !== null);
      if (!next || !t.suffix) continue;
      t.month = next.month;
      t.year = next.year;
    }
    filled.push(t);
  }
  const posted = new Date(postedAt.getTime() + 330 * 60_000);
  const yearOf = (t: Token) => {
    if (t.year) return t.year;
    const y = posted.getUTCFullYear();
    // "on 2nd Jan" posted in December means next January.
    return valid(y, t.month!, t.day) && new Date(iso(y, t.month!, t.day)).getTime() < posted.getTime() - 300 * 86_400_000 ? y + 1 : y;
  };
  const days: string[] = [];
  const add = (y: number, m: number, d: number) => {
    if (valid(y, m, d)) days.push(iso(y, m, d));
  };
  for (let i = 0; i < filled.length; i++) {
    const t = filled[i];
    const y = yearOf(t);
    const next = filled[i + 1];
    const between = next ? text.slice(t.end, next.start) : "";
    if (next && /^\s*(?:to|till|until|through|thru|[-–—])\s*$/i.test(between) && valid(y, t.month!, t.day)) {
      const from = Date.UTC(y, t.month! - 1, t.day);
      const ny = yearOf(next);
      if (valid(ny, next.month!, next.day)) {
        const to = Date.UTC(ny, next.month! - 1, next.day);
        if (to >= from && (to - from) / 86_400_000 < MAX_RANGE_DAYS) {
          for (let ms = from; ms <= to; ms += 86_400_000) {
            const d = new Date(ms);
            add(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
          }
          i++;
          continue;
        }
      }
    }
    add(y, t.month!, t.day);
  }
  return [...new Set(days)].sort();
}

const HALF = /half[\s-]*day|first\s+half|second\s+half|1st\s+half|2nd\s+half|\bhalf\s+leave/i;

/**
 * Splits "@Lead Person" into its two names. The mention annotations (position of the @Lead part) are exact; without them the
 * longest known name the text ends with is the person, else the last two words.
 */
function splitNames(head: string, mentions: Mention[], knownNames: string[]): { person: string; lead: string | null } {
  const inHead = mentions.filter((m) => m.start >= 0 && m.start + m.length <= head.length).sort((a, b) => a.start - b.start);
  if (inHead.length > 0) {
    let rest = head;
    for (const m of [...inHead].reverse()) rest = rest.slice(0, m.start) + " " + rest.slice(m.start + m.length);
    const person = rest.replace(/\s+/g, " ").replace(/^[\s@,:-]+|[\s,:-]+$/g, "");
    const lead = (inHead[0].displayName ?? head.slice(inHead[0].start, inHead[0].start + inHead[0].length)).replace(/^@/, "").trim();
    if (person) return { person, lead: lead || null };
  }
  const words = head.replace(/@/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const norm = normalizeName(words.join(" "));
  let best: string | null = null;
  for (const k of knownNames) {
    const nk = normalizeName(k);
    if (nk && (norm === nk || norm.endsWith(` ${nk}`)) && (!best || nk.length > best.length)) best = nk;
  }
  if (best) {
    const n = best.split(" ").length;
    return { person: words.slice(-n).join(" "), lead: words.slice(0, -n).join(" ") || null };
  }
  if (words.length > 2) return { person: words.slice(-2).join(" "), lead: words.slice(0, -2).join(" ") };
  return { person: words.join(" "), lead: null };
}

const APPLIED = /^([\s\S]*?)\s+has\s+applied\s+(?:for\s+)?(?:an?\s+)?([\w\s-]*?)leave\b([\s\S]*)$/i;
const CANCELLED = /^([\s\S]*?)\s+has\s+(?:cancell?ed|withdrawn|withdrew|revoked)\s+(?:the\s+|his\s+|her\s+|their\s+|an?\s+)?([\w\s-]*?)leave\b([\s\S]*)$/i;

export function parseLeaveMessage(text: string, mentions: Mention[], postedAt: Date, knownNames: string[] = []): LeaveMessage {
  const m = APPLIED.exec(text) ?? CANCELLED.exec(text);
  if (!m) return { kind: "other" };
  const cancel = !APPLIED.test(text);
  const names = splitNames(m[1], mentions, knownNames);
  if (!names.person) return { kind: "unparsed", why: "No name before “has applied”." };
  const reason = /\(([^()]*)\)\s*\.?\s*$/.exec(m[3])?.[1]?.trim() || /\(([^()]*)\)/.exec(m[3])?.[1]?.trim() || null;
  const dateText = m[3].replace(/\([^()]*\)/g, " ");
  const dates = parseDates(dateText, postedAt);
  if (dates.length === 0) return { kind: "unparsed", why: "No date found." };
  if (cancel) return { kind: "cancel", person: names.person, lead: names.lead, dates };
  return { kind: "leave", person: names.person, lead: names.lead, dates, half: HALF.test(`${m[2]} ${m[3]}`), reason };
}
