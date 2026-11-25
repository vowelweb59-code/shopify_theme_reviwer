"use client";

import { Copy, Download, ExternalLink } from "lucide-react";
import { csvCell as cell } from "@/lib/export/csvUtil";
import { useMemo, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ErrorState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import type { InstallGroup, InstallRow } from "@/lib/analytics/installEvents";
import { useApi } from "./useApi";
import { useDashboardParams } from "./useDashboardParams";

const isUrl = (v: string) => /^https?:\/\//i.test(v);
const isHost = (v: string) => /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/\S*)?$/i.test(v);
/** A store URL the browser can open: a full URL as is, a bare host such as "shop.myshopify.com" with https:// in front; otherwise null. */
const openable = (v: string | undefined, isUrlColumn: boolean): string | null => {
  if (!v || v === "(not set)") return null;
  if (isUrl(v)) return v;
  return isUrlColumn && isHost(v) ? `https://${v}` : null;
};

function GroupTable({ group, query }: { group: InstallGroup; query: string }) {
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => (q ? group.rows.filter((r) => r.values.some((v) => v.toLowerCase().includes(q))) : group.rows), [group.rows, q]);
  const shared = group.themes.length > 1;
  // The column holding the store address (owner, 2026-11-25: open any store from the table, one by one or all at once).
  const urlCol = group.dimensions.findIndex((d) => /url/i.test(d.label) || /url/i.test(d.apiName));
  const urls = useMemo(() => {
    if (urlCol < 0) return [];
    return [...new Set(rows.map((r) => openable(r.values[urlCol], true)).filter((u): u is string => !!u))];
  }, [rows, urlCol]);
  const [note, setNote] = useState<string | null>(null);

  function openAll() {
    let blocked = 0;
    for (const u of urls) if (!window.open(u, "_blank", "noopener,noreferrer")) blocked++;
    setNote(
      blocked
        ? `Your browser blocked ${blocked} of ${urls.length} tabs. Allow pop-ups for this site and press again, or use Copy all URLs and paste them into Multiple URL Opener.`
        : `Opened ${urls.length} stores.`
    );
  }
  async function copyAll() {
    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      setNote(`Copied ${urls.length} URLs, one per line: paste them into Multiple URL Opener.`);
    } catch {
      setNote("Could not copy. Allow clipboard access for this site and try again.");
    }
  }

  const columns: TableColumn<InstallRow>[] = [
    { key: "date", header: "Date", render: (r) => <span className="whitespace-nowrap tabular-nums">{r.date}</span>, sortValue: (r) => r.date },
    ...group.dimensions.map((d, i): TableColumn<InstallRow> => ({
      key: d.apiName,
      header: d.label,
      render: (r) => {
        const v = r.values[i];
        if (!v || v === "(not set)") return <span className="text-zinc-400">—</span>;
        const href = openable(v, i === urlCol);
        return href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            title="Open this store in a new tab"
          >
            {v}
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-label="Opens in a new tab" />
          </a>
        ) : (
          <span>{v}</span>
        );
      },
      sortValue: (r) => (r.values[i] ?? "").toLowerCase(),
    })),
    {
      key: "installs",
      header: "Installs",
      render: (r) => <span className="tabular-nums">{r.installs}</span>,
      sortValue: (r) => r.installs,
      className: "text-right",
    },
  ];

  function exportCsv() {
    const lines = [
      ["Date", ...group.dimensions.map((d) => d.label), "Installs"].map(cell).join(","),
      ...rows.map((r) => [r.date, ...r.values, r.installs].map(cell).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `theme-installs-${group.themes
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${group.range.start}-${group.range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader
        title={`${group.themes.join(" + ")}: ${group.total} install${group.total === 1 ? "" : "s"}`}
        description={`GA4 property ${group.propertyId} · ${group.range.start} to ${group.range.end}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {urls.length > 0 && (
              <>
                <Button type="button" onClick={openAll}>
                  <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
                  Open all ({urls.length})
                </Button>
                <Button type="button" onClick={copyAll}>
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                  Copy all URLs
                </Button>
              </>
            )}
            <Button type="button" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Export CSV
            </Button>
          </div>
        }
      />
      {group.error ? (
        <ErrorState title="Couldn't read this property" description={group.error} />
      ) : (
        <div className="flex flex-col gap-3">
          {note && (
            <p role="status" className="rounded-md bg-surface-muted p-3 text-sm text-zinc-700 dark:text-zinc-300">
              {note}
            </p>
          )}
          {group.filteredTo && (
            <p className="rounded-md bg-surface-muted p-3 text-sm text-zinc-700 dark:text-zinc-300">
              This property also tracks other themes. Showing only {group.filteredTo}: each install event names its theme (or one of its presets), and that is
              what is matched.
              {group.unnamed > 0 &&
                ` ${group.unnamed} install${group.unnamed === 1 ? "" : "s"} with no theme recorded (from before GA4 started recording it) ${group.unnamed === 1 ? "is" : "are"} left out.`}
            </p>
          )}
          {shared && (
            <p className="rounded-md bg-status-warning-bg p-3 text-sm text-status-warning-text">
              {group.themes.join(" and ")} share this GA4 property. These are every install on it; where a column below names the theme, pick one theme above to
              narrow to it, or use the search box.
            </p>
          )}
          {group.dimensions.length === 0 && (
            <p className="rounded-md bg-status-warning-bg p-3 text-sm text-status-warning-text">
              This property has no custom event parameters registered, so GA4 cannot return the store URL or title. In GA4: Admin → Custom definitions → Create
              custom dimension, scope “Event”, once for each parameter the install event sends (see it under Reports → Realtime or DebugView, on a
              shopify_theme_install event). They appear here the next day.
            </p>
          )}
          <ResponsiveTable
            columns={columns}
            rows={rows}
            rowKey={(r) => `${r.date}|${r.values.join("|")}`}
            pageSize={25}
            emptyMessage="No install events in this range."
          />
        </div>
      )}
    </Card>
  );
}

export function InstallsSection() {
  const { apiQuery, ready } = useDashboardParams();
  const [query, setQuery] = useState("");
  const { data, loading, error } = useApi<{ groups: InstallGroup[] }>(ready ? `/api/analytics/installs?${apiQuery}` : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search store URL, title or any detail"
          aria-label="Search installs"
          className="min-w-64 rounded-md border border-border-subtle bg-transparent px-3 py-1.5 text-sm"
        />
        <span className="text-xs text-zinc-500">Read live from GA4 for the theme and dates chosen above: each install with the details its event carries.</span>
      </div>
      {error && <ErrorState title="Couldn't load the installs" description={error} />}
      {loading && !data && <p className="text-sm text-zinc-500">Reading GA4…</p>}
      {data?.groups.length === 0 && <p className="text-sm text-zinc-500">No theme with a GA4 property matches this selection.</p>}
      {data?.groups.map((g) => (
        <GroupTable key={g.propertyId} group={g} query={query} />
      ))}
    </div>
  );
}
