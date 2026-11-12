// Which theme the automatic audit takes next. Each theme is due again 48 hours after its last automatic audit attempt;
// the scheduler takes ONE due theme per turn, the one waiting longest (a theme never audited goes first, by name).

export const AUDIT_EVERY_MS = 48 * 60 * 60 * 1000;

export type AuditCandidate = { _id: unknown; name: string; autoAuditAt?: Date | null; themeStoreLive?: boolean | null };

export function pickNextDueTheme<T extends AuditCandidate>(themes: T[], now: Date = new Date()): T | null {
  const due = themes
    .filter((t) => t.themeStoreLive !== false)
    .filter((t) => !t.autoAuditAt || now.getTime() - new Date(t.autoAuditAt).getTime() >= AUDIT_EVERY_MS);
  if (due.length === 0) return null;
  due.sort((a, b) => {
    const at = a.autoAuditAt ? new Date(a.autoAuditAt).getTime() : -Infinity;
    const bt = b.autoAuditAt ? new Date(b.autoAuditAt).getTime() : -Infinity;
    return at === bt ? a.name.localeCompare(b.name) : at - bt;
  });
  return due[0];
}
