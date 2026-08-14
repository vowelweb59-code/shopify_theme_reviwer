export type FindingSummary = {
  total: number;
  blocker: number;
  high: number;
  medium: number;
  low: number;
  byCategory?: Record<string, number>;
};

export type AuditDiagnostics = {
  parserWarnings: number;
  unresolvedDynamicReferences: number;
  filesSkipped: number;
  rulesSkippedDueToError: number;
};

export type FindingRow = {
  ruleId: string;
  requirementId?: string | null;
  filePath: string;
  lineNumber?: number | null;
  category: string;
  severity: "blocker" | "high" | "medium" | "low";
  // "live" findings come from actually rendering a real demo store URL
  // (real computed contrast, real rendered JSON-LD) rather than parsing
  // theme source — filePath holds the page URL checked, not a file.
  layer?: "static" | "live";
  finding: string;
  recommendation?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
};

const SEVERITY_STYLES: Record<string, string> = {
  blocker: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low
      }`}
    >
      {severity}
    </span>
  );
}

export function SummaryBar({ summary }: { summary: FindingSummary }) {
  return (
    <div className="flex flex-wrap gap-6 rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
      <div>
        <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{summary.total}</div>
        <div className="text-zinc-500">Total findings</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-red-700 dark:text-red-400">{summary.blocker}</div>
        <div className="text-zinc-500">Blocker</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-orange-700 dark:text-orange-400">{summary.high}</div>
        <div className="text-zinc-500">High</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{summary.medium}</div>
        <div className="text-zinc-500">Medium</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-zinc-700 dark:text-zinc-300">{summary.low}</div>
        <div className="text-zinc-500">Low</div>
      </div>
    </div>
  );
}

/** Surfaces analysis limitations ("could not reliably analyze") separately from findings ("no issue found"), so a clean report reads as trustworthy rather than just quiet. */
export function DiagnosticsNote({ diagnostics }: { diagnostics: AuditDiagnostics }) {
  const notes: string[] = [];
  if (diagnostics.filesSkipped > 0) {
    notes.push(`${diagnostics.filesSkipped} unsupported file(s) in the ZIP were skipped`);
  }
  if (diagnostics.unresolvedDynamicReferences > 0) {
    notes.push(
      `${diagnostics.unresolvedDynamicReferences} section/snippet render target(s) use a dynamic (non-literal) name and could not be checked`
    );
  }
  if (diagnostics.parserWarnings > 0) {
    notes.push(`${diagnostics.parserWarnings} file(s) had parser warnings`);
  }
  if (diagnostics.rulesSkippedDueToError > 0) {
    notes.push(`${diagnostics.rulesSkippedDueToError} rule(s) failed to run and were skipped`);
  }
  if (notes.length === 0) return null;

  return (
    <p className="text-xs text-zinc-500">
      Analysis limitations: {notes.join("; ")}.
    </p>
  );
}

export function FindingsTable({ findings }: { findings: FindingRow[] }) {
  if (findings.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No findings — every implemented rule passed against this theme.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-black/[.08] bg-black/[.02] text-xs uppercase text-zinc-500 dark:border-white/[.145] dark:bg-white/[.03] dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Severity</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium">Finding</th>
            <th className="px-4 py-3 font-medium">Rule</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f, i) => (
            <tr
              key={`${f.ruleId}-${f.filePath}-${f.lineNumber ?? ""}-${i}`}
              className="border-b border-black/[.06] align-top last:border-0 dark:border-white/[.08]"
            >
              <td className="px-4 py-3">
                <SeverityBadge severity={f.severity} />
              </td>
              <td className="px-4 py-3">
                {f.layer === "live" ? (
                  <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                    Live
                  </span>
                ) : (
                  <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    Static
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{f.category}</td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                {f.layer === "live" ? (
                  <a href={f.filePath} target="_blank" rel="noreferrer" className="underline hover:text-zinc-950 dark:hover:text-zinc-50">
                    {f.filePath}
                  </a>
                ) : (
                  <>
                    {f.filePath}
                    {f.lineNumber ? `:${f.lineNumber}` : ""}
                  </>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="text-zinc-950 dark:text-zinc-50">{f.finding}</div>
                {f.recommendation && <div className="mt-0.5 text-xs text-zinc-500">{f.recommendation}</div>}
              </td>
              <td className="px-4 py-3 text-xs">
                {f.sourceUrl ? (
                  <a
                    href={f.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-700 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                  >
                    {f.ruleId}
                  </a>
                ) : (
                  <span className="text-zinc-500">{f.ruleId}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
