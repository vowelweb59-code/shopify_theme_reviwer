// Pure text helpers shared by the Chat report parsers (docs/design/data-import.md). No I/O.

/** Lowercase, strip accents and punctuation, collapse spaces: "Patrick O'Donnell" and "patrick  o donnell" match. */
export const normalizeName = (s: string): string =>
  s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// All source reports are in IST (UTC+05:30, no DST). Chat createTime is UTC, so convert before taking a calendar date.
const IST_OFFSET_MS = 330 * 60_000;
export const istDate = (d: Date): string => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export interface Duration {
  minutes?: number;
  flag?: 'INVALID_DURATION';
}

const H = '(?:h|hs|hr|hrs|hour|hours)';
const M = '(?:m|min|mins|minute|minutes)';

/**
 * Durations as people actually write them: "08:30 hrs", "2:10:hr", "00:40 min", "40:min", "8 hours 30 minutes",
 * "5 hrs 10 mins", "7 hours". "2.30" is HH.MM (2h30m, owner-confirmed); a one-digit or 60+ fraction ("7.5", "2.75") is decimal hours.
 */
export function parseDuration(raw: string): Duration {
  const s = raw.trim().toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;
  if ((m = s.match(new RegExp(String.raw`^(\d{1,2})\s*${H}\.?\s*(?:and\s*)?(\d{1,2})\s*${M}\.?$`))))
    return +m[2] < 60 ? { minutes: +m[1] * 60 + +m[2] } : { flag: 'INVALID_DURATION' };
  if ((m = s.match(new RegExp(String.raw`^(\d{1,3})\s*:?\s*${M}\.?$`)))) return { minutes: +m[1] };
  const num = s.replace(new RegExp(String.raw`\s*:?\s*(?:${H}|${M})\.?$`), '').trim();
  if ((m = num.match(/^(\d{1,2}):(\d{2})$/))) return +m[2] < 60 ? { minutes: +m[1] * 60 + +m[2] } : { flag: 'INVALID_DURATION' };
  // The team writes HH.MM ("2.30" = 2h30m, "07.00" = 7h). Minutes of 60 or more cannot be HH.MM, so those are decimal hours.
  if ((m = num.match(/^(\d{1,2})\.(\d{1,2})$/))) {
    if (m[2].length === 2 && +m[2] < 60) return { minutes: +m[1] * 60 + +m[2] };
    return { minutes: Math.round(parseFloat(num) * 60) };
  }
  if ((m = num.match(/^(\d{1,2})$/))) return { minutes: +m[1] * 60 };
  return { flag: 'INVALID_DURATION' };
}

/** DD/MM/YYYY or DD/MM/YY (also - or .) to an ISO calendar date; impossible dates (31/02) return null. */
export function parseDayMonthYear(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/);
  if (!m) return null;
  const [d, mo] = [+m[1], +m[2]];
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}
