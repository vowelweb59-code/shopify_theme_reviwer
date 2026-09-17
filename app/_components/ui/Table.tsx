"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export type TableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  // Present only on sortable columns — the raw comparable value for this
  // row (not the rendered node), so text-with-formatting columns can still
  // sort correctly (e.g. sort by a raw Date while rendering a formatted string).
  sortValue?: (row: T) => string | number;
};

/**
 * A table on wide viewports, stacked key/value cards on narrow ones — per
 * the requirement that tables "transform appropriately rather than simply
 * overflowing the viewport." Optional per-column sorting; optional row
 * click (used where a row navigates or selects, e.g. Audit History).
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const sortValue = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage ?? "Nothing to show."}</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border-subtle sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-muted text-xs uppercase text-zinc-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-medium ${c.className ?? ""}`}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200"
                    >
                      {c.header}
                      {sortKey === c.key &&
                        (sortDir === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border-subtle last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-black/[.02] dark:hover:bg-white/[.03]" : ""
                }`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {sorted.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`rounded-lg border border-border-subtle p-4 ${onRowClick ? "cursor-pointer" : ""}`}
          >
            {columns.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 py-1 text-sm first:pt-0 last:pb-0">
                <span className="text-xs uppercase text-zinc-500">{c.header}</span>
                <span className="text-right">{c.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
