// Owner rule: a project nobody has reported hours on in the last 30 WORKING days is put On hold (2026-11-16; was 45 calendar days,
// 27 Oct 2026); as soon as hours arrive again it goes back to Active. Working days skip Sundays (the owner's rule elsewhere in this
// app); the window is the 30 most recent working days up to and including today, IST. Only holds this rule placed are lifted by it:
// a project a person put on hold stays on hold. Runs after every import. Closed projects and projects that began inside the window
// are never touched.
// Second rule (owner, 2026-11-16): an Active project with a Digital Marketing team member on it whose team members have not reported
// on it for 60 days (calendar) is also put On hold "for DM", until one of them reports again. Others' hours do not count for this one.
import { dmMatch } from "../dm-members";
import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import { loadDmProjects } from "../import/dm-projects";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkContract } from "@/models/service-upwork";
import { istDay } from "@/lib/time/ist";

export const IDLE_WORKING_DAYS = 30;
export const AUTO_HOLD_REASON = `Automatic: no hours for ${IDLE_WORKING_DAYS} working days`;
export const AUTO_RESUME_REASON = "Automatic: hours reported again";
export const DM_IDLE_DAYS = 60;
/** Set by `scripts/service-hold-project.ts`: the owner holds a project until a team member reports on it. */
export const HOLD_UNTIL_TEAM_REASON = "Hold until a Digital Marketing team report";
/** Written by a rule removed on 2026-11-24 (Not started projects now stay in their own tab); kept so those older holds are still read as Not started. */
export const NOT_STARTED_HOLD_REASON = "Automatic: the team is working on a project still marked Not started";
export const AUTO_HOLD_DM_REASON = `Automatic: no Digital Marketing team report for ${DM_IDLE_DAYS} days`;
const DAY_MS = 86_400_000;
/** Holds placed by these rules, under the current or an earlier wording ("... for 45 days"). */
export const isAutoHold = (reason: string | null | undefined) => !!reason && (reason.startsWith("Automatic: no hours for ") || reason === AUTO_HOLD_DM_REASON);

/** The first day (UTC midnight of an IST date, as entry dates are stored) of the `n` most recent working days up to today. */
export function workingDaysCutoff(now: Date, n = IDLE_WORKING_DAYS): Date {
  let d = new Date(`${istDay(now)}T00:00:00Z`);
  let counted = d.getUTCDay() === 0 ? 0 : 1;
  while (counted < n) {
    d = new Date(d.getTime() - DAY_MS);
    if (d.getUTCDay() !== 0) counted++;
  }
  return d;
}

export interface ActivityResult {
  held: string[];
  resumed: string[];
  /** Completed projects put back to Active because hours were reported after they were completed. */
  reopened: string[];
}

/** Completed on purpose while it still gets small support (owner, 2026-11-18): never reopened by new hours. */
export const REOPEN_EXEMPT = new Set(["Ranjith K"]);
export const AUTO_REOPEN_REASON = "Automatic: hours reported after the project was completed";

/**
 * Owner rule (2026-11-18): a Completed project whose client reports hours again is reopened, counting only Digital Marketing team
 * members' hours (owner, same day, Morten - WordPress: "it will not come in my team unless someone from my team is logging hours"; other
 * teams working on it, e.g. app development, do not reopen it). `completedOn` is the day it was
 * completed (its latest move to Completed); with no such record (migrated projects) nothing can be told, so it is left alone.
 * Hours dated in the future (typing errors) never count; only hours attributed to the project do, so a client with an open
 * project reopens nothing.
 */
export function shouldReopen(i: { completedOn: Date | null; lastAny: Date | undefined; today: Date }): boolean {
  if (!i.completedOn || !i.lastAny) return false;
  const day = (d: Date) => istDay(new Date(d));
  return day(i.lastAny) > day(i.completedOn) && i.lastAny <= i.today;
}

export interface HoldInput {
  /** Newest reported day by anyone / by a Digital Marketing team member on the project, if any. */
  lastAny: Date | undefined;
  lastDm: Date | undefined;
  /** A Digital Marketing person is on the project's team. */
  hasDmMember: boolean;
  /** The earliest known date of the project. */
  began: Date;
  cutoff: Date;
  dmCutoff: Date;
}

/** Why an Active project should be On hold now, or null. The two rules are independent; the first that applies names the hold. */
export function holdReason(i: HoldInput): string | null {
  if (!(i.lastAny && i.lastAny >= i.cutoff) && i.began < i.cutoff) return AUTO_HOLD_REASON;
  if (i.hasDmMember && !(i.lastDm && i.lastDm >= i.dmCutoff) && i.began < i.dmCutoff) return AUTO_HOLD_DM_REASON;
  return null;
}

/** `dryRun` only reports what would change (name and reason) and writes nothing. */
export async function applyActivityRules(now = new Date(), opts: { dryRun?: boolean } = {}): Promise<ActivityResult & { reasons: Record<string, string> }> {
  const cutoff = workingDaysCutoff(now);
  const dmCutoff = new Date(new Date(`${istDay(now)}T00:00:00Z`).getTime() - (DM_IDLE_DAYS - 1) * DAY_MS);
  const att = await loadAttribution();
  const senderName = new Map(
    (await ServiceChatSender.find().select("externalId displayName").lean<Array<{ externalId: string; displayName: string }>>()).map((x) => [
      x.externalId,
      x.displayName,
    ])
  );
  const entries = await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } })
    .select("projectId clientId minutes entryDate allocations senderExternalId")
    .lean<
      Array<{
        projectId: string | null;
        clientId: string | null;
        minutes: number;
        entryDate: Date;
        allocations: Array<{ projectId: string; minutes: number }>;
        senderExternalId: string;
      }>
    >();
  const last = new Map<string, Date>();
  const lastDm = new Map<string, Date>();
  const first = new Map<string, Date>();
  for (const e of expandAllocations(entries)) {
    const pid = projectOf(e, att.owner);
    if (!pid) continue;
    if (!last.get(pid) || last.get(pid)! < e.entryDate) last.set(pid, e.entryDate);
    if (dmMatch(senderName.get(e.senderExternalId)) !== null && (!lastDm.get(pid) || lastDm.get(pid)! < e.entryDate)) lastDm.set(pid, e.entryDate);
    if (!first.get(pid) || first.get(pid)! > e.entryDate) first.set(pid, e.entryDate);
  }
  const dmMembers = new Set((await loadDmProjects()).filter((p) => p.teamNames.some((n) => dmMatch(n) !== null)).map((p) => p.id));

  const projects = await ServiceProject.find({ status: { $in: ["ACTIVE", "ON_HOLD"] } })
    .select("name status createdAt startDate history")
    .lean<Array<{ _id: string; name: string; status: string; createdAt: Date; startDate: Date | null; history: Array<{ reason: string | null; at: Date }> }>>();
  const contractStarts = new Map<string, Date[]>();
  for (const c of await ServiceUpworkContract.find({ projectId: { $in: projects.map((p) => p._id) }, startDate: { $ne: null } })
    .select("projectId startDate")
    .lean<Array<{ projectId: string; startDate: Date }>>()) {
    contractStarts.set(c.projectId, [...(contractStarts.get(c.projectId) ?? []), c.startDate]);
  }

  const out: ActivityResult & { reasons: Record<string, string> } = { held: [], resumed: [], reopened: [], reasons: {} };
  for (const p of projects) {
    const latest = [...p.history].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
    // A project that only just began has had no time to report yet. Its beginning is the earliest known date; the day it was
    // created here only when nothing else is known (projects imported from history were created long after they began).
    const known = [p.startDate, first.get(p._id), ...(contractStarts.get(p._id) ?? [])].filter((d): d is Date => !!d);
    const began = known.length ? new Date(Math.min(...known.map((d) => new Date(d).getTime()))) : p.createdAt;
    const reason = holdReason({ lastAny: last.get(p._id), lastDm: lastDm.get(p._id), hasDmMember: dmMembers.has(p._id), began, cutoff, dmCutoff });
    if (p.status === "ACTIVE") {
      if (!reason) continue;
      out.reasons[p.name] = reason;
      if (!opts.dryRun)
        await ServiceProject.updateOne(
          { _id: p._id, status: "ACTIVE" },
          { $set: { status: "ON_HOLD" }, $push: { history: { fromStatus: "ACTIVE", toStatus: "ON_HOLD", reason, at: now } } }
        );
      out.held.push(p.name);
    } else if (latest?.reason === HOLD_UNTIL_TEAM_REASON) {
      // Held by the owner "until my team reports": resumes on the first team report dated after the day it was held.
      const dm = lastDm.get(p._id);
      if (dm && istDay(dm) > istDay(new Date(latest.at))) {
        if (!opts.dryRun)
          await ServiceProject.updateOne(
            { _id: p._id, status: "ON_HOLD" },
            { $set: { status: "ACTIVE" }, $push: { history: { fromStatus: "ON_HOLD", toStatus: "ACTIVE", reason: AUTO_RESUME_REASON, at: now } } }
          );
        out.resumed.push(p.name);
      }
    } else if (!reason && isAutoHold(latest?.reason)) {
      if (!opts.dryRun)
        await ServiceProject.updateOne(
          { _id: p._id, status: "ON_HOLD" },
          { $set: { status: "ACTIVE" }, $push: { history: { fromStatus: "ON_HOLD", toStatus: "ACTIVE", reason: AUTO_RESUME_REASON, at: now } } }
        );
      out.resumed.push(p.name);
    }
  }

  // Completed projects that have Digital Marketing team hours dated after the day they were completed (`lastDm`: hours attributed to the project by team members).
  const today = new Date(`${istDay(now)}T00:00:00Z`);
  const completed = await ServiceProject.find({ status: "COMPLETED" })
    .select("name history")
    .lean<Array<{ _id: string; name: string; history: Array<{ toStatus: string; at: Date }> }>>();
  for (const p of completed) {
    if (REOPEN_EXEMPT.has(p.name)) continue;
    const done = p.history.filter((h) => h.toStatus === "COMPLETED").sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
    if (!shouldReopen({ completedOn: done ? new Date(done.at) : null, lastAny: lastDm.get(p._id), today })) continue;
    out.reasons[p.name] = AUTO_REOPEN_REASON;
    if (!opts.dryRun)
      await ServiceProject.updateOne(
        { _id: p._id, status: "COMPLETED" },
        { $set: { status: "ACTIVE" }, $push: { history: { fromStatus: "COMPLETED", toStatus: "ACTIVE", reason: AUTO_REOPEN_REASON, at: now } } }
      );
    out.reopened.push(p.name);
  }
  return out;
}
