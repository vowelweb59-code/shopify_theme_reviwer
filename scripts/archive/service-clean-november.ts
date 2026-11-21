import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { istMonth, istMonthWindow } from "@/lib/service/chat/months";
import { dmMatch } from "@/lib/service/dm-members";
import { filterPlanToDigitalMarketing } from "@/lib/service/import/dm-filter";
import { loadDmProjects } from "@/lib/service/import/dm-projects";
import { humanDecided, runFollowUps } from "@/lib/service/import/persist";
import { planImport, type SpaceInput } from "@/lib/service/import/plan";
import { loadClientRegistry } from "@/lib/service/import/rematch";
import { ServiceChatMessage, ServiceChatSpace } from "@/models/service-chat";
import { ServiceTimeEntry } from "@/models/service-time-entry";

// Clean-up after the live Chat sync imported EVERYONE's hours (2026-11-16, before it was limited to the Digital Marketing team):
// applies the same rule as the sync now does (lib/service/import/dm-filter.ts) to the messages the live sync stored AFTER the
// migration, and removes what the rule would not have imported:
//   - entries (and their Chat messages) of people outside the team that are not tied to one of the team's projects;
//   - the projectId is written on the outsider entries that stay, so they never fall to another project of the same client.
// Entries a person approved or rejected are never removed. Messages posted up to the migration's last message are never touched (the
// migration already filtered those, and kept outsiders' hours on team projects on purpose).
//
// A dry run unless --apply (the owner runs it; it writes to the live database):
//   npx tsx --env-file=.env.production.local scripts/service-clean-november.ts [--apply] [--since=2026-11-02T11:48:00Z] [--month=2026-11]
// The old app's last message was 2026-11-02T11:47:55Z, so the default --since is just after it. --month can be repeated.
const apply = process.argv.includes("--apply");
const since = new Date(process.argv.find((a) => a.startsWith("--since="))?.slice(8) ?? "2026-11-02T11:48:00Z");
const monthsArg = process.argv.filter((a) => a.startsWith("--month=")).map((a) => a.slice(8));
if (Number.isNaN(+since)) throw new Error("--since is not a date.");

type Msg = { _id: string; externalId: string; senderExternalId: string; senderName: string; postedAt: Date; text: string };
type Stored = {
  _id: string;
  sourceMessageId: string;
  startMessageId: string | null;
  source: string;
  ordinal: number;
  state: string;
  notes: string[];
  projectId: string | null;
  minutes: number;
  senderExternalId: string;
};

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}`);
  console.log(`Only messages posted after ${since.toISOString()} are considered.\n`);
  const space = await ServiceChatSpace.findOne({ type: "TIMER_STATUS" }).lean<{ _id: string; externalId: string; name: string } | null>();
  if (!space) throw new Error("No TIMER STATUS space stored yet.");

  // Months from --since to now (IST), unless given.
  const months = monthsArg.length ? monthsArg : [];
  if (!months.length) {
    for (let back = 5; back >= 0; back--) {
      const m = istMonth(new Date(), back);
      if (istMonthWindow(m).to > since) months.push(m);
    }
  }

  const clients = await loadClientRegistry();
  const dmProjects = await loadDmProjects();
  const removeEntries: Stored[] = [];
  const setProject: Array<{ id: string; projectId: string }> = [];
  const candidateMessages: string[] = [];
  const bySender = new Map<string, { entries: number; minutes: number }>();

  for (const month of months) {
    const { from, to } = istMonthWindow(month);
    const stored = await ServiceChatMessage.find({ spaceId: space._id, postedAt: { $gte: from, $lt: to } })
      .sort({ postedAt: 1 })
      .lean<Msg[]>();
    const spaces: SpaceInput[] = [
      {
        externalId: space.externalId,
        name: space.name,
        type: "TIMER_STATUS",
        messages: stored.map((m) => ({
          externalId: m.externalId,
          senderExternalId: m.senderExternalId,
          senderName: m.senderName,
          postedAt: m.postedAt.toISOString(),
          text: m.text,
        })),
      },
    ];
    const kept = filterPlanToDigitalMarketing(planImport({ month, spaces, clients }), dmProjects);
    const keptKey = new Map(kept.entries.map((e) => [`${e.messageExternalId}|${e.source}|${e.ordinal}`, e]));
    const byId = new Map(stored.map((m) => [m._id, m]));
    const fresh = stored.filter((m) => m.postedAt > since);

    const entries = await ServiceTimeEntry.find({ sourceMessageId: { $in: fresh.map((m) => m._id) } })
      .select("sourceMessageId startMessageId source ordinal state notes projectId minutes senderExternalId")
      .lean<Stored[]>();
    for (const e of entries) {
      if (humanDecided(e)) continue;
      const msg = byId.get(e.sourceMessageId)!;
      const planned = keptKey.get(`${msg.externalId}|${e.source}|${e.ordinal}`);
      if (planned) {
        if (planned.projectId && !e.projectId) setProject.push({ id: e._id, projectId: planned.projectId });
      } else {
        removeEntries.push(e);
        const who = msg.senderName;
        const s = bySender.get(who) ?? { entries: 0, minutes: 0 };
        s.entries++;
        s.minutes += e.minutes;
        bySender.set(who, s);
      }
    }
    for (const m of fresh) if (dmMatch(m.senderName) === null) candidateMessages.push(m._id);
    console.log(`  ${month}: ${stored.length} messages stored, ${fresh.length} after the cut`);
  }

  const totalMinutes = removeEntries.reduce((n, e) => n + e.minutes, 0);
  console.log(`\nEntries to remove: ${removeEntries.length} (${(totalMinutes / 60).toFixed(1)} h), people outside the team not tied to a team project.`);
  for (const [who, s] of [...bySender].sort((a, b) => b[1].entries - a[1].entries).slice(0, 15))
    console.log(`  ${who.padEnd(28)} ${String(s.entries).padStart(5)} entries  ${(s.minutes / 60).toFixed(1).padStart(8)} h`);
  if (bySender.size > 15) console.log(`  ... and ${bySender.size - 15} more people`);
  console.log(`Entries kept that get their project written: ${setProject.length}`);
  console.log(`Chat messages from people outside the team after the cut (removed unless an entry still needs them): ${candidateMessages.length}`);

  if (!apply) {
    console.log("\nDry run: nothing written. Run again with --apply to do it.");
    return;
  }

  const ids = removeEntries.map((e) => e._id);
  for (let i = 0; i < ids.length; i += 1000) await ServiceTimeEntry.deleteMany({ _id: { $in: ids.slice(i, i + 1000) } });
  for (const s of setProject) await ServiceTimeEntry.updateOne({ _id: s.id, projectId: null }, { $set: { projectId: s.projectId, allocations: [] } });

  let removedMessages = 0;
  for (let i = 0; i < candidateMessages.length; i += 1000) {
    const chunk = candidateMessages.slice(i, i + 1000);
    const used = new Set<string>([
      ...(await ServiceTimeEntry.distinct("sourceMessageId", { sourceMessageId: { $in: chunk } })),
      ...(await ServiceTimeEntry.distinct("startMessageId", { startMessageId: { $in: chunk } })),
    ]);
    const free = chunk.filter((id) => !used.has(id));
    if (free.length) removedMessages += (await ServiceChatMessage.deleteMany({ _id: { $in: free } })).deletedCount ?? 0;
  }
  await runFollowUps();
  await recordServiceAudit("chat.clean_november", {
    since: since.toISOString(),
    entriesRemoved: ids.length,
    minutesRemoved: totalMinutes,
    projectsSet: setProject.length,
    messagesRemoved: removedMessages,
  });
  console.log(`\nDone: removed ${ids.length} entries and ${removedMessages} messages, wrote the project on ${setProject.length} entries.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
