// Re-reads the client field of entries that have no client yet, after the client list or its aliases changed.
import { clientRegistry } from "./client-registry";
import { extractClient, findClientByFirstWord, findClientInText } from "./client-field";
import { ServiceClient } from "@/models/service-client";
import { ServiceTimeEntry } from "@/models/service-time-entry";

const DROPPED = new Set(["UNKNOWN_CLIENT", "AMBIGUOUS_CLIENT"]);

export async function loadClientRegistry() {
  const rows = await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  return clientRegistry(rows.map((c) => ({ id: c._id, name: c.name, aliases: c.aliases })));
}

/** Returns how many entries gained a client. Entries a person already settled are never touched. */
export async function rematchClients(): Promise<number> {
  const known = await loadClientRegistry();
  const loose = await ServiceTimeEntry.find({ clientId: null, clientRaw: { $ne: null }, state: { $in: ["NEEDS_REVIEW", "PARSED"] } })
    .select("clientRaw profile flags")
    .lean<Array<{ _id: string; clientRaw: string; profile: string | null; flags: string[] }>>();
  let fixed = 0;
  for (const e of loose) {
    let m = extractClient(e.clientRaw, known).match;
    if (m.status === "UNKNOWN") {
      // the client may be named elsewhere in the line ("R | Yitzy Lazar | Adnan" reads as client "R")
      const found = findClientInText(`${e.clientRaw} ${e.profile ?? ""}`, known) ?? findClientByFirstWord(e.clientRaw, known);
      if (found) m = { status: "EXACT", client: found };
    }
    if (m.status !== "EXACT" && m.status !== "CORRECTED") continue;
    const flags = e.flags.filter((f) => !DROPPED.has(f));
    await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: { clientId: m.client.id, flags, state: flags.length ? "NEEDS_REVIEW" : "PARSED" } });
    fixed++;
  }
  return fixed;
}
