// Matching held projects against the "Contract ended of ..." posts of New Project Update (owner, 2026-11-20: "check all the hold projects
// against the space and complete the projects that were closed there"). Pure: the caller reads the space and the database.
export interface HeldProject {
  id: string;
  name: string;
  /** The client's name and aliases, as written. */
  clientNames: string[];
  profileId: string | null;
  /** Other open projects of the same client (a post that names no profile cannot choose between them). */
  siblings: number;
}
export interface EndedPostLite {
  client: string;
  rating: number | null;
  profileId: string | null;
  profileText: string | null;
  posted: Date;
  ref: string;
}
export interface AcceptedPostLite {
  client: string;
  profileId: string | null;
  posted: Date;
}

export interface ClosurePlan {
  close: Array<{ projectId: string; name: string; endedOn: Date; rating: number | null; ref: string }>;
  skipped: Array<{ name: string; why: string }>;
  /** Held projects with no ended post at all. */
  noPost: string[];
}

export const nameKey = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Same profile, or one side names none. */
const compatible = (a: string | null, b: string | null) => !a || !b || a === b;

export function planClosures(held: HeldProject[], ended: EndedPostLite[], accepted: AcceptedPostLite[]): ClosurePlan {
  const out: ClosurePlan = { close: [], skipped: [], noPost: [] };
  for (const p of held) {
    const keys = new Set(p.clientNames.map(nameKey));
    const ofClient = ended.filter((e) => keys.has(nameKey(e.client)));
    if (ofClient.length === 0) {
      out.noPost.push(p.name);
      continue;
    }
    const fits = ofClient.filter((e) => compatible(e.profileId, p.profileId));
    if (fits.length === 0) {
      out.skipped.push({ name: p.name, why: `the ended post names another profile (${ofClient[0].profileText ?? "unknown"})` });
      continue;
    }
    const post = [...fits].sort((a, b) => +b.posted - +a.posted)[0];
    if (!post.profileId && p.siblings > 0) {
      out.skipped.push({ name: p.name, why: `the client has ${p.siblings + 1} open projects and the post (${day(post.posted)}) names no profile` });
      continue;
    }
    const again = accepted.find((a) => keys.has(nameKey(a.client)) && compatible(a.profileId, p.profileId) && a.posted > post.posted);
    if (again) {
      out.skipped.push({ name: p.name, why: `an Accepted post of ${day(again.posted)} came after the ended post of ${day(post.posted)}: it restarted` });
      continue;
    }
    out.close.push({ projectId: p.id, name: p.name, endedOn: post.posted, rating: post.rating, ref: post.ref });
  }
  return out;
}
