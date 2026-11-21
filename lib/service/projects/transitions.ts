// Project lifecycle (docs/graphify/module-dependencies.md).
export type ProjectStatus = "NOT_STARTED" | "ACTIVE" | "BLOCKED" | "WAITING_FOR_CLIENT" | "ON_HOLD" | "PARTIAL_HOLD" | "COMPLETED" | "CANCELLED" | "ARCHIVED";

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "NOT_STARTED",
  "ACTIVE",
  "BLOCKED",
  "WAITING_FOR_CLIENT",
  "ON_HOLD",
  "PARTIAL_HOLD",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
];

/**
 * Any status can be changed to any other (owner, 2026-11-21: a project moved by mistake must be put back, so there are no illegal moves any
 * more). Only two rules remain: the status has to change, and reopening a completed project needs a reason.
 */
export function validateTransition(from: ProjectStatus, to: ProjectStatus, reason?: string): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: false, error: `The project is already ${to}` };
  if (from === "COMPLETED" && to === "ACTIVE" && !reason?.trim()) return { ok: false, error: "Reopening requires a reason" };
  return { ok: true };
}
