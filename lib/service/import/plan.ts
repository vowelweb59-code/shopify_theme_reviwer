// Turns one month of Chat messages into time entries. Pure: no I/O, so the whole rule set is testable with fixtures and
// a re-run over the same messages gives the same plan (persist.ts then upserts it idempotently).
// Rules: docs/design/data-import.md. Sender owns the hours; everything is IST. HOURS COME FROM THE REPORTS ONLY (owner, 2026-11-21: "consider the
// report only, not the TIMER ON / TIMER OFF messages"): a report's hours are its OFF Timer line plus its ON Timer figure. The "<client> - TIMER
// ON" / "TIMER OFF" messages are still read and stored (they are Chat messages) and count ONLY as a fallback (owner, 2026-11-25): when a person
// wrote no report at all for that client on that day, their timer ON / OFF pairs for it count (TIMER_FALLBACK, source TIMER_CALCULATED).
import { classifyMessage, type MessageKind } from "./classify";
import { extractClient, findClientByFirstWord, findClientInText } from "./client-field";
import type { KnownClient } from "./client-match";
import type { TimerEvent } from "./timer-message";
import { istDate, normalizeName } from "./text";
import { isLateReport } from "./week";

export const PARSER_VERSION = "import-v2";
/** Note on an entry the importer set aside by rule (open timers). Re-derived on every import, unlike a person's rejection. */
export const AUTO_IGNORED = "AUTO_IGNORED";

export interface RawChatMessage {
  externalId: string;
  senderExternalId: string;
  senderName: string;
  /** UTC ISO, the Chat createTime. For an edited message the text is the latest version. */
  postedAt: string;
  text: string;
  /** Chat's thread id when the reader supplies it (only the Space scan export uses it). */
  threadName?: string;
}

export interface SpaceInput {
  externalId: string;
  name: string;
  type: "TIMER_STATUS" | "CLIENT_PROJECT";
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
  source: "TIMER_CALCULATED" | "MANUAL_REPORT";
  senderExternalId: string;
  senderName: string;
  clientId: string | null;
  clientRaw: string;
  profile: string | null;
  entryDate: string;
  minutes: number;
  state: "PARSED" | "NEEDS_REVIEW" | "REJECTED";
  flags: string[];
  notes: string[];
  memo: string | null;
  reportedOnTimerMinutes: number | null;
  reconciliation: string | null;
  isLate: boolean;
  /** Set only by `filterPlanToDigitalMarketing` (dm-filter.ts) for someone outside the team; written when the entry is created. */
  projectId?: string | null;
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
/** A timer interval longer than this was left running, not worked (the older timer rule): it is not counted. */
const MAX_TIMER_FALLBACK_MINUTES = 8.5 * 60;
const IMPOSSIBLE_GAP_DAYS = 31; // a written date further than this from the posting day is a typo
const OLD_DAYS = 183;
// about six months: too old for a person to check

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
    e.state = "REJECTED";
  };
  if (e.state === "REJECTED") return;
  toNote("MISSING_DATE");
  toNote("INVALID_DATE");
  toNote("INVALID_ON_TIMER");
  toNote("SUSPICIOUS_DURATION"); // owner: an unusually long or short duration is accepted as reported
  // A timer that ran past midnight for more than 16 hours was left running (owner: discard); a shorter one is a late shift.
  if (e.flags.includes("CROSSES_MIDNIGHT")) {
    if (e.minutes > 16 * 60) return ignore("TIMER_LEFT_RUNNING");
    toNote("CROSSES_MIDNIGHT");
  }
  if (e.minutes === 0 && (e.flags.includes("MISSING_DURATION") || e.flags.includes("INVALID_DURATION"))) return ignore("NO_HOURS_WRITTEN");
  const ageDays = (now.getTime() - Date.parse(e.entryDate)) / DAY_MS;
  // Owner rule: a stranded ON or OFF figure with no hours to count (a report giving only an ON figure, a timer stopped within the
  // minute) is set aside.
  if (e.minutes === 0) return ignore("NOTHING_TO_COUNT");
  if (ageDays > OLD_DAYS && e.flags.length) {
    if (e.flags.includes("SUSPICIOUS_DURATION") || e.flags.includes("CROSSES_MIDNIGHT")) return ignore("OLD_TIMER_IMPOSSIBLE_LENGTH");
    for (const f of [...e.flags]) toNote(f);
    e.notes.push("OLD_ACCEPTED_AS_REPORTED");
  }
}

const mid = (space: string, id: string) => `${space}\u0000${id}`;

function clientFlags(raw: string, known: readonly KnownClient[], flags: string[], notes: string[], alsoRead = "") {
  let f = extractClient(raw, known);
  // Owner rule: no client in the client field, but a known client is named in the line: that is the client
  if (f.match.status === "UNKNOWN") {
    const byLine = findClientInText(`${raw} ${alsoRead}`, known);
    const byFirst = byLine ? null : findClientByFirstWord(raw, known);
    const found = byLine ?? byFirst;
    if (byFirst) notes.push("CLIENT_BY_FIRST_NAME");
    if (found) {
      f = { ...f, match: { status: "EXACT", client: found } };
      notes.push("CLIENT_FOUND_IN_MESSAGE");
      const i = flags.indexOf("MISSING_CLIENT");
      if (i >= 0) flags.splice(i, 1);
    }
  }
  if (f.match.status === "UNKNOWN") flags.push("UNKNOWN_CLIENT");
  else if (f.match.status === "AMBIGUOUS") flags.push("AMBIGUOUS_CLIENT");
  else if (f.match.status === "CORRECTED") notes.push("CLIENT_NAME_CORRECTED");
  const clientId = f.match.status === "EXACT" || f.match.status === "CORRECTED" ? f.match.client.id : null;
  return { clientId, profile: f.profile };
}

export function planImport(input: PlanInput): ImportPlan {
  const now = input.now ?? new Date();
  const messages: PlannedMessage[] = [];
  const manual: Array<{ e: PlannedEntry; key: string }> = [];
  const meta = new Map<string, PlannedMessage>();
  const timerEvents: Array<{ ev: TimerEvent; spaceExternalId: string; messageExternalId: string; senderName: string }> = [];

  // ---- 1. classify every message in the month ----
  for (const space of input.spaces) {
    for (const m of space.messages) {
      const postedAt = new Date(m.postedAt);
      if (Number.isNaN(postedAt.getTime()) || istDate(postedAt).slice(0, 7) !== input.month) continue;
      const id = mid(space.externalId, m.externalId);
      const c = classifyMessage({ id, senderId: m.senderExternalId, createTime: m.postedAt, text: m.text });
      const pm: PlannedMessage = {
        spaceExternalId: space.externalId,
        externalId: m.externalId,
        senderExternalId: m.senderExternalId,
        senderName: m.senderName,
        postedAt,
        text: m.text,
        kind: c.kind,
      };
      messages.push(pm);
      meta.set(id, pm);
      if (c.timer?.kind === "EVENT")
        timerEvents.push({ ev: c.timer.event, spaceExternalId: space.externalId, messageExternalId: m.externalId, senderName: m.senderName });
      c.reports.forEach((r, ordinal) => {
        const posted = istDate(postedAt);
        const flags = [...r.flags];
        const notes: string[] = [];
        // A mistyped day or month usually lands far from the posting day. More than a month away it cannot be right
        // (owner rule: the report takes the day it was posted); a few days away it may be a late report, so a person checks.
        const gap = r.date ? Math.abs(Date.parse(r.date) - Date.parse(posted)) : 0;
        const date = r.date && gap <= IMPOSSIBLE_GAP_DAYS * DAY_MS ? r.date : posted;
        if (r.date && gap > IMPOSSIBLE_GAP_DAYS * DAY_MS) notes.push(`DATE_CORRECTED_FROM_${r.date}`);
        else if (r.date && gap > 3 * DAY_MS) flags.push("DATE_FAR_FROM_POST");
        // A message with one report may name its client anywhere ("Project: CrawlHunt – …", or only in the memo): read all of it.
        // With several reports in one message, only that report's own memo, so one report's client never lands on another.
        const { clientId, profile } = clientFlags(r.client ?? "", input.clients, flags, notes, c.reports.length === 1 ? m.text : (r.memo ?? ""));
        const e: PlannedEntry = {
          spaceExternalId: space.externalId,
          messageExternalId: m.externalId,
          startMessageExternalId: null,
          ordinal,
          source: "MANUAL_REPORT",
          senderExternalId: m.senderExternalId,
          senderName: m.senderName,
          clientId,
          clientRaw: r.client ?? "",
          profile,
          entryDate: date,
          minutes: r.minutes ?? 0,
          state: "PARSED",
          flags,
          notes,
          memo: r.memo,
          reportedOnTimerMinutes: r.reportedOnTimerMinutes,
          reconciliation: null,
          isLate: isLateReport(date, postedAt),
        };
        manual.push({ e, key: `${m.senderExternalId}|${clientId ?? normalizeName(r.client ?? "")}|${date}` });
      });
    }
  }

  // ---- 2. timer ON / OFF messages: not counted (owner, 2026-11-21: the reports are the only source of hours) ----

  // ---- 3. one report posted in two spaces counts once; a resent report with the same memo counts once (the latest); several
  //         different reports for one client and day are separate work and all count (owner rule: a manual report is real hours) ----
  const groups = new Map<string, PlannedEntry[]>();
  for (const { e, key } of manual) groups.set(key, [...(groups.get(key) ?? []), e]);
  for (const group of groups.values()) {
    const kept: PlannedEntry[] = [];
    for (const e of group) {
      const dup = kept.find((k) => k.minutes === e.minutes && (k.messageExternalId !== e.messageExternalId || k.spaceExternalId !== e.spaceExternalId));
      if (dup) {
        e.notes.push("DUPLICATE_POST");
        e.state = "REJECTED";
        continue;
      }
      // the same memo again with other hours is a corrected resend: the newer report replaces the older one
      const memo = normalizeName(e.memo ?? "");
      const older = memo.length >= 12 ? kept.find((k) => normalizeName(k.memo ?? "") === memo && k.messageExternalId !== e.messageExternalId) : undefined;
      if (older) {
        older.notes.push("DUPLICATE_POST", "SUPERSEDED_BY_RESEND");
        older.state = "REJECTED";
        kept.splice(kept.indexOf(older), 1);
      }
      kept.push(e);
    }
    if (kept.length > 1) for (const e of kept) e.notes.push("MULTIPLE_REPORTS_SAME_DAY");
  }

  // ---- 4. a report's hours = its OFF Timer line (`minutes`) + its ON Timer figure. The ON figure is what the person reports of the timed
  //         work; the timer messages are not compared with it (owner, 2026-11-21: Rupali 16 Nov, Yuri Parreno: counting both the report and
  //         the TIMER ON / OFF messages gave hours the reports do not show). Duplicate and superseded reports stay rejected. ----
  for (const { e } of manual) {
    if (e.state === "REJECTED" || !e.reportedOnTimerMinutes) continue;
    e.minutes += e.reportedOnTimerMinutes;
    e.notes.push("ON_TIMER_COUNTED");
  }

  // ---- 5. fallback: a person's timer ON / OFF pairs for a client count only on a day they wrote NO report for that client ----
  const reportKeys = new Set(manual.map((x) => x.key));
  const timerEntries: PlannedEntry[] = [];
  const open = new Map<string, (typeof timerEvents)[number]>();
  const sorted = [...timerEvents].sort((a, b) => a.ev.at.getTime() - b.ev.at.getTime());
  for (const t of sorted) {
    const k = `${t.ev.senderId}|${t.ev.clientKey}|${t.ev.profileKey}`;
    if (t.ev.direction === "ON") {
      if (!open.has(k)) open.set(k, t); // a second ON while one is open changes nothing
      continue;
    }
    const start = open.get(k);
    if (!start) continue; // an OFF with no ON has nothing to count
    open.delete(k);
    const minutes = Math.round((t.ev.at.getTime() - start.ev.at.getTime()) / 60_000);
    if (minutes <= 0 || minutes > MAX_TIMER_FALLBACK_MINUTES) continue;
    const date = istDate(start.ev.at);
    const flags: string[] = [];
    const notes = ["TIMER_FALLBACK"];
    const { clientId, profile } = clientFlags(`${t.ev.client} | ${t.ev.profile}`, input.clients, flags, notes);
    if (reportKeys.has(`${t.ev.senderId}|${clientId ?? normalizeName(t.ev.client)}|${date}`)) continue;
    timerEntries.push({
      spaceExternalId: t.spaceExternalId,
      messageExternalId: t.messageExternalId,
      startMessageExternalId: start.messageExternalId,
      ordinal: 0,
      source: "TIMER_CALCULATED",
      senderExternalId: t.ev.senderId,
      senderName: t.senderName,
      clientId,
      clientRaw: t.ev.client,
      profile,
      entryDate: date,
      minutes,
      state: "PARSED",
      flags,
      notes,
      memo: null,
      reportedOnTimerMinutes: null,
      reconciliation: null,
      isLate: false,
    });
  }

  const entries = [...manual.map((x) => x.e), ...timerEntries];
  for (const e of entries) {
    applyQueueRules(e, now);
    if (e.state !== "REJECTED") e.state = e.flags.length ? "NEEDS_REVIEW" : "PARSED";
  }
  entries.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.senderName.localeCompare(b.senderName));

  const count = <T>(xs: T[], f: (x: T) => string[]) => xs.flatMap(f).reduce<Record<string, number>>((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {});
  return {
    month: input.month,
    messages,
    entries,
    summary: {
      messages: messages.length,
      byKind: count(messages, (m) => [m.kind]),
      entries: entries.length,
      byState: count(entries, (e) => [e.state]),
      flags: count(entries, (e) => e.flags),
    },
  };
}
