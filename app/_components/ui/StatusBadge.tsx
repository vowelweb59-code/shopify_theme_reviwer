import { AlertTriangle, CheckCircle2, Circle, XCircle, type LucideIcon } from "lucide-react";

export type CheckStatusValue = "PASS" | "FAIL" | "WARNING" | "NOT_TESTED";

// One canonical status system (design tokens in app/globals.css) — icon +
// text always together, never color alone, so status reads correctly for
// colorblind users and in any screen-reader-only context.
const STATUS_CONFIG: Record<CheckStatusValue, { label: string; icon: LucideIcon; bg: string; text: string; iconColor: string }> = {
  PASS: { label: "Pass", icon: CheckCircle2, bg: "bg-status-pass-bg", text: "text-status-pass-text", iconColor: "text-status-pass-icon" },
  FAIL: { label: "Fail", icon: XCircle, bg: "bg-status-fail-bg", text: "text-status-fail-text", iconColor: "text-status-fail-icon" },
  WARNING: { label: "Warning", icon: AlertTriangle, bg: "bg-status-warning-bg", text: "text-status-warning-text", iconColor: "text-status-warning-icon" },
  NOT_TESTED: { label: "Not tested", icon: Circle, bg: "bg-status-not-tested-bg", text: "text-status-not-tested-text", iconColor: "text-status-not-tested-icon" },
};

export function StatusBadge({ status, className = "" }: { status: CheckStatusValue; className?: string }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text} ${className}`}>
      <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} aria-hidden />
      {config.label}
    </span>
  );
}
