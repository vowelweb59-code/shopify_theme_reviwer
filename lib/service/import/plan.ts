// Turns one month of Chat messages into time entries. Pure: no I/O, so the whole rule set is testable with fixtures and
// a re-run over the same messages gives the same plan (persist.ts then upserts it idempotently).
// Rules: docs/design/data-import.md. Sender owns the hours; everything is IST; timer hours come from timestamps;
// manual hours come from the OFF Timer line; an ON figure in a report is compared with the timer hours.
import { classifyMessage, type MessageKind } from './classify';
import { extractClient, findClientByFirstWord, findClientInText, profileTail } from './client-field';
import type { KnownClient } from './client-match';
import { reconcileOnTimer } from './reconcile';
import { pairTimerEvents } from './timer-intervals';
import type { TimerEvent } from './timer-message';
import { istDate, normalizeName } from './text';
import { isLateReport } from './week';

export const PARSER_VERSION = 'import-v2';
/** Note on an entry the importer set aside by rule (open timers). Re-derived on every import, unlike a person's rejection. */
export const AUTO_IGNORED = 'AUTO_IGNORED';

export interface RawChatMessage {
  externalId: string;
  senderExternalId: string;
  senderName: string;
  /** UTC ISO, the Chat createTime. For an edited message the text is the latest version. */
  postedAt: string;
  text: string;
}

export interface SpaceInput {
  externalId: string;
  name: string;
  type: 'TIMER_STATUS' | 'CLIENT_PROJECT';
  clientId?: string | null;
  messages: RawChatMessage[];
}

export interface PlanInput {
  /** IST month "YYYY-MM". Messages outside it are ignored. */
  month: string;
  spaces: SpaceInput[];
  clients: KnownClient[];
  /** "Today" for the age-based review rules; defaults to the real time. */
  now?: Date;
}

export interface PlannedMessage {
  spaceExternalId: string;
  externalId: string;
  senderExternalId: string;
  senderName: string;
  postedAt: Date;
  text: string;
  kind: MessageKind;
}

export interface PlannedEntry {
  spaceExternalId: string;
  messageExternalId: string;
  startMessageExternalId: string | null;
  ordinal: number;
  source: 'TIMER_CALCULATED' | 'MANUAL_REPORT';
  senderExternalId: string;
  senderName: string;
  clientId: string | null;
  clientRaw: string;
  profile: string | null;
  entryDate: string;
  minutes: number;
  state: 'PARSED' | 'NEEDS_REVIEW' | 'REJECTED';
  flags: string[];
  notes: string[];
  memo: string | null;
  reportedOnTimerMinutes: number | null;
  reconciliation: string | null;
  isLate: boolean;
}

export interface ImportPlan {
  month: string;
  messages: PlannedMessage[];
  entries: PlannedEntry[];
  summary: {
    messages: number;
    byKind: Record<string, number>;
    entries: number;
    byState: Record<string, number>;
    flags: Record<string, number>;
  };
}

const DAY_MS = 86_400_000;
const IMPOSSIBLE_GAP_DAYS = 31; // a written date further than this from the posting day is a typo
const OLD_DAYS = 183;
const TIMER_MAX_MINUTES = 8 * 60 + 30; // owner: a timer longer than 8h30 counts only through a manual report // about six months: too old for a person to check

/**
 * Owner rules for the review queue (27 Oct 2026). Only what a person can still usefully decide waits for review:
 *  - no date written: the posting day is used (a note, not a flag); an unreadable ON figure is a note too;
 *  - no hours written (or unreadable): nothing to count, set aside;
 *  - an OFF with no ON, older than two weeks: set aside;
 *  - older than about six months: a timer of impossible length is set aside (it cannot be checked any more), and every
 *    other question is accepted as reported, kept as a note. Unknown clients stay unmatched and can still be matched later.
 * Set-aside entries carry AUTO_IGNORED, so a later import re-derives them like the open-timer rule.
 */
function applyQueueRules(e: PlannedEntry, now: Date) {
  const toNote = (flag: string) => {
    if (!e.flags.includes(flag)) return;
    e.flags = e.flags.filter((f) => f !== flag);
    e.notes.push(flag);
  };
  const ignore = (why: string) => {
    e.notes.push(why, AUTO_IGNORED);
    e.state = 'REJECTED';
  };
  if (e.state === 'REJECTED') return;
  toNote('MISSING_DATE');
  toNote('INVALID_DATE');
  toNote('INVALID_ON_TIMER');
  toNote('SUSPICIOUS_DURATION'); // owner: an unusually long or short duration is accepted as reported
  // A timer that ran past midnight for more than 16 hours was left running (owner: discard); a shorter one is a late shift.
  if (e.flags.includes('CROSSES_MIDNIGHT')) {
    if (e.minutes > 16 * 60) return ignore('TIMER_LEFT_RUNNING');
    toNote('CROSSES_MIDNIGHT');
  }
  if (e.minutes === 0 && (e.flags.includes('MISSING_DURATION') || e.flags.includes('INVALID_DURATION'))) return ignore('NO_HOURS_WRITTEN');
  const ageDays = (now.getTime() - Date.parse(e.entryDate)) / DAY_MS;
  // Owner rule: a timer switched off with no ON has no hours to count, whatever its age: set aside like an ON with no OFF.
  if (e.flags.includes('ORPHAN_OFF')) return ignore('OFF_WITHOUT_ON');
  // Owner rule: a stranded ON or OFF figure with no hours to count (a report giving only an ON figure, a timer stopped within the
  // minute) is set aside.
  if (e.minutes === 0) return ignore('NOTHING_TO_COUNT');
  if (ageDays > OLD_DAYS && e.flags.length) {
    if (e.flags.includes('SUSPICIOUS_DURATION') || e.flags.includes('CROSSES_MIDNIGHT')) return ignore('OLD_TIMER_IMPOSSIBLE_LENGTH');
    for (const f of [...e.flags]) toNote(f);
    e.notes.push('OLD_ACCEPTED_AS_REPORTED');
  }
}

const mid =(space: string, id: string) => `${space}\u0000${id}`;

function clientFlags(raw: string, known: readonly KnownClient[], flags: string[], notes: string[], alsoRead = '') {
  let f = extractClient(raw, known);
  // Owner rule: no client in the client field, but a known client is named in the line: that is the client
  if (f.match.status === 'UNKNOWN') {
    const byLine = findClientInText(`${raw} ${alsoRead}`, known);
    const byFirst = byLine ? null : findClientByFirstWord(raw, known);
    const found = byLine ?? byFirst;
    if (byFirst) notes.push('CLIENT_BY_FIRST_NAME');
    if (found) {
      f = { ...f, match: { status: 'EXACT', client: found } };
      notes.push('CLIENT_FOUND_IN_MESSAGE');
      const i = flags.indexOf('MISSING_CLIENT');
      if (i >= 0) flags.splice(i, 1);
    }
  }
  if (f.match.status === 'UNKNOWN') flags.push('UNKNOWN_CLIENT');
  else if (f.match.status === 'AMBIGUOUS') flags.push('AMBIGUOUS_CLIENT');
  else if (f.match.status === 'CORRECTED') notes.push('CLIENT_NAME_CORRECTED');
  const clientId = f.match.status === 'EXACT' || f.match.status === 'CORRECTED' ? f.match.client.id : null;
  return { clientId, profile: f.profile };
}

export function planImport(input: PlanInput): ImportPlan {
  const now = input.now ?? new Date();
  const messages: PlannedMessage[] = [];
  const events: TimerEvent[] = [];
  const timerEntries: PlannedEntry[] = [];
  const manual: Array<{ e: PlannedEntry; key: string }> = [];
  const meta = new Map<string, PlannedMessage>();

  // ---- 1. classify every message in the month ----
  for (const space of input.spaces) {
    for (const m of space.messages) {
      const postedAt = new Date(m.postedAt);
      if (Number.isNaN(postedAt.getTime()) || istDate(postedAt).slice(0, 7) !== input.month) continue;
      const id = mid(space.externalId, m.externalId);
      const c = classifyMessage({ id, senderId: m.senderExternalId, createTime: m.postedAt, text: m.text });
      const pm: PlannedMessage = {
        spaceExternalId: space.externalId, externalId: m.externalId, senderExternalId: m.senderExternalId,
        senderName: m.senderName, postedAt, text: m.text, kind: c.kind,
      };
      messages.push(pm);
      meta.set(id, pm);
      if (c.timer?.kind === 'EVENT') events.push(c.timer.event);
      c.reports.forEach((r, ordinal) => {
        const posted = istDate(postedAt);
        const flags = [...r.flags];
        const notes: string[] = [];
        // A mistyped day or month usually lands far from the posting day. More than a month away it cannot be right
        // (owner rule: the report takes the day it was posted); a few days away it may be a late report, so a person checks.
        const gap = r.date ? Math.abs(Date.parse(r.date) - Date.parse(posted)) : 0;
        const date = r.date && gap <= IMPOSSIBLE_GAP_DAYS * DAY_MS ? r.date : posted;
        if (r.date && gap > IMPOSSIBLE_GAP_DAYS * DAY_MS) notes.push(`DATE_CORRECTED_FROM_${r.date}`);
        else if (r.date && gap > 3 * DAY_MS) flags.push('DATE_FAR_FROM_POST');
        // A message with one report may name its client anywhere ("Project: CrawlHunt – …", or only in the memo): read all of it.
        // With several reports in one message, only that report's own memo, so one report's client never lands on another.
        const { clientId, profile } = clientFlags(r.client ?? '', input.clients, flags, notes, c.reports.length === 1 ? m.text : (r.memo ?? ''));
        const e: PlannedEntry = {
          spaceExternalId: space.externalId, messageExternalId: m.externalId, startMessageExternalId: null, ordinal,
          source: 'MANUAL_REPORT', senderExternalId: m.senderExternalId, senderName: m.senderName, clientId,
          clientRaw: r.client ?? '', profile, entryDate: date, minutes: r.minutes ?? 0, state: 'PARSED', flags, notes,
          memo: r.memo, reportedOnTimerMinutes: r.reportedOnTimerMinutes, reconciliation: null, isLate: isLateReport(date, postedAt),
        };
        manual.push({ e, key: `${m.senderExternalId}|${clientId ?? normalizeName(r.client ?? '')}|${date}` });
      });
    }
  }

  // ---- 2. timer events: the same line posted in two spaces counts once, then ON/OFF pairing ----
  const lastSeen = new Map<string, number>();
  const unique = events
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .filter((ev) => {
      const k = `${ev.senderId}|${ev.direction}|${ev.clientKey}|${ev.profileKey}`;
      const last = lastSeen.get(k);
      lastSeen.set(k, ev.at.getTime());
      return last === undefined || ev.at.getTime() - last > 60_000;
    });
  const timerKey = new Map<PlannedEntry, string>();
  for (const iv of pairTimerEvents(unique)) {
    const src = meta.get(iv.endMessageId ?? iv.startMessageId!)!;
    const flags = [...iv.flags];
    const notes = [...iv.notes];
    const { clientId } = clientFlags(iv.client, input.clients, flags, notes, iv.profile);
    const closedPair = iv.startMessageId !== null && iv.endMessageId !== null;
    const e: PlannedEntry = {
      spaceExternalId: src.spaceExternalId, messageExternalId: src.externalId,
      startMessageExternalId: closedPair ? meta.get(iv.startMessageId!)!.externalId : null,
      ordinal: 0, source: 'TIMER_CALCULATED', senderExternalId: iv.senderId, senderName: src.senderName, clientId,
      clientRaw: iv.client, profile: profileTail(iv.profile), entryDate: iv.istDate, minutes: iv.minutes ?? 0, state: 'PARSED', flags, notes,
      memo: null, reportedOnTimerMinutes: null, reconciliation: null, isLate: isLateReport(iv.istDate, src.postedAt),
    };
    // Owner rule: a timer over 8h30 is not counted; the day's manual report, if there is one, counts instead.
    if (e.minutes > TIMER_MAX_MINUTES) {
      e.notes.push('TIMER_OVER_8H30', AUTO_IGNORED);
      e.state = 'REJECTED';
    }
    // Owner rule: a "TIMER OFF" with no ON, posted in the same message as a daily report, is set aside: the report carries the hours.
    if (e.flags.includes('ORPHAN_OFF') && src.kind === 'TIMER_AND_REPORT') {
      e.notes.push('OFF_POSTED_WITH_REPORT', AUTO_IGNORED);
      e.state = 'REJECTED';
    }
    timerEntries.push(e);
    timerKey.set(e, `${iv.senderId}|${clientId ?? normalizeName(iv.client)}|${iv.istDate}`);
  }

  // ---- 3. one report posted in two spaces counts once; a resent report with the same memo counts once (the latest); several
  //         different reports for one client and day are separate work and all count (owner rule: a manual report is real hours) ----
  const groups = new Map<string, PlannedEntry[]>();
  for (const { e, key } of manual) groups.set(key, [...(groups.get(key) ?? []), e]);
  for (const group of groups.values()) {
    const kept: PlannedEntry[] = [];
    for (const e of group) {
      const dup = kept.find((k) => k.minutes === e.minutes && (k.messageExternalId !== e.messageExternalId || k.spaceExternalId !== e.spaceExternalId));
      if (dup) {
        e.notes.push('DUPLICATE_POST');
        e.state = 'REJECTED';
        continue;
      }
      // the same memo again with other hours is a corrected resend: the newer report replaces the older one
      const memo = normalizeName(e.memo ?? '');
      const older = memo.length >= 12 ? kept.find((k) => normalizeName(k.memo ?? '') === memo && k.messageExternalId !== e.messageExternalId) : undefined;
      if (older) {
        older.notes.push('DUPLICATE_POST', 'SUPERSEDED_BY_RESEND');
        older.state = 'REJECTED';
        kept.splice(kept.indexOf(older), 1);
      }
      kept.push(e);
    }
    if (kept.length > 1) for (const e of kept) e.notes.push('MULTIPLE_REPORTS_SAME_DAY');
  }

  // ---- 4. compare the ON figure in each report with the timer hours for the same sender + client + day ----
  const timerTotals = new Map<string, number>();
  for (const [e, key] of timerKey) {
    if (!e.flags.includes('OPEN_INTERVAL') && !e.flags.includes('ORPHAN_OFF')) timerTotals.set(key, (timerTotals.get(key) ?? 0) + e.minutes);
  }
  for (const { e, key } of manual) {
    if (e.state === 'REJECTED' || e.reportedOnTimerMinutes === null) continue;
    const r = reconcileOnTimer(timerTotals.get(key) ?? null, e.reportedOnTimerMinutes);
    if (!r) continue;
    e.reconciliation = r.status;
    // Owner rule: a manual report is real working time. A missing or different ON figure is kept as a note, not a review flag.
    if (r.status === 'NO_TIMER_DATA') {
      e.notes.push('ON_TIMER_NOT_FOUND');
      // Owner rule (29 Oct): no timer hours behind the report's ON figure (the timer was never switched off, or never posted):
      // the reported figure counts as the person's time, unless the report already carries OFF-timer hours of its own.
      if (e.minutes === 0) {
        e.minutes = e.reportedOnTimerMinutes;
        e.notes.push('ON_TIMER_FROM_REPORT');
      }
    }
    if (r.status === 'MISMATCH') {
      e.notes.push('ON_TIMER_MISMATCH');
      for (const [t, k] of timerKey) if (k === key) t.notes.push('ON_TIMER_MISMATCH');
    }
  }

  // ---- 5. owner rule: one person, one client, one day with BOTH timer hours and a manual report counts only one of them, the larger ----
  const counted = (e: PlannedEntry) => e.state !== 'REJECTED' && !e.flags.includes('OPEN_INTERVAL') && !e.flags.includes('ORPHAN_OFF') && !e.flags.includes('DUPLICATE_ON');
  const byDay = new Map<string, { timers: PlannedEntry[]; reports: PlannedEntry[] }>();
  for (const [e, key] of timerKey) if (counted(e)) (byDay.get(key) ?? byDay.set(key, { timers: [], reports: [] }).get(key)!).timers.push(e);
  for (const { e, key } of manual) if (counted(e)) (byDay.get(key) ?? byDay.set(key, { timers: [], reports: [] }).get(key)!).reports.push(e);
  for (const g of byDay.values()) {
    const timer = g.timers.reduce((n, e) => n + e.minutes, 0);
    const report = g.reports.reduce((n, e) => n + e.minutes, 0);
    if (!timer || !report) continue;
    const [drop, why] = report >= timer ? [g.timers, 'TIMER_SUPERSEDED_BY_REPORT'] : [g.reports, 'REPORT_SUPERSEDED_BY_TIMER'];
    for (const e of drop) {
      e.notes.push(why, AUTO_IGNORED);
      e.state = 'REJECTED';
    }
  }

  const entries = [...timerEntries, ...manual.map((x) => x.e)];
  for (const e of entries) {
    // Owner rule: a timer switched on and never off (or switched on twice) is ignored: it has no hours to count.
    if (e.flags.includes('OPEN_INTERVAL') || e.flags.includes('DUPLICATE_ON')) {
      e.notes.push(AUTO_IGNORED);
      e.state = 'REJECTED';
    }
    applyQueueRules(e, now);
    if (e.state !== 'REJECTED') e.state = e.flags.length ? 'NEEDS_REVIEW' : 'PARSED';
  }
  entries.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.senderName.localeCompare(b.senderName));

  const count = <T>(xs: T[], f: (x: T) => string[]) =>
    xs.flatMap(f).reduce<Record<string, number>>((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {});
  return {
    month: input.month, messages, entries,
    summary: {
      messages: messages.length,
      byKind: count(messages, (m) => [m.kind]),
      entries: entries.length,
      byState: count(entries, (e) => [e.state]),
      flags: count(entries, (e) => e.flags),
    },
  };
}
