"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SeverityBadge } from "@/app/_components/findings";
import { StatusBadge, type CheckStatusValue } from "@/app/_components/ui/StatusBadge";
import type { CategoryChecks, CheckItem } from "@/lib/themes/deriveChecksForAuditRun";

const STATUS_FILTERS: { value: CheckStatusValue | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "FAIL", label: "Failed" },
  { value: "WARNING", label: "Warning" },
  { value: "PASS", label: "Passed" },
  { value: "NOT_TESTED", label: "Not Tested" },
];

function CheckRow({ item, isOpen, onToggle }: { item: CheckItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-lg border border-border-subtle">
      <button onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-500">{item.ruleId ?? item.requirementId}</span>
            <StatusBadge status={item.status} />
          </span>
          <span className="font-medium text-zinc-950 dark:text-zinc-50">{item.title}</span>
        </span>
        <span aria-hidden className="pt-1 text-zinc-400">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 border-t border-border-subtle p-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</h3>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">{item.description}</p>
          </div>

          {item.status !== "PASS" && item.status !== "NOT_TESTED" && (
            <>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Issues found: {item.evidence.length}
                </h3>
              </div>
              {item.evidence.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Evidence</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {item.evidence.map((ev, i) => (
                      <li key={i} className="rounded-md bg-surface-muted p-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={ev.severity} />
                          <span className="font-mono text-zinc-500">
                            {ev.filePath}
                            {ev.lineNumber ? `:${ev.lineNumber}` : ""}
                          </span>
                        </div>
                        <p className="mt-1 text-zinc-700 dark:text-zinc-300">{ev.finding}</p>
                        {ev.sourceSnippet && (
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-zinc-500">
                            {ev.sourceSnippet}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.recommendation && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recommendation</h3>
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">{item.recommendation}</p>
                </div>
              )}
            </>
          )}

          {item.status === "NOT_TESTED" && (
            <p className="text-xs text-zinc-500">
              Not tested for this run — either no rule implements this check yet, or it requires a live demo store
              URL that wasn&apos;t supplied.
            </p>
          )}

          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-xs text-zinc-500 underline hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              {item.sourceName ?? "Source"}
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function matchesSearch(item: CheckItem, query: string): boolean {
  if (!query) return true;
  const haystack = [item.ruleId, item.requirementId, item.title, item.description, ...item.evidence.map((e) => e.filePath)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function AllChecksList({ categories }: { categories: CategoryChecks[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<CheckStatusValue | "">("");

  const allItems = useMemo(() => categories.flatMap((c) => c.items), [categories]);

  const preStatusItems = useMemo(
    () => allItems.filter((item) => matchesSearch(item, search) && (!categoryFilter || item.category === categoryFilter)),
    [allItems, search, categoryFilter]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<CheckStatusValue, number> = { PASS: 0, FAIL: 0, WARNING: 0, NOT_TESTED: 0 };
    for (const item of preStatusItems) counts[item.status]++;
    return counts;
  }, [preStatusItems]);

  const filteredCategories = useMemo(() => {
    return categories
      .map(({ category, items }) => ({
        category,
        items: items.filter(
          (item) => matchesSearch(item, search) && (!categoryFilter || category === categoryFilter) && (!statusFilter || item.status === statusFilter)
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, search, categoryFilter, statusFilter]);

  if (categories.length === 0) {
    return <p className="text-sm text-zinc-500">No checks to show yet.</p>;
  }

  const totalVisible = filteredCategories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border-subtle text-zinc-600 hover:border-border-strong dark:text-zinc-400"
                }`}
              >
                {f.label}
                {f.value && ` (${statusCounts[f.value]})`}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-500">{totalVisible} checks</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search checks…"
              className="w-full rounded-md border border-border-subtle bg-transparent py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <p className="text-sm text-zinc-500">No checks match these filters.</p>
      ) : (
        filteredCategories.map(({ category, items }) => (
          <div key={category} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {category}
              <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
                {items.length}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <CheckRow
                  key={item.key}
                  item={item}
                  isOpen={expanded === item.key}
                  onToggle={() => setExpanded(expanded === item.key ? null : item.key)}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
