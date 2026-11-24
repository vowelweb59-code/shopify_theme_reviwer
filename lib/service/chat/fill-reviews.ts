import "server-only";
import { recordServiceAudit } from "../audit/record";
import { planClosures } from "../import/ended-posts";
import { readNewProjectPosts } from "./close-held";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";

// Closed projects with no closing review (owner, 2026-11-24: "the closed projects with no reviews: check New Project Update for the
// reviews"). Chat can only be read on the live server, so this runs inside the app: a preview first, then `apply` writes the rating of the
// listed projects only (re-checked then, and only where the project still has no review). The same matching as the held-project check:
// client name or alias, Upwork profile, a client with several projects needs a post that names the profile.
export interface FillReviewsResult {
  closedWithoutReview: number;
  postsRead: number;
  fill: Array<{ projectId: string; name: string; rating: number; endedOn: Date }>;
  /** An ended post exists but states no star rating. */
  noRating: string[];
  skipped: Array<{ name: string; why: string }>;
  noPost: string[];
  applied: string[];
}

export async function fillReviewsFromPosts(opts: { apply?: boolean; ids?: string[] } = {}): Promise<FillReviewsResult> {
  const { ended, accepted, postsRead } = await readNewProjectPosts();
  const closed = await ServiceProject.find({ status: { $in: ["COMPLETED", "CANCELLED", "ARCHIVED"] }, reviewRating: null })
    .select("name clientId upworkProfileId")
    .lean<Array<{ _id: string; name: string; clientId: string | null; upworkProfileId: string | null }>>();
  const all = await ServiceProject.find({ clientId: { $ne: null } })
    .select("clientId")
    .lean<Array<{ clientId: string }>>();
  const perClient = new Map<string, number>();
  for (const o of all) perClient.set(o.clientId, (perClient.get(o.clientId) ?? 0) + 1);
  const clients = await ServiceClient.find({ _id: { $in: closed.map((p) => p.clientId).filter((x): x is string => !!x) } })
    .select("name aliases")
    .lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const clientNames = new Map(clients.map((c) => [c._id, [c.name, ...(c.aliases ?? [])]]));

  const plan = planClosures(
    closed.map((p) => ({
      id: p._id,
      name: p.name,
      clientNames: p.clientId ? (clientNames.get(p.clientId) ?? []) : [],
      profileId: p.upworkProfileId,
      // Other projects of the same client, whatever their status: a post naming no profile cannot choose between them.
      siblings: p.clientId ? Math.max(0, (perClient.get(p.clientId) ?? 1) - 1) : 0,
    })),
    ended,
    accepted
  );
  const fill = plan.close
    .filter((c) => c.rating != null)
    .map((c) => ({ projectId: c.projectId, name: c.name, rating: c.rating as number, endedOn: c.endedOn }));
  const result: FillReviewsResult = {
    closedWithoutReview: closed.length,
    postsRead,
    fill,
    noRating: plan.close.filter((c) => c.rating == null).map((c) => c.name),
    skipped: plan.skipped,
    noPost: plan.noPost,
    applied: [],
  };
  if (!opts.apply) return result;

  const wanted = new Set(opts.ids ?? []);
  for (const f of fill) {
    if (!wanted.has(f.projectId)) continue;
    const r = await ServiceProject.updateOne({ _id: f.projectId, reviewRating: null }, { $set: { reviewRating: f.rating, reviewedAt: f.endedOn } });
    if (r.modifiedCount) result.applied.push(f.name);
  }
  if (result.applied.length) await recordServiceAudit("projects.fill_reviews_from_posts", { filled: result.applied });
  return result;
}
