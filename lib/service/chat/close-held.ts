import "server-only";
import { recordServiceAudit } from "../audit/record";
import { planClosures, nameKey, type ClosurePlan } from "../import/ended-posts";
import { parseNewProjectPost } from "../import/new-project-post";
import { dateForManualMove } from "../projects/manual-date";
import { runFollowUps } from "../import/persist";
import { listServiceMessages } from "./google";
import { NEW_PROJECT_SPACE } from "./new-projects";
import { serviceRefreshToken } from "./sync";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceUpworkProfile } from "@/models/service-upwork";

// One-off check, started by the owner from the On hold view (2026-11-20): reads the whole New Project Update history, finds the held
// projects whose contract was announced as ended, and (when confirmed) completes them. Chat can only be read from the live server, so
// this runs inside the app, as a preview first; `apply` completes only the projects whose ids it is given, re-checked at that moment.
export interface CloseHeldResult extends ClosurePlan {
  heldCount: number;
  postsRead: number;
  applied: string[];
}

const SINCE = new Date("2022-01-01T00:00:00Z");

/** Reads the whole New Project Update space and returns its "Contract ended" and "Accepted" posts, profiles resolved to our Upwork profile ids. */
export async function readNewProjectPosts(now = new Date()) {
  const msgs = await listServiceMessages(await serviceRefreshToken(), NEW_PROJECT_SPACE, { from: SINCE, to: new Date(now.getTime() + 60_000) });
  const profiles = await ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const profileByName = new Map<string, string>();
  for (const p of profiles) for (const n of [p.name, ...(p.aliases ?? [])]) profileByName.set(nameKey(n), p._id);
  const profileOf = (t: string | null) => (t ? (profileByName.get(nameKey(t)) ?? null) : null);

  const ended: Parameters<typeof planClosures>[1] = [];
  const accepted: Parameters<typeof planClosures>[2] = [];
  for (const m of msgs) {
    const posted = new Date(m.postedAt);
    const post = parseNewProjectPost(m.text, posted);
    if (post?.kind === "ended")
      ended.push({
        client: post.client,
        rating: post.rating,
        profileId: profileOf(post.profile),
        profileText: post.profile,
        posted,
        ref: `chat:${m.externalId}`,
      });
    else if (post?.kind === "accepted") accepted.push({ client: post.client, profileId: profileOf(post.profile), posted });
  }
  return { ended, accepted, postsRead: msgs.length };
}

export async function closeHeldFromEndedPosts(opts: { apply?: boolean; ids?: string[] } = {}): Promise<CloseHeldResult> {
  const now = new Date();
  const { ended, accepted, postsRead } = await readNewProjectPosts(now);

  const heldRows = await ServiceProject.find({ status: "ON_HOLD" })
    .select("name clientId upworkProfileId history reviewRating")
    .lean<
      Array<{ _id: string; name: string; clientId: string | null; upworkProfileId: string | null; history: Array<{ at: Date }>; reviewRating: number | null }>
    >();
  const open = await ServiceProject.find({
    status: { $in: ["NOT_STARTED", "ACTIVE", "BLOCKED", "WAITING_FOR_CLIENT", "ON_HOLD", "PARTIAL_HOLD"] },
    clientId: { $ne: null },
  })
    .select("clientId")
    .lean<Array<{ clientId: string }>>();
  const perClient = new Map<string, number>();
  for (const o of open) perClient.set(o.clientId, (perClient.get(o.clientId) ?? 0) + 1);
  const clients = await ServiceClient.find({ _id: { $in: heldRows.map((p) => p.clientId).filter((x): x is string => !!x) } })
    .select("name aliases")
    .lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const clientNames = new Map(clients.map((c) => [c._id, [c.name, ...(c.aliases ?? [])]]));

  const plan = planClosures(
    heldRows.map((p) => ({
      id: p._id,
      name: p.name,
      clientNames: p.clientId ? (clientNames.get(p.clientId) ?? []) : [],
      profileId: p.upworkProfileId,
      siblings: p.clientId ? Math.max(0, (perClient.get(p.clientId) ?? 1) - 1) : 0,
    })),
    ended,
    accepted
  );
  const result: CloseHeldResult = { ...plan, heldCount: heldRows.length, postsRead, applied: [] };
  if (!opts.apply) return result;

  const wanted = new Set(opts.ids ?? []);
  const byId = new Map(heldRows.map((p) => [p._id, p]));
  for (const c of plan.close) {
    if (!wanted.has(c.projectId)) continue;
    const p = byId.get(c.projectId)!;
    // Dated the project's last report, as every manual Completed (owner, 2026-11-20).
    const at = await dateForManualMove("COMPLETED", { _id: p._id, clientId: p.clientId, history: p.history }, now);
    const r = await ServiceProject.updateOne(
      { _id: c.projectId, status: "ON_HOLD" },
      {
        $set: { status: "COMPLETED", ...(p.reviewRating == null && c.rating != null ? { reviewRating: c.rating, reviewedAt: c.endedOn } : {}) },
        $push: {
          history: {
            fromStatus: "ON_HOLD",
            toStatus: "COMPLETED",
            reason: `Contract ended (New Project Update post of ${c.endedOn.toISOString().slice(0, 10)})`,
            at,
          },
        },
      }
    );
    if (r.modifiedCount) result.applied.push(c.name);
  }
  if (result.applied.length) {
    await runFollowUps();
    await recordServiceAudit("projects.close_held_from_posts", { completed: result.applied });
  }
  return result;
}
