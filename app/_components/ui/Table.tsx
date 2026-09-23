"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
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
  theadClassName,
  rowClassName,
  pageSize,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  // Defaults to the plain neutral header every other table already uses;
  // pass a tinted variant (e.g. "bg-primary-tint text-primary-tint-text")
  // for a page that wants a more colorful header without changing every
  // other table in the app that shares this component.
  theadClassName?: string;
  // Per-row extra classes (e.g. a colored left border to flag a row that
  // needs attention) — applied to both the desktop <tr> and the mobile
  // stacked card, so a "highlighted box" reads the same at every width.
  rowClassName?: (row: T) => string;
  // Opt-in: once `rows` exceeds this count, the table splits into pages of
  // this size with Prev/Next controls instead of rendering every row at
  // once. Omitted (the default everywhere else) means no pagination at
  // all — unaffected callers keep rendering every row exactly as before.
  pageSize?: number;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

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

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  // Clamped rather than stored pre-clamped — a shorter `rows` arriving after
  // a refetch (or a page the user was already past) shouldn't strand them on
  // a blank page.
  const currentPage = Math.min(page, pageCount - 1);
  const paged = pageSize ? sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize) : sorted;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage ?? "Nothing to show."}</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border-subtle sm:block">
        <table className="w-full text-left text-sm">
          <thead className={`border-b border-border-subtle text-xs uppercase ${theadClassName ?? "bg-surface-muted text-zinc-500"}`}>
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
            {paged.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border-subtle last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-black/[.02] dark:hover:bg-white/[.03]" : ""
                } ${rowClassName?.(row) ?? ""}`}
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
        {paged.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`rounded-lg border border-border-subtle p-4 ${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row) ?? ""}`}
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

      {pageSize && sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-3 pt-3 text-sm text-zinc-500">
          <span>
            Page {currentPage + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 hover:bg-black/[.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/[.03] dark:disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={currentPage >= pageCount - 1}
              className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 hover:bg-black/[.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/[.03] dark:disabled:hover:bg-transparent"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
