import { AlertTriangle, CheckCircle2, Circle, XCircle, type LucideIcon } from "lucide-react";

// Status pill for the GA4 Analytics tab: same tokens as StatusBadge
// (app/globals.css), with free-form labels. Icon + text, never color alone.
export type PillTone = "pass" | "fail" | "warning" | "neutral";

const TONES: Record<PillTone, { icon: LucideIcon; classes: string; iconColor: string }> = {
  pass: { icon: CheckCircle2, classes: "bg-status-pass-bg text-status-pass-text", iconColor: "text-status-pass-icon" },
  fail: { icon: XCircle, classes: "bg-status-fail-bg text-status-fail-text", iconColor: "text-status-fail-icon" },
  warning: { icon: AlertTriangle, classes: "bg-status-warning-bg text-status-warning-text", iconColor: "text-status-warning-icon" },
  neutral: { icon: Circle, classes: "bg-status-not-tested-bg text-status-not-tested-text", iconColor: "text-status-not-tested-icon" },
};

export function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  const { icon: Icon, classes, iconColor } = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      <Icon className={`h-3.5 w-3.5 ${iconColor}`} aria-hidden />
      {label}
    </span>
  );
}

export function formatDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}
