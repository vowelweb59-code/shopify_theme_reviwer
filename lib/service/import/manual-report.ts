// OFF-timer stream: manual daily reports. Hours are taken as written, only from the "OFF Timer" line.
// Any "ON Timer" figure in a report is ignored for hours (ON-timer hours come from the timer messages) and kept for cross-checks.
// Real reports vary a lot (see test/import-real-formats.test.ts): different headers, label spellings, separators and duration styles.
import { parseDayMonthYear, parseDuration } from './text';

export interface ManualEntry {
  /** ISO date, IST. Null when missing or impossible (flagged). */
  date: string | null;
  client: string | null;
  /** OFF Timer minutes as reported; null when absent or unparseable. */
  minutes: number | null;
  /** ON Timer minutes the author wrote, if any. Never counted. */
  reportedOnTimerMinutes: number | null;
  memo: string | null;
  flags: string[];
  state: 'PARSED' | 'NEEDS_REVIEW';
}

// A header line starts a new block and carries the date: "Daily Report – 23/10/2026", "Timer Report (23-10-2026)",
// "Date:- 23/10/26", "Work Update - 23/10/2026".
const HEADER = /^\s*(?:daily\s*report|timer\s*report|work\s*update|date)\b(.*)$/i;
const DATE_IN = /(\d{1,2}[-/.]\d{1,2}[-/.](?:\d{4}|\d{2}))/;
// Labels. "Project:" is read as the client line too (some reports name the project instead). Client and memo need a separator ("Client: x"); timer labels may omit it ("Off Timer 1:00 hr").
const LABEL = /^\s*(client\s*name|project\s*name|client|project|memo|off\s*[-–—]?\s*timer|on\s*[-–—]?\s*timer)\s*([-–—:]+)?\s*(.*)$/i;
// Lines made only of rule characters ("=====", "-----", "—-----") are decoration, not memo text.
const DECORATION = /^[\s=\-–—_*~.]*$/;
const MAX_PLAUSIBLE_MINUTES = 16 * 60;

interface Draft {
  date?: string;
  client?: string;
  off?: string;
  on?: string;
  memo?: string;
}

const labelKey = (raw: string): 'client' | 'memo' | 'off' | 'on' => {
  const k = raw.toLowerCase().replace(/[\s\-–—]+/g, '');
  if (k.startsWith('offtimer')) return 'off';
  if (k.startsWith('ontimer')) return 'on';
  return k === 'memo' ? 'memo' : 'client';
};

/** A short line with a "Name | Profile" or "Name - Profile" shape, whose next written line is an OFF, ON or Memo label. */
function looksLikeClientLine(line: string, rest: readonly string[]): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80 || /[.:]$/.test(t) || !/\s\|\s?|\s?\|\s|\s[-–—]\s/.test(t)) return false;
  const next = rest.find((l) => l.trim() && !DECORATION.test(l));
  const m = next?.match(LABEL);
  if (!m) return false;
  const k = labelKey(m[1]!);
  return k === 'off' || k === 'on' || (k === 'memo' && !!m[2]); // timer labels may omit the colon, "Memo" may not
}

/** A message may carry several Client blocks under one date header. A new Client line (or a new header) starts a new entry. */
export function parseManualReport(text: string): ManualEntry[] {
  const drafts: Draft[] = [];
  let cur: Draft = {};
  let date: string | undefined;
  let lastKey: string | null = null;
  const push = () => {
    if (cur.client || cur.off || cur.on || cur.memo) drafts.push(cur);
    cur = {};
  };

  const lines = text.split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    if (DECORATION.test(line)) continue;
    const h = line.match(HEADER);
    if (h) {
      const rest = h[1].replace(/^[\s\-–—:()]+|[\s)]+$/g, '');
      const headerDate = rest.match(DATE_IN)?.[1] ?? (rest || undefined);
      // "Client: Tim Fitz | Adnan" then "Date: 16/10/2026": a date written after the client line belongs to that block.
      if (cur.client && !cur.off && !cur.on && !cur.memo) {
        date = headerDate;
        cur.date = headerDate;
        lastKey = null;
        continue;
      }
      push();
      lastKey = null;
      date = headerDate;
      continue;
    }
    const m = line.match(LABEL);
    const key = m ? labelKey(m[1]) : null;
    // "Client" or "Memo" without a separator is ordinary text (e.g. a wrapped memo line starting with the word).
    if (!m || !key || (!m[2] && (key === 'client' || key === 'memo'))) {
      // Owner rule: a client line written without "Client:" ("Andrew Johnson | AShfaque", "Gary Mcnelley (Revitol) - Farida"),
      // followed by the block's OFF/ON/Memo line, starts a new block. A memo still waiting for its OFF line keeps the text.
      if (looksLikeClientLine(line, lines.slice(i + 1)) && !(lastKey === 'memo' && cur.off === undefined && cur.on === undefined)) {
        push();
        cur.client = line.trim().replace(/\s*\|\s*no\s*timer\s*$/i, '');
        cur.date = date;
        lastKey = 'client';
        continue;
      }
      if (lastKey === 'memo' && line.trim() && cur.memo !== undefined) cur.memo += `\n${line.trim()}`;
      continue;
    }
    const val = m[3].trim();
    lastKey = key;
    if (key === 'client') {
      if (cur.client) push();
      // "| No Timer" only says nothing was timed; the hours come from the OFF line.
      cur.client = val.replace(/\s*\|\s*no\s*timer\s*$/i, '');
      cur.date = date;
    } else {
      cur.date ??= date;
      if (key === 'off') cur.off = val;
      else if (key === 'on') cur.on = val;
      else cur.memo = val;
    }
  }
  push();

  return drafts.map((d) => {
    const flags: string[] = [];
    const isoDate = d.date ? parseDayMonthYear(d.date) : null;
    if (!d.date) flags.push('MISSING_DATE');
    else if (!isoDate) flags.push('INVALID_DATE');
    if (!d.client) flags.push('MISSING_CLIENT');

    let reportedOn: number | null = null;
    if (d.on !== undefined) {
      const p = parseDuration(d.on);
      reportedOn = p.minutes ?? null;
      if (p.flag === 'INVALID_DURATION') flags.push('INVALID_ON_TIMER');
    }
    let minutes: number | null = null;
    if (d.off === undefined) {
      // Only an ON-timer-only report legitimately has no OFF Timer line.
      if (d.on === undefined) flags.push('MISSING_DURATION');
    } else {
      const p = parseDuration(d.off);
      minutes = p.minutes ?? null;
      if (p.flag) flags.push(p.flag);
      // "OFF Timer: 0:00" next to ON-timer hours just means no manual time that day.
      const zeroOk = minutes === 0 && d.on !== undefined;
      if (minutes !== null && !zeroOk && (minutes <= 0 || minutes > MAX_PLAUSIBLE_MINUTES)) flags.push('SUSPICIOUS_DURATION');
    }
    return {
      date: isoDate, client: d.client || null, minutes, reportedOnTimerMinutes: reportedOn,
      memo: d.memo?.trim() || null, flags, state: flags.length ? 'NEEDS_REVIEW' : 'PARSED',
    };
  });
}
