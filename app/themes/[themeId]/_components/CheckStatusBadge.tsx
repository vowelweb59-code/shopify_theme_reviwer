import type { CheckStatus } from "@/lib/themes/deriveChecksForAuditRun";

// Same "100/950" solid-background pill idiom as SeverityBadge/FindingStatusBadge
// (app/_components/findings.tsx) — PASS/FAIL/WARNING/NOT_TESTED are this
// module's own vocabulary, not a rename of severity, but reads consistently
// alongside the rest of the report family.
const STATUS_STYLES: Record<CheckStatus, string> = {
  PASS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  FAIL: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  WARNING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  NOT_TESTED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_SYMBOL: Record<CheckStatus, string> = {
  PASS: "✓",
  FAIL: "✕",
  WARNING: "⚠",
  NOT_TESTED: "—",
};

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      <span aria-hidden>{STATUS_SYMBOL[status]}</span>
      {status.replace("_", " ")}
    </span>
  );
}
