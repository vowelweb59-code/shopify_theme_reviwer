import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { istDay } from "@/lib/service/chat/months";
import { AttendanceMessage, AttendanceSync } from "@/models/attendance";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { TeamMember } from "@/models/team-member";
import { TimeEntry } from "@/models/time-entry";
import { addDays, buildGrid, daysBetween, matchPersonKey, type Leave, type PersonInput, type Source } from "./grid";
import { normalizeName, parseLeaveMessage } from "./leave";

// Attendance for one month: who reported in Upwork (TIMER STATUS) and in the theme team (Theme Status Group), against the leaves
// announced in the attendance space, with every missing day flagged. Read-only over the three sources; it writes nothing.

const LOOKBACK_DAYS = 35; // reports before the month, so someone's first report and "still active" are known
const LEAVE_LOOKBACK_DAYS = 120; // a leave can be announced well before the day, or late

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function buildAttendanceReport(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must be YYYY-MM.");
  await connectToDatabase();
  const first = `${month}-01`;
  const last = lastDayOf(month);
  const days = daysBetween(first, last);
  const today = istDay(new Date());
  const from = new Date(`${addDays(first, -LOOKBACK_DAYS)}T00:00:00Z`);
  const to = new Date(`${last}T00:00:00Z`);

  const [serviceEntries, themeEntries, members, messages, sync] = await Promise.all([
    ServiceTimeEntry.find({ entryDate: { $gte: from, $lte: to } }).select("-_id senderExternalId entryDate").lean<{ senderExternalId: string; entryDate: Date }[]>(),
    TimeEntry.find({ date: { $gte: from, $lte: to } }).select("-_id memberId date").lean<{ memberId: { toString(): string }; date: Date }[]>(),
    TeamMember.find({}).select("name aliases").lean<{ _id: { toString(): string }; name: string; aliases?: string[] }[]>(),
    AttendanceMessage.find({ postedAt: { $gte: new Date(from.getTime() - (LEAVE_LOOKBACK_DAYS - LOOKBACK_DAYS) * 86_400_000) } }).sort({ postedAt: 1 }).select("-_id text mentions postedAt senderName").lean<{ text: string; mentions: { start: number; length: number; displayName: string | null }[]; postedAt: Date; senderName: string }[]>(),
    AttendanceSync.findOne({ key: "attendance" }).select("-_id lastSyncAt lastCount lastError lastWindowFrom").lean<{ lastSyncAt: Date | null; lastCount: number; lastError: string | null; lastWindowFrom: Date | null } | null>(),
  ]);
  const senderIds = [...new Set(serviceEntries.map((e) => e.senderExternalId))];
  const senders = await ServiceChatSender.find({ externalId: { $in: senderIds } }).select("-_id externalId displayName").lean<{ externalId: string; displayName: string }[]>();

  // People: theme members first (name and aliases), then service senders, merged when they are the same person.
  const people = new Map<string, PersonInput & { names: string[] }>();
  const add = (key: string, name: string, names: string[]) => {
    const existing = people.get(key);
    if (existing) {
      existing.names.push(...names.filter((n) => !existing.names.includes(n)));
      return existing;
    }
    const p = { key, name, names: [...names], reports: { upwork: new Set<string>(), theme: new Set<string>() } };
    people.set(key, p);
    return p;
  };
  const memberKey = new Map<string, string>();
  for (const m of members) {
    const key = normalizeName(m.name);
    add(key, m.name, [m.name, ...(m.aliases ?? [])]);
    memberKey.set(String(m._id), key);
  }
  for (const e of themeEntries) {
    const p = people.get(memberKey.get(String(e.memberId)) ?? "");
    if (p) p.reports.theme.add(day(e.date));
  }
  const senderKey = new Map<string, string>();
  for (const s of senders) {
    const key = matchPersonKey(s.displayName, [...people.values()], normalizeName) ?? normalizeName(s.displayName);
    add(key, s.displayName, [s.displayName]);
    senderKey.set(s.externalId, key);
  }
  for (const e of serviceEntries) {
    const p = people.get(senderKey.get(e.senderExternalId) ?? "");
    if (p) p.reports.upwork.add(day(e.entryDate));
  }

  // Leaves announced in the space, attributed to people by name; a cancellation takes the days back.
  const list = [...people.values()];
  const leaves = new Map<string, Map<string, Leave>>();
  const unmatched: { person: string; dates: string[]; postedAt: string }[] = [];
  const review: { postedAt: string; text: string; why: string }[] = [];
  let announcements = 0;
  for (const m of messages) {
    const parsed = parseLeaveMessage(m.text, m.mentions, m.postedAt, list.flatMap((p) => p.names));
    if (parsed.kind === "other") continue;
    if (parsed.kind === "unparsed") {
      review.push({ postedAt: m.postedAt.toISOString(), text: m.text, why: parsed.why });
      continue;
    }
    announcements++;
    const key = matchPersonKey(parsed.person, list, normalizeName);
    if (!key) {
      unmatched.push({ person: parsed.person, dates: parsed.dates, postedAt: m.postedAt.toISOString() });
      continue;
    }
    const mine = leaves.get(key) ?? new Map<string, Leave>();
    for (const d of parsed.dates) {
      if (parsed.kind === "cancel") mine.delete(d);
      else mine.set(d, { half: parsed.half, reason: parsed.reason });
    }
    leaves.set(key, mine);
  }

  const { rows, flags } = buildGrid({ days, today, people: list, leaves });
  return {
    month,
    days,
    today,
    rows: rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ day: c.day, status: c.status, reportedIn: c.reportedIn, leave: c.leave })) })),
    flags,
    summary: {
      people: rows.length,
      flags: flags.length,
      missing: flags.filter((f) => f.kind === "missing").length,
      conflicts: flags.filter((f) => f.kind === "leave-but-reported").length,
      announcements,
      messages: messages.length,
    },
    unmatched,
    review,
    sync: sync ? { lastSyncAt: sync.lastSyncAt, lastCount: sync.lastCount, lastError: sync.lastError, lastWindowFrom: sync.lastWindowFrom } : null,
  };
}

export type AttendanceReport = Awaited<ReturnType<typeof buildAttendanceReport>>;
export type { Source };
