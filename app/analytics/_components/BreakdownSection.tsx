"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import type { FilterParam } from "@/lib/analytics/engine/filters";
import type { BreakdownSort } from "@/lib/analytics/engine/params";
import { BreakdownTable } from "./BreakdownTable";
import { FILTER_LABELS } from "./FilterBar";

/**
 * One analytics section (Geography, Acquisition, ...): a card with a
 * dimension switcher and that dimension's breakdown table. One table at a
 * time, so a page load is one request, not one per dimension.
 */
export function BreakdownSection({
  title,
  description,
  dimensions,
  defaultSort,
}: {
  title: string;
  description: string;
  dimensions: FilterParam[];
  defaultSort?: BreakdownSort;
}) {
  const [dimension, setDimension] = useState<FilterParam>(dimensions[0]);
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={
          dimensions.length > 1 && (
            <div role="tablist" aria-label={`${title} dimension`} className="inline-flex rounded-full border border-border-subtle p-0.5 text-xs">
              {dimensions.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={dimension === d}
                  onClick={() => setDimension(d)}
                  className={`rounded-full px-3 py-1 font-medium ${dimension === d ? "bg-primary-tint text-primary-tint-text" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
                >
                  {FILTER_LABELS[d]}
                </button>
              ))}
            </div>
          )
        }
      />
      <BreakdownTable key={dimension} dimension={dimension} defaultSort={defaultSort} />
    </Card>
  );
}
