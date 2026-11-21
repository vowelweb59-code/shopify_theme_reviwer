import "server-only";
import { randomUUID } from "node:crypto";
import { baMatch } from "../ba-members";
import { bdMatch } from "../bd-members";
import { dmMatch } from "../dm-members";
import { recordServiceAudit } from "../audit/record";
import { suggestClientName } from "../import/client-field";
import { runFollowUps } from "../import/persist";
import { matchProfile } from "../import/profile-match";
import { rematchClients } from "../import/rematch";
import { looksLikeClientName, nearExisting, samePostClient } from "../import/auto-project-rules";
import { normalizeName } from "../import/text";
import { loadAcceptedPosts, type AcceptedPost } from "./new-projects";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkProfile } from "@/models/service-upwork";

// A Digital Marketing person reports hours for a client the app has never heard of (owner, 2026-11-19: "Client: DM | Ledty LavishCo |
// Batul" sat in Review as an unknown client and counted nowhere): the app creates the client and its project itself, and fills every
// field it can from BOTH Chat spaces. TIMER STATUS gives the client, the Upwork profile, the first report date and who reports; the
// New Project Update post ("Accepted the project of <client> - <profile> - $<rate> hr - <BD> | <BA> | <start date>") gives the hourly
// rate, BD, BA, start date and the profile when the report did not name one. The follow-ups then add the reporters as the project's team
// and apply the activity rules. A post that arrives later fills what the project is still missing (`enrichAutoCreated`).
//
// Guards, so it never makes junk: only the team's own reports; the report must name a KNOWN Upwork profile (a real Upwork client is
// written "Client | Profile"); reports from the last 45 days only (new clients appear in current reports, old unmatched names stay for a
// person); a name that reads like a task or a label is skipped; a name that is a first name or an abbreviation of an existing client
// (e.g. "Tim" for "Tim Fitz") is skipped and listed, never made a second client.
const RECENT_DAYS = 45;
const POST_LOOKBACK_DAYS = 150;
const key = normalizeName;

export interface AutoCreateResult {
  created: Array<{ name: string; profile: string; hours: number; fromPost: boolean }>;
  skipped: Array<{ name: string; why: string }>;
  enriched: string[];
}

export async function autoCreateProjects(opts: { dryRun?: boolean; now?: Date; posts?: AcceptedPost[] } = {}): Promise<AutoCreateResult> {
  const now = opts.now ?? new Date();
  const out: AutoCreateResult = { created: [], skipped: [], enriched: [] };
  const dmSenders = (await ServiceChatSender.find().select("externalId displayName").lean<Array<{ externalId: string; displayName: string }>>())
    .filter((x) => dmMatch(x.displayName) !== null)
    .map((x) => x.externalId);
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const loose = await ServiceTimeEntry.find({
    clientId: null,
    clientRaw: { $ne: null },
    state: { $in: ["NEEDS_REVIEW", "PARSED"] },
    minutes: { $gt: 0 },
    senderExternalId: { $in: dmSenders },
    entryDate: { $gte: since },
  })
    .select("clientRaw profile profileId minutes entryDate")
    .lean<Array<{ clientRaw: string; profile: string | null; profileId: string | null; minutes: number; entryDate: Date }>>();

  const profiles = (await ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>()).map((p) => ({
    id: p._id,
    name: p.name,
    aliases: p.aliases ?? [],
  }));
  const profileName = new Map(profiles.map((p) => [p.id, p.name]));
  const clients = await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const existingNames = clients.flatMap((c) => [c.name, ...(c.aliases ?? [])]);

  // Group the waiting reports by written client name.
  const groups = new Map<string, { name: string; minutes: number; first: Date; profileId: string | null }>();
  for (const e of loose) {
    const name = suggestClientName(e.clientRaw);
    if (!name || !looksLikeClientName(name)) continue;
    const segs = e.clientRaw
      .replace(/\([^)]*\)/g, " ")
      .split(/\s*\|\s*|\s+[-–—]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const profileId =
      (e.profileId && profileName.has(e.profileId) ? e.profileId : null) ??
      segs
        .slice(1)
        .map((s) => matchProfile(s, profiles))
        .find((x) => !!x) ??
      matchProfile(e.profile, profiles);
    const g = groups.get(key(name)) ?? { name, minutes: 0, first: e.entryDate, profileId: null };
    g.minutes += e.minutes;
    if (e.entryDate < g.first) g.first = e.entryDate;
    g.profileId ??= profileId;
    groups.set(key(name), g);
  }

  let posts = opts.posts;
  if (!posts) posts = await loadAcceptedPosts(now, POST_LOOKBACK_DAYS).catch(() => []);

  for (const g of groups.values()) {
    if (!g.profileId) {
      out.skipped.push({ name: g.name, why: "no known Upwork profile written" });
      continue;
    }
    if (key(g.name) === key(profileName.get(g.profileId) ?? "")) {
      out.skipped.push({ name: g.name, why: "the name is the profile" });
      continue;
    }
    const near = nearExisting(g.name, existingNames);
    if (near) {
      out.skipped.push({ name: g.name, why: `looks like the existing client "${near}"` });
      continue;
    }
    const post = posts.find((p) => samePostClient(g.name, p.post.client));
    const profId = g.profileId;
    const pName = profileName.get(profId)!;
    const projectName = `${g.name} – ${pName}`;
    if (await ServiceProject.exists({ name: projectName })) {
      out.skipped.push({ name: g.name, why: "a project with that name exists" });
      continue;
    }
    if (!opts.dryRun) {
      const clientId = randomUUID();
      await ServiceClient.create({ _id: clientId, name: g.name });
      const people = [
        ...(post && bdMatch(post.post.businessDeveloper) ? [{ role: "BUSINESS_DEVELOPER", name: bdMatch(post.post.businessDeveloper)!.name }] : []),
        ...(post && baMatch(post.post.businessAnalyst) ? [{ role: "BUSINESS_ANALYST", name: baMatch(post.post.businessAnalyst)!.name }] : []),
      ];
      const start = post?.post.startDate ?? g.first;
      const id = randomUUID();
      await ServiceProject.create({
        _id: id,
        name: projectName,
        clientId,
        status: "ACTIVE",
        startDate: start,
        upworkProfileId: profId,
        people,
        contractRef: post?.ref ?? null,
        history: [
          {
            fromStatus: null,
            toStatus: "ACTIVE",
            reason: `Created automatically from a TIMER STATUS report${post ? " and its New Project Update post" : ""}`,
            at: now,
          },
        ],
        contract: { type: "HOURLY", trackingMode: "TIMER", startDate: start, hourlyRateCents: post?.post.hourlyRateCents ?? null, weeklyLimitMinutes: null },
      });
      await recordServiceAudit("project.auto_create", { projectId: id, name: projectName, fromPost: !!post }).catch(() => undefined);
    }
    out.created.push({ name: projectName, profile: pName, hours: g.minutes / 60, fromPost: !!post });
  }

  out.enriched = await enrichAutoCreated(posts, opts.dryRun === true);
  if (!opts.dryRun && (out.created.length || out.enriched.length)) {
    await rematchClients();
    await runFollowUps();
  }
  return out;
}

/**
 * Projects the app made itself that still lack a rate, a BD, a BA or a contract reference get them from the New Project Update post
 * once it exists. Only empty fields are filled, and only on automatically created projects, so nothing set by a person changes.
 */
export async function enrichAutoCreated(posts: AcceptedPost[], dryRun: boolean): Promise<string[]> {
  if (!posts.length) return [];
  const projects = await ServiceProject.find({ "history.0.reason": /^Created automatically/ })
    .select("name clientId upworkProfileId people contract contractRef")
    .lean<
      Array<{
        _id: string;
        name: string;
        clientId: string | null;
        upworkProfileId: string | null;
        people: Array<{ role: string; name: string }>;
        contract: { hourlyRateCents: number | null } | null;
        contractRef: string | null;
      }>
    >();
  const clients = await ServiceClient.find({ _id: { $in: projects.map((p) => p.clientId) } })
    .select("name")
    .lean<Array<{ _id: string; name: string }>>();
  const clientName = new Map(clients.map((c) => [c._id, c.name]));
  const done: string[] = [];
  for (const p of projects) {
    const name = clientName.get(p.clientId ?? "");
    const post = name ? posts.find((x) => samePostClient(name, x.post.client)) : undefined;
    if (!post) continue;
    const set: Record<string, unknown> = {};
    if (post.post.hourlyRateCents != null && p.contract && p.contract.hourlyRateCents == null) set["contract.hourlyRateCents"] = post.post.hourlyRateCents;
    if (!p.contractRef) set.contractRef = post.ref;
    const add: Array<{ role: string; name: string }> = [];
    const bd = bdMatch(post.post.businessDeveloper);
    const ba = baMatch(post.post.businessAnalyst);
    if (bd && !p.people.some((x) => x.role === "BUSINESS_DEVELOPER")) add.push({ role: "BUSINESS_DEVELOPER", name: bd.name });
    if (ba && !p.people.some((x) => x.role === "BUSINESS_ANALYST")) add.push({ role: "BUSINESS_ANALYST", name: ba.name });
    if (!Object.keys(set).length && !add.length) continue;
    if (!dryRun)
      await ServiceProject.updateOne(
        { _id: p._id },
        { ...(Object.keys(set).length ? { $set: set } : {}), ...(add.length ? { $push: { people: { $each: add } } } : {}) }
      );
    done.push(p.name);
  }
  return done;
}
