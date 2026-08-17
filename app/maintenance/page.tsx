"use client";

import { useEffect, useMemo, useState } from "react";

type MaintenanceSummary = {
  totalRequirements: number;
  activeRules: number;
  unimplementedRequirements: number;
  partialRules: number;
  rulesWithoutTests: number;
  deprecatedRequirements: number;
  criticalRulesWithoutTests: number;
};

type MatrixRow = {
  requirementId: string;
  requirementTitle: string;
  category: string;
  requirementStatus: string;
  ruleStatus: string;
  ruleId: string | null;
  hasTests: boolean | null;
  criticality: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
};

const RULE_STATUS_LABEL: Record<string, string> = {
  not_implemented: "Not implemented",
  partial: "Partial",
  implemented: "Implemented",
};

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) {
  const color =
    tone === "danger"
      ? "text-red-700 dark:text-red-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "text-zinc-950 dark:text-zinc-50";
  return (
    <div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-zinc-500">{label}</div>
    </div>
  );
}

export default function MaintenancePage() {
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [ruleStatusFilter, setRuleStatusFilter] = useState("");
  const [testsFilter, setTestsFilter] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/maintenance")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setSummary(data.summary);
        setMatrix(data.matrix ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => Array.from(new Set(matrix.map((m) => m.category))).sort(), [matrix]);

  const filtered = matrix.filter(
    (m) =>
      (!categoryFilter || m.category === categoryFilter) &&
      (!ruleStatusFilter || m.ruleStatus === ruleStatusFilter) &&
      (!testsFilter || (testsFilter === "yes" ? m.hasTests === true : m.hasTests !== true))
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Maintenance</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The control center for keeping the auditor itself accurate (phase-7 §23-24) — where coverage gaps, untested
          rules, and the full requirement-to-rule traceability matrix are visible at a glance.
        </p>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && summary && (
        <div className="flex flex-wrap gap-6 rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
          <SummaryCard label="Requirements" value={summary.totalRequirements} />
          <SummaryCard label="Active rules" value={summary.activeRules} />
          <SummaryCard label="Unimplemented requirements" value={summary.unimplementedRequirements} tone="warn" />
          <SummaryCard label="Partial rules" value={summary.partialRules} tone="warn" />
          <SummaryCard label="Rules without tests" value={summary.rulesWithoutTests} tone="warn" />
          <SummaryCard label="Critical rules without tests" value={summary.criticalRulesWithoutTests} tone="danger" />
          <SummaryCard label="Deprecated requirements" value={summary.deprecatedRequirements} />
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Requirement ↔ rule traceability matrix</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={ruleStatusFilter}
              onChange={(e) => setRuleStatusFilter(e.target.value)}
              className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
            >
              <option value="">All rule statuses</option>
              {Object.entries(RULE_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={testsFilter}
              onChange={(e) => setTestsFilter(e.target.value)}
              className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
            >
              <option value="">Tests: any</option>
              <option value="yes">Has tests</option>
              <option value="no">No tests</option>
            </select>
            <span className="self-center text-xs text-zinc-500">
              {filtered.length} of {matrix.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-black/[.08] bg-black/[.02] text-xs uppercase text-zinc-500 dark:border-white/[.145] dark:bg-white/[.03] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Requirement</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Rule</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tests</th>
                  <th className="px-4 py-3 font-medium">Criticality</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.requirementId} className="border-b border-black/[.06] align-top last:border-0 dark:border-white/[.08]">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-zinc-500">{m.requirementId}</div>
                      <div className="text-zinc-950 dark:text-zinc-50">{m.requirementTitle}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{m.category}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{m.ruleId ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{RULE_STATUS_LABEL[m.ruleStatus] ?? m.ruleStatus}</td>
                    <td className="px-4 py-3">
                      {m.hasTests === null ? (
                        <span className="text-zinc-400">—</span>
                      ) : m.hasTests ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-red-700 dark:text-red-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 capitalize">{m.criticality ?? "—"}</td>
                    <td className="px-4 py-3">
                      {m.sourceUrl ? (
                        <a
                          href={m.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-700 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                        >
                          {m.sourceName ?? "Source"}
                        </a>
                      ) : (
                        <span className="text-zinc-500">{m.sourceName ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
