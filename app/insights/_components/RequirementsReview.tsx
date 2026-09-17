"use client";

import { useEffect, useMemo, useState } from "react";

type ImplementationType = "static" | "live" | "none";

type Requirement = {
  _id: string;
  requirementId: string;
  sourceType: string;
  category: string;
  title: string;
  description: string;
  sourceName: string | null;
  sourceUrl: string | null;
  severity: string;
  status: string;
  ruleStatus: string;
  implementationType: ImplementationType;
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  shopify_theme_store: "Shopify Theme Store",
  internal_standard: "Internal standard",
  technical_seo: "Technical SEO",
  technical_aeo: "Technical AEO",
  accessibility: "Accessibility",
  performance: "Performance",
  best_practice: "Best practice",
};

const RULE_STATUS_LABELS: Record<string, string> = {
  not_implemented: "Not implemented",
  partial: "Partial",
  implemented: "Implemented",
};

/**
 * Shared table behind both the "Code Review" and "Store Review" Insights
 * tabs — same requirement catalog, split by how it's actually checked:
 * "code" = analyzed from the theme's own source (a static Rule, or not yet
 * implemented by anything — still a code-shaped check once it is); "store"
 * = only checkable by visiting a real, running demo store URL (the LIVE-*
 * convention). See app/api/requirements/route.ts for how implementationType
 * is derived.
 */
export function RequirementsReview({
  scope,
  title,
  description,
}: {
  scope: "code" | "store";
  title: string;
  description: string;
}) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [ruleStatusFilter, setRuleStatusFilter] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/requirements")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setRequirements(data.requirements ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const scoped = useMemo(
    () => requirements.filter((r) => (scope === "store" ? r.implementationType === "live" : r.implementationType !== "live")),
    [requirements, scope]
  );

  const categories = useMemo(() => Array.from(new Set(scoped.map((r) => r.category))).sort(), [scoped]);

  const filtered = scoped.filter(
    (r) =>
      (!sourceTypeFilter || r.sourceType === sourceTypeFilter) &&
      (!categoryFilter || r.category === categoryFilter) &&
      (!ruleStatusFilter || r.ruleStatus === ruleStatusFilter)
  );

  const coverage = useMemo(() => {
    const total = scoped.length;
    const implemented = scoped.filter((r) => r.ruleStatus === "implemented").length;
    const partial = scoped.filter((r) => r.ruleStatus === "partial").length;
    return { total, implemented, partial, notImplemented: total - implemented - partial };
  }, [scoped]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>

      {!loading && (
        <div className="flex flex-wrap gap-6 rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{coverage.total}</div>
            <div className="text-zinc-500">Total requirements</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{coverage.implemented}</div>
            <div className="text-zinc-500">Implemented</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{coverage.partial}</div>
            <div className="text-zinc-500">Partial</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{coverage.notImplemented}</div>
            <div className="text-zinc-500">Not implemented</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <select
          value={sourceTypeFilter}
          onChange={(e) => setSourceTypeFilter(e.target.value)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
        >
          <option value="">All source types</option>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
          {Object.entries(RULE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-black/[.08] bg-black/[.02] text-xs uppercase text-zinc-500 dark:border-white/[.145] dark:bg-white/[.03] dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Requirement ID</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Source type</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Rule status</th>
              <th className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={7}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={7}>
                  No requirements match these filters.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r._id} className="border-b border-black/[.06] align-top last:border-0 dark:border-white/[.08]">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">{r.requirementId}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-950 dark:text-zinc-50">{r.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{r.description}</div>
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{SOURCE_TYPE_LABELS[r.sourceType] ?? r.sourceType}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.category}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.severity}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{RULE_STATUS_LABELS[r.ruleStatus] ?? r.ruleStatus}</td>
                <td className="px-4 py-3">
                  {r.sourceUrl ? (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-700 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                    >
                      {r.sourceName ?? "Source"}
                    </a>
                  ) : (
                    <span className="text-zinc-500">{r.sourceName ?? "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
