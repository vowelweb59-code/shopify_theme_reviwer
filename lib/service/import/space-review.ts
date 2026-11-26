// The reviewed pending-task / opportunity lists of a Chat space (see models/service-space-review.ts). Pure: the shape and its validation.

export const TASK_GROUPS = [
  { id: "client_waiting", label: "Open, client waiting" },
  { id: "older", label: "Older, probably forgotten" },
  { id: "unclear", label: "Could not be judged" },
] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number]["id"];
export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface ReviewTask {
  group: TaskGroup;
  text: string;
  asked: string | null;
  who: string | null;
  evidence: string | null;
  threads: string | null;
}
export interface ReviewOpportunity {
  priority: Priority;
  title: string;
  evidence: string | null;
  pitch: string | null;
}
export interface SpaceReview {
  space: string;
  client: string | null;
  reviewedAt: string;
  source: string | null;
  tasks: ReviewTask[];
  opportunities: ReviewOpportunity[];
  notes: string[];
}

const str = (v: unknown, field: string, required = false): string | null => {
  if (v === undefined || v === null || v === "") {
    if (required) throw new Error(`${field} is required`);
    return null;
  }
  if (typeof v !== "string") throw new Error(`${field} must be text`);
  return v.trim() || null;
};

/** Reads the JSON file the owner loads; throws a message naming the first bad field. */
export function parseSpaceReview(raw: unknown): SpaceReview {
  if (!raw || typeof raw !== "object") throw new Error("The file must hold one JSON object.");
  const o = raw as Record<string, unknown>;
  const space = str(o.space, "space", true)!;
  const reviewedAt = str(o.reviewedAt, "reviewedAt", true)!;
  if (Number.isNaN(+new Date(reviewedAt))) throw new Error("reviewedAt is not a date");
  if (!Array.isArray(o.tasks) || !Array.isArray(o.opportunities)) throw new Error("tasks and opportunities must be lists");
  const tasks = o.tasks.map((t, i) => {
    const r = (t ?? {}) as Record<string, unknown>;
    const group = r.group;
    if (!TASK_GROUPS.some((g) => g.id === group)) throw new Error(`tasks[${i}].group must be client_waiting, older or unclear`);
    return {
      group: group as TaskGroup,
      text: str(r.text, `tasks[${i}].text`, true)!,
      asked: str(r.asked, `tasks[${i}].asked`),
      who: str(r.who, `tasks[${i}].who`),
      evidence: str(r.evidence, `tasks[${i}].evidence`),
      threads: str(r.threads, `tasks[${i}].threads`),
    };
  });
  const opportunities = o.opportunities.map((t, i) => {
    const r = (t ?? {}) as Record<string, unknown>;
    if (!PRIORITIES.includes(r.priority as Priority)) throw new Error(`opportunities[${i}].priority must be High, Medium or Low`);
    return {
      priority: r.priority as Priority,
      title: str(r.title, `opportunities[${i}].title`, true)!,
      evidence: str(r.evidence, `opportunities[${i}].evidence`),
      pitch: str(r.pitch, `opportunities[${i}].pitch`),
    };
  });
  const notes = Array.isArray(o.notes) ? o.notes.filter((n): n is string => typeof n === "string") : [];
  return { space, client: str(o.client, "client"), reviewedAt, source: str(o.source, "source"), tasks, opportunities, notes };
}
