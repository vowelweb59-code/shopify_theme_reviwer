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

// Same status-token palette as StatusBadge/SeverityBadge, applied to this
// page's own vocabulary (implemented/partial/not_implemented) rather than
// reusing StatusBadge directly, since its labels are fixed to PASS/FAIL/
// WARNING/NOT_TESTED.
const RULE_STATUS_STYLES: Record<string, string> = {
  implemented: "bg-status-pass-bg text-status-pass-text",
  partial: "bg-status-warning-bg text-status-warning-text",
  not_implemented: "bg-status-not-tested-bg text-status-not-tested-text",
};

function RuleStatusBadge({ ruleStatus }: { ruleStatus: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RULE_STATUS_STYLES[ruleStatus] ?? RULE_STATUS_STYLES.not_implemented}`}>
      {RULE_STATUS_LABELS[ruleStatus] ?? ruleStatus}
    </span>
  );
}

function RequirementRow({ requirement, isOpen, onToggle }: { requirement: Requirement; isOpen: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-lg border border-border-subtle">
      <button onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-500">{requirement.requirementId}</span>
            <RuleStatusBadge ruleStatus={requirement.ruleStatus} />
            <span className="text-xs capitalize text-zinc-500">{requirement.severity}</span>
          </span>
          <span className="font-medium text-zinc-950 dark:text-zinc-50">{requirement.title}</span>
        </span>
        <span aria-hidden className="pt-1 text-zinc-400">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 border-t border-border-subtle p-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</h3>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">{requirement.description}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
            <span>Source type: {SOURCE_TYPE_LABELS[requirement.sourceType] ?? requirement.sourceType}</span>
          </div>
          {requirement.sourceUrl ? (
            <a
              href={requirement.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-xs text-primary underline hover:text-primary-hover"
            >
              {requirement.sourceName ?? "Source"}
            </a>
          ) : (
            requirement.sourceName && <span className="text-xs text-zinc-500">{requirement.sourceName}</span>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Shared list behind both the "Code Review" and "Store Review" Insights
 * tabs — same requirement catalog, split by how it's actually checked:
 * "code" = analyzed from the theme's own source (a static Rule, or not yet
 * implemented by anything — still a code-shaped check once it is); "store"
 * = only checkable by visiting a real, running demo store URL (the LIVE-*
 * convention). See app/api/requirements/route.ts for how implementationType
 * is derived. Rendered as compact, expandable rows (progressive disclosure —
 * matching AllChecksList's idiom) rather than a flat table with the full
 * description inline, which made every row a different, often very tall,
 * height and was hard to scan.
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
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const groupedByCategory = useMemo(() => {
    const byCategory = new Map<string, Requirement[]>();
    for (const r of filtered) {
      const list = byCategory.get(r.category) ?? [];
      list.push(r);
      byCategory.set(r.category, list);
    }
    return Array.from(byCategory.entries());
  }, [filtered]);

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
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      {!loading && (
        <div className="flex flex-wrap gap-6 rounded-lg border border-border-subtle p-5 text-sm">
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{coverage.total}</div>
            <div className="text-zinc-500">Total requirements</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-status-pass-text">{coverage.implemented}</div>
            <div className="text-zinc-500">Implemented</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-status-warning-text">{coverage.partial}</div>
            <div className="text-zinc-500">Partial</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-500">{coverage.notImplemented}</div>
            <div className="text-zinc-500">Not implemented</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <select
          value={sourceTypeFilter}
          onChange={(e) => setSourceTypeFilter(e.target.value)}
          className="rounded-md border border-border-subtle bg-transparent px-3 py-2"
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
          className="rounded-md border border-border-subtle bg-transparent px-3 py-2"
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
          className="rounded-md border border-border-subtle bg-transparent px-3 py-2"
        >
          <option value="">All rule statuses</option>
          {Object.entries(RULE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && filtered.length === 0 && <p className="text-sm text-zinc-500">No requirements match these filters.</p>}

      {!loading &&
        groupedByCategory.map(([category, items]) => (
          <div key={category} className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {category}
              <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
                {items.length}
              </span>
            </h3>
            <ul className="flex flex-col gap-2">
              {items.map((r) => (
                <RequirementRow
                  key={r._id}
                  requirement={r}
                  isOpen={expanded === r._id}
                  onToggle={() => setExpanded(expanded === r._id ? null : r._id)}
                />
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
