// Loads the projects on this site (after the 2026-11-16 migration, the Digital Marketing team's) with what ties an entry to each, for
// filterPlanToDigitalMarketing. Used by the Chat sync and the November clean-up script.
import type { DmProject } from "./dm-filter";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceUser } from "@/models/service-user";

export async function loadDmProjects(): Promise<DmProject[]> {
  const [projects, clients, users, senders] = await Promise.all([
    ServiceProject.find({ clientId: { $ne: null } })
      .select("clientId chatKeywords people assignments")
      .lean<
        Array<{
          _id: string;
          clientId: string;
          chatKeywords: string[];
          people: Array<{ name: string; senderId: string | null }>;
          assignments: Array<{ userId: string }>;
        }>
      >(),
    ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>(),
    ServiceUser.find().select("displayName").lean<Array<{ _id: string; displayName: string }>>(),
    ServiceChatSender.find().select("displayName userId").lean<Array<{ _id: string; displayName: string; userId: string | null }>>(),
  ]);
  const clientNames = new Map(clients.map((c) => [c._id, [c.name, ...c.aliases]]));
  const userName = new Map(users.map((u) => [u._id, u.displayName]));
  const senderName = new Map(senders.map((s) => [s._id, s.displayName]));
  const sendersOfUser = new Map<string, string[]>();
  for (const s of senders) if (s.userId) sendersOfUser.set(s.userId, [...(sendersOfUser.get(s.userId) ?? []), s.displayName]);
  return projects.map((p) => ({
    id: p._id,
    clientId: p.clientId,
    clientNames: clientNames.get(p.clientId) ?? [],
    keywords: p.chatKeywords,
    teamNames: [
      ...p.people.flatMap((x) => [x.name, x.senderId ? senderName.get(x.senderId) : undefined]),
      ...p.assignments.flatMap((a) => [userName.get(a.userId), ...(sendersOfUser.get(a.userId) ?? [])]),
    ].filter((n): n is string => !!n),
  }));
}
