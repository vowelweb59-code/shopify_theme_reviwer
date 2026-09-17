"use client";

import { Button } from "@/app/_components/ui/Button";

type VersionRow = { _id: string; version: string; createdAt: string };
type AuditTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function VersionRowView({ version, totals, onViewHistory }: { version: VersionRow; totals: AuditTotals | undefined; onViewHistory: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle p-4">
      <div>
        <div className="font-mono text-sm font-medium text-zinc-950 dark:text-zinc-50">{version.version}</div>
        <div className="text-xs text-zinc-500">Uploaded {formatDate(version.createdAt)}</div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        {totals ? (
          <>
            <span className="text-status-pass-text">{totals.passed} passed</span>
            <span className="text-status-fail-text">{totals.failed} failed</span>
            <span className="text-status-warning-text">{totals.warnings} warnings</span>
          </>
        ) : (
          <span className="text-zinc-400">No audit yet</span>
        )}
        <Button variant="secondary" size="sm" onClick={onViewHistory}>
          View
        </Button>
      </div>
    </div>
  );
}

/**
 * Every ThemeVersion (not audit run) — current vs. previous — each with its
 * own most-recent audit's totals, computed from the already-fetched
 * previousAudits list (grouped by version, newest first per version) rather
 * than a new endpoint.
 */
export function VersionsSection({
  versions,
  latestVersionId,
  totalsByVersion,
  onViewHistory,
}: {
  versions: VersionRow[];
  latestVersionId: string | null;
  totalsByVersion: Map<string, AuditTotals>;
  onViewHistory: () => void;
}) {
  if (versions.length === 0) {
    return <p className="text-sm text-zinc-500">No versions uploaded yet.</p>;
  }

  const current = versions.find((v) => v._id === latestVersionId);
  const previous = versions.filter((v) => v._id !== latestVersionId);

  return (
    <div className="flex flex-col gap-6">
      {current && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current</h3>
          <VersionRowView version={current} totals={totalsByVersion.get(current._id)} onViewHistory={onViewHistory} />
        </div>
      )}
      {previous.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Previous</h3>
          <div className="flex flex-col gap-2">
            {previous.map((v) => (
              <VersionRowView key={v._id} version={v} totals={totalsByVersion.get(v._id)} onViewHistory={onViewHistory} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
