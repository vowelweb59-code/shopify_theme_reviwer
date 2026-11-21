import "server-only";
import { randomUUID } from "node:crypto";
import { baMatch } from "../ba-members";
import { bdMatch } from "../bd-members";
import { dmMatch } from "../dm-members";
import { runFollowUps } from "../import/persist";
import { rematchClients } from "../import/rematch";
import { suggestClientName } from "../import/client-field";
import { parseNewProjectPost, type NewProjectPost } from "../import/new-project-post";
import { recordServiceAudit } from "../audit/record";
import { listServiceMessages } from "./google";
import { serviceRefreshToken } from "./sync";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkProfile } from "@/models/service-upwork";

// Reads the Chat space "New Project Update" (owner, 2026-11-16) and acts on its two kinds of post: "Accepted the project of ..."
// creates the client (if new) and an Active hourly project, unless the client already has an open one; "Contract ended of ..." completes the client's one open project with
// its star rating. Idempotent: a created project remembers its message in `contractRef`. Posts it can't read cleanly, or an ended
// contract that doesn't point at exactly one open project, are returned in `skipped` and left for a person.
export const NEW_PROJECT_SPACE = process.env.SERVICE_NEW_PROJECT_SPACE?.trim() || "spaces/AAAAVIeFrm4";
const LOOKBACK_DAYS = 60;
const OPEN = ["NOT_STARTED", "ACTIVE", "BLOCKED", "WAITING_FOR_CLIENT", "ON_HOLD", "PARTIAL_HOLD"];
const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** An "Accepted the project of ..." post with the Chat message it came from (`ref` is what a created project remembers in `contractRef`). */
export interface AcceptedPost {
  post: Extract<NewProjectPost, { kind: "accepted" }>;
  ref: string;
  posted: Date;
}

/** The accepted-project posts of the last `lookbackDays` days, read live from the New Project Update space. */
export async function loadAcceptedPosts(now: Date, lookbackDays: number): Promise<AcceptedPost[]> {
  const msgs = await listServiceMessages(await serviceRefreshToken(), NEW_PROJECT_SPACE, {
    from: new Date(now.getTime() - lookbackDays * 86_400_000),
    to: new Date(now.getTime() + 60_000),
  });
  const out: AcceptedPost[] = [];
  for (const m of msgs) {
    const posted = new Date(m.postedAt);
    const post = parseNewProjectPost(m.text, posted);
    if (post?.kind === "accepted") out.push({ post, ref: `chat:${m.externalId}`, posted });
  }
  return out;
}

export interface NewProjectResult {
  created: string[];
  completed: string[];
  skipped: Array<{ text: string; why: string }>;
}

export async function syncNewProjects(opts: { dryRun?: boolean; now?: Date } = {}): Promise<NewProjectResult> {
  const now = opts.now ?? new Date();
  const out: NewProjectResult = { created: [], completed: [], skipped: [] };
  const msgs = await listServiceMessages(await serviceRefreshToken(), NEW_PROJECT_SPACE, {
    from: new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000),
    to: new Date(now.getTime() + 60_000),
  });
  const clients = await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const byName = new Map<string, string>();
  // The live site is Digital Marketing only and a post names only the BD and BA, so a post counts only when its client is one we
  // already have, or a Digital Marketing person has reported hours for that name (entries are filtered to the team on import).
  // Only the team's own reports count (owner, 2026-11-17: Thani Almheiri was made because a person outside the team had reported hours
  // for that name).
  const dmSenders = (await ServiceChatSender.find().select("externalId displayName").lean<Array<{ externalId: string; displayName: string }>>())
    .filter((x) => dmMatch(x.displayName) !== null)
    .map((x) => x.externalId);
  const reported = new Set(
    ((await ServiceTimeEntry.distinct("clientRaw", { clientRaw: { $ne: null }, senderExternalId: { $in: dmSenders } })) as string[]).map((r) =>
      key(suggestClientName(r) ?? r.split("|")[0])
    ) // "DM | Client | Profile": the tag is not the client
  );
  for (const c of clients) for (const n of [c.name, ...c.aliases]) byName.set(key(n), c._id);
  const profiles = await ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const profileByName = new Map<string, string>();
  for (const p of profiles) for (const n of [p.name, ...p.aliases]) profileByName.set(key(n), p._id);

  const known = new Set(byName.keys());
  for (const m of msgs) {
    const posted = new Date(m.postedAt);
    const post = parseNewProjectPost(m.text, posted);
    if (!post) {
      out.skipped.push({ text: m.text.slice(0, 120), why: "not a project post" });
      continue;
    }
    const ref = `chat:${m.externalId}`;
    let clientId = byName.get(key(post.client)) ?? null;

    if (post.kind === "accepted") {
      if (await ServiceProject.exists({ contractRef: ref })) continue;
      if (!known.has(key(post.client)) && !reported.has(key(post.client))) {
        out.skipped.push({ text: m.text.slice(0, 120), why: "not a Digital Marketing client (no team hours reported for it)" });
        continue;
      }
      // A client who already has an open project is not given a second one (owner, 2026-11-16: Pramesh Baskota showed twice).
      const open = clientId
        ? await ServiceProject.findOne({ clientId, status: { $in: OPEN } })
            .select("name")
            .lean<{ name: string } | null>()
        : null;
      if (open) {
        out.skipped.push({ text: m.text.slice(0, 120), why: `client already has an open project (${open.name})` });
        continue;
      }
      if (!opts.dryRun) {
        if (!clientId) {
          clientId = randomUUID();
          await ServiceClient.create({ _id: clientId, name: post.client });
          byName.set(key(post.client), clientId);
        }
        const people = [
          ...(bdMatch(post.businessDeveloper) ? [{ role: "BUSINESS_DEVELOPER", name: bdMatch(post.businessDeveloper)!.name }] : []),
          ...(baMatch(post.businessAnalyst) ? [{ role: "BUSINESS_ANALYST", name: baMatch(post.businessAnalyst)!.name }] : []),
        ];
        await ServiceProject.create({
          _id: randomUUID(),
          name: post.client,
          clientId,
          contractRef: ref,
          status: "ACTIVE",
          startDate: post.startDate ?? posted,
          upworkProfileId: (post.profile && profileByName.get(key(post.profile))) || null,
          people,
          history: [{ fromStatus: null, toStatus: "ACTIVE", reason: "Created from New Project Update", at: now }],
          contract: { type: "HOURLY", hourlyRateCents: post.hourlyRateCents, trackingMode: "TIMER", startDate: post.startDate ?? posted },
        });
      }
      out.created.push(post.client);
    } else {
      const projects = clientId
        ? await ServiceProject.find({ clientId, status: { $in: OPEN } })
            .select("name")
            .lean<Array<{ _id: string; name: string }>>()
        : [];
      if (projects.length !== 1) {
        if (!clientId || !(await ServiceProject.exists({ clientId, status: "COMPLETED" })))
          out.skipped.push({ text: m.text.slice(0, 120), why: clientId ? `${projects.length} open projects` : "client not found" });
        continue;
      }
      if (!opts.dryRun) {
        await ServiceProject.updateOne(
          { _id: projects[0]._id },
          {
            $set: { status: "COMPLETED", reviewRating: post.rating, reviewedAt: posted },
            $push: { history: { toStatus: "COMPLETED", reason: "Contract ended (New Project Update)", at: now } },
          }
        );
      }
      out.completed.push(projects[0].name);
    }
  }
  if (!opts.dryRun && out.created.length + out.completed.length) {
    await rematchClients();
    await runFollowUps();
    await recordServiceAudit("chat.new_projects", { created: out.created, completed: out.completed }).catch(() => undefined);
  }
  return out;
}
