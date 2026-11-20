// Project lifecycle (docs/graphify/module-dependencies.md).
export type ProjectStatus =
  | 'NOT_STARTED' | 'ACTIVE' | 'BLOCKED' | 'WAITING_FOR_CLIENT' | 'ON_HOLD' | 'PARTIAL_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

const ALLOWED: Record<ProjectStatus, readonly ProjectStatus[]> = {
  NOT_STARTED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['BLOCKED', 'WAITING_FOR_CLIENT', 'ON_HOLD', 'PARTIAL_HOLD', 'COMPLETED', 'CANCELLED'],
  BLOCKED: ['ACTIVE'],
  WAITING_FOR_CLIENT: ['ACTIVE'],
  ON_HOLD: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  // Partial hold (owner 2026-11-20): a client on holiday or slowing down. Still a live project; the automatic hold rules do not touch it.
  PARTIAL_HOLD: ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED', 'ACTIVE'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function validateTransition(from: ProjectStatus, to: ProjectStatus, reason?: string): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED[from].includes(to)) return { ok: false, error: `Transition ${from} -> ${to} is not allowed` };
  if (from === 'COMPLETED' && to === 'ACTIVE' && !reason?.trim()) return { ok: false, error: 'Reopening requires a reason' };
  return { ok: true };
}
