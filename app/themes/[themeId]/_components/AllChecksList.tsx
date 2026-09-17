"use client";

import { useState } from "react";
import { SeverityBadge } from "@/app/_components/findings";
import type { CategoryChecks, CheckItem } from "@/lib/themes/deriveChecksForAuditRun";
import { CheckStatusBadge } from "./CheckStatusBadge";

function CheckRow({ item, isOpen, onToggle }: { item: CheckItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-lg border border-black/[.08] dark:border-white/[.145]">
      <button onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-500">{item.ruleId ?? item.requirementId}</span>
            <CheckStatusBadge status={item.status} />
          </span>
          <span className="font-medium text-zinc-950 dark:text-zinc-50">{item.title}</span>
        </span>
        <span aria-hidden className="pt-1 text-zinc-400">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 border-t border-black/[.08] p-4 text-sm dark:border-white/[.145]">
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
                      <li key={i} className="rounded-md bg-black/[.03] p-3 text-xs dark:bg-white/[.04]">
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

export function AllChecksList({ categories }: { categories: CategoryChecks[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (categories.length === 0) {
    return <p className="text-sm text-zinc-500">No checks to show yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {categories.map(({ category, items }) => (
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
      ))}
    </div>
  );
}
