import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { runFollowUps } from "@/lib/service/import/persist";
import { rematchClients } from "@/lib/service/import/rematch";
import { normalizeName } from "@/lib/service/import/text";
import { ServiceClient } from "@/models/service-client";
import { ServiceTimeEntry } from "@/models/service-time-entry";

// Adds a spelling to an existing client so hours written that way attach to it (first case, 2026-11-18, owner: "Carlosworld" is the client
// "Carol XO Carolsworld": 3 entries, 15.3 h waiting in Review with no client). The importer matches a client name or alias written whole
// inside the client field, so use a distinctive alias, never a common word. Then it re-matches the waiting entries and runs the follow-ups
// (project placement). Audit `client.add_alias`. Dry run unless --apply (the owner runs it):
//   npx tsx --env-file=.env.production.local scripts/add-client-alias.ts "<Client name>" --alias "<spelling>" [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const alias = argv.includes("--alias") ? argv[argv.indexOf("--alias") + 1] : undefined;
const name = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--")));

async function main() {
  if (!name || !alias) throw new Error('Usage: add-client-alias.ts "<Client name>" --alias "<spelling>" [--apply]');
  await connectToDatabase();
  const clients = await ServiceClient.find({ name }).select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  if (clients.length !== 1) throw new Error(`${clients.length} clients are named "${name}"; need exactly one.`);
  const c = clients[0]!;
  const clash = await ServiceClient.find({ _id: { $ne: c._id }, $or: [{ name: alias }, { aliases: alias }] })
    .select("name")
    .lean<Array<{ name: string }>>();
  if (clash.length) throw new Error(`"${alias}" is already a name or alias of ${clash.map((x) => x.name).join(", ")}.`);
  const key = ` ${normalizeName(alias)} `;
  const waiting = (
    await ServiceTimeEntry.find({ clientId: null, clientRaw: { $ne: null }, state: { $in: ["NEEDS_REVIEW", "PARSED"] } })
      .select("clientRaw minutes")
      .lean<Array<{ clientRaw: string; minutes: number }>>()
  ).filter((e) => ` ${normalizeName(e.clientRaw)} `.includes(key));
  console.log(`${apply ? "APPLYING" : "Dry run"}: add alias "${alias}" to client "${c.name}" (aliases now: ${c.aliases.join(", ") || "none"}).`);
  console.log(`  Waiting entries written that way: ${waiting.length} (${(waiting.reduce((n, e) => n + e.minutes, 0) / 60).toFixed(1)} h)`);
  if (!apply) return console.log("Nothing written. Add --apply to save it.");
  await ServiceClient.updateOne({ _id: c._id }, { $addToSet: { aliases: alias } });
  await recordServiceAudit("client.add_alias", { client: c.name, alias, via: "scripts/add-client-alias.ts" });
  const moved = await rematchClients();
  await runFollowUps();
  console.log(`Done: ${moved} entries re-matched to clients.`);
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
