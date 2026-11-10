import { connectToDatabase } from "@/lib/db/connect";
import { persistPlan, runFollowUps } from "@/lib/service/import/persist";
import { planImport, type SpaceInput } from "@/lib/service/import/plan";
import { loadClientRegistry } from "@/lib/service/import/rematch";
import { istMonthWindow } from "@/lib/service/chat/months";
import { ServiceChatMessage, ServiceChatSpace } from "@/models/service-chat";
import { ServiceTimeEntry } from "@/models/service-time-entry";

// Re-reads the TIMER STATUS messages already stored (no Google call) through the current parser and rules, month by month,
// the same way a Chat sync does. Use after a parser or rule change. Entries a person decided are kept. Prints totals before
// and after. A dry run unless --apply. Optional: --from=YYYY-MM to start at a month.
//   npx tsx --env-file=.env.local scripts/service-reread-stored.ts [--apply] [--from=2026-01]
const apply = process.argv.includes("--apply");
const from = process.argv.find((a) => a.startsWith("--from="))?.slice(7) ?? "0000-00";

async function totals() {
  const rows = await ServiceTimeEntry.aggregate<{ _id: string; n: number; minutes: number }>([{ $group: { _id: "$state", n: { $sum: 1 }, minutes: { $sum: "$minutes" } } }, { $sort: { _id: 1 } }]);
  const placed = await ServiceTimeEntry.countDocuments({ projectId: { $ne: null } });
  return { byState: Object.fromEntries(rows.map((r) => [r._id, `${r.n} entries / ${(r.minutes / 60).toFixed(1)} h`])), placedOnProject: placed };
}

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const space = await ServiceChatSpace.findOne({ type: "TIMER_STATUS" }).lean<{ _id: string; externalId: string; name: string } | null>();
  if (!space) throw new Error("No TIMER STATUS space stored yet.");
  const months = (await ServiceChatMessage.aggregate<{ _id: string }>([
    { $match: { spaceId: space._id } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$postedAt", timezone: "+05:30" } } } },
    { $sort: { _id: 1 } },
  ])).map((m) => m._id).filter((m) => m >= from);
  console.log("Before:", await totals());
  const clients = await loadClientRegistry();
  for (const month of months) {
    const { from: start, to } = istMonthWindow(month);
    const stored = await ServiceChatMessage.find({ spaceId: space._id, postedAt: { $gte: start, $lt: to } }).sort({ postedAt: 1 }).lean<Array<{ externalId: string; senderExternalId: string; senderName: string; postedAt: Date; text: string }>>();
    const spaces: SpaceInput[] = [{ externalId: space.externalId, name: space.name, type: "TIMER_STATUS", messages: stored.map((m) => ({ externalId: m.externalId, senderExternalId: m.senderExternalId, senderName: m.senderName, postedAt: m.postedAt.toISOString(), text: m.text })) }];
    const plan = planImport({ month, spaces, clients });
    if (!apply) {
      console.log(`  ${month}: ${stored.length} messages -> ${plan.entries.length} planned entries`);
      continue;
    }
    const r = await persistPlan(plan, spaces, { followUps: false });
    console.log(`  ${month}: ${stored.length} messages, created ${r.entriesCreated}, kept as reviewed ${r.entriesKeptAsReviewed}, removed ${r.entriesRemoved}`);
  }
  if (apply) {
    await runFollowUps();
    console.log("After:", await totals());
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
