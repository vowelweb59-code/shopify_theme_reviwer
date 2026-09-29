"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";
import { formatDateTime } from "@/app/_components/formatDate";
import { SectionTitle } from "./shared";

type Store = {
  id: string;
  themeId: string;
  themeName: string;
  presetOptions: string[];
  shopDomain: string;
  shopName: string;
  netSales: number;
  lastSaleAt: string | null;
  status: "pending" | "live" | "password" | "unavailable" | "dropped" | "error";
  liveUrl: string | null;
  liveThemeName: string | null;
  liveSchemaName: string | null;
  detectedPreset: string | null;
  detectedSource: "theme_name" | "sheet" | "manual" | "none";
  manualPreset: string | null;
  preset: string | null;
  checkedAt: string | null;
  error: string | null;
};
export type DetectionProgress = { running: boolean; total: number; done: number };

const STATUS: Record<Store["status"], { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-status-pass-bg text-status-pass-text" },
  password: { label: "Password page", cls: "bg-status-info-bg text-status-info-text" },
  dropped: { label: "Switched theme", cls: "bg-status-warning-bg text-status-warning-text" },
  unavailable: { label: "Store closed", cls: "bg-status-not-tested-bg text-status-not-tested-text" },
  error: { label: "Couldn't check", cls: "bg-status-fail-bg text-status-fail-text" },
  pending: { label: "Not checked yet", cls: "bg-status-not-tested-bg text-status-not-tested-text" },
};

const SOURCE: Record<Store["detectedSource"], string> = {
  theme_name: "from live theme name",
  sheet: "from the sheet",
  manual: "set by hand",
  none: "",
};

export function StoresTab({ themeId, detection, onChanged, onRecheck }: { themeId: string; detection: DetectionProgress | null; onChanged: () => void; onRecheck: () => void }) {
  const { data, loading, reload } = useApi<{ stores: Store[] }>(`/api/sales/stores${themeId ? `?themeId=${themeId}` : ""}#${detection?.done ?? 0}`);
  const [filter, setFilter] = useState<"all" | Store["status"] | "unknown">("all");
  const [error, setError] = useState<string | null>(null);
  const stores = data?.stores ?? [];
  const shown = stores.filter((s) => (filter === "all" ? true : filter === "unknown" ? !s.preset : s.status === filter));

  async function setPreset(store: Store, value: string) {
    setError(null);
    const res = await fetch("/api/sales/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: store.id, manualPreset: value || null }),
    });
    if (!res.ok) setError("Couldn't save that preset.");
    reload();
    onChanged();
  }

  const counts = stores.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    if (!s.preset) acc.unknown = (acc.unknown ?? 0) + 1;
    return acc;
  }, {});

  const columns: TableColumn<Store>[] = [
    {
      key: "store",
      header: "Store",
      render: (s) => (
        <div className="min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{s.shopName || s.shopDomain}</p>
          <a href={s.liveUrl ?? `https://${s.shopDomain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-primary">
            {s.liveUrl ? new URL(s.liveUrl).host : s.shopDomain}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      ),
      sortValue: (s) => (s.shopName || s.shopDomain).toLowerCase(),
    },
    { key: "sales", header: "Sales", render: (s) => <span className="tabular-nums">{s.netSales}</span>, sortValue: (s) => s.netSales, className: "text-right" },
    {
      key: "status",
      header: "Now",
      render: (s) => (
        <div>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
          {s.status === "dropped" && s.liveSchemaName && <p className="mt-0.5 text-xs text-zinc-500">now on {s.liveSchemaName}</p>}
          {s.status === "error" && s.error && <p className="mt-0.5 max-w-56 truncate text-xs text-zinc-500" title={s.error}>{s.error}</p>}
        </div>
      ),
      sortValue: (s) => s.status,
    },
    { key: "live", header: "Live theme name", render: (s) => <span className="text-zinc-600 dark:text-zinc-400">{s.liveThemeName ?? "—"}</span>, sortValue: (s) => s.liveThemeName ?? "" },
    {
      key: "preset",
      header: "Preset",
      render: (s) => (
        <div>
          <label className="sr-only" htmlFor={`preset-${s.id}`}>Preset for {s.shopName || s.shopDomain}</label>
          <select
            id={`preset-${s.id}`}
            value={s.manualPreset ?? ""}
            onChange={(e) => setPreset(s, e.target.value)}
            className="rounded-md border border-border-strong bg-surface px-2 py-1 text-sm"
          >
            <option value="">{s.detectedPreset ? `${s.detectedPreset} (auto)` : "Unknown"}</option>
            {s.presetOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="mt-0.5 text-xs text-zinc-500">{s.manualPreset ? SOURCE.manual : SOURCE[s.detectedSource]}</p>
        </div>
      ),
      sortValue: (s) => s.preset ?? "~",
    },
    { key: "checked", header: "Checked", render: (s) => <span className="text-xs text-zinc-500">{s.checkedAt ? formatDateTime(s.checkedAt) : "—"}</span>, sortValue: (s) => s.checkedAt ?? "" },
  ];

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: "all", label: `All (${stores.length})` },
    { id: "live", label: `Live (${counts.live ?? 0})` },
    { id: "password", label: `Password (${counts.password ?? 0})` },
    { id: "dropped", label: `Switched (${counts.dropped ?? 0})` },
    { id: "unavailable", label: `Closed (${counts.unavailable ?? 0})` },
    { id: "unknown", label: `No preset (${counts.unknown ?? 0})` },
  ];

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        title="Buyer stores"
        description="What each store that bought the theme runs today. The preset comes from the live theme name (installed presets keep their name, e.g. “Precious”); when that's not possible it falls back to the sheet. Change any preset by hand."
        action={
          <Button variant="secondary" size="sm" onClick={onRecheck} loading={detection?.running}>
            {!detection?.running && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
            {detection?.running ? `Checking stores ${detection.done}/${detection.total}` : "Re-check all stores"}
          </Button>
        }
      />
      <div role="group" aria-label="Filter stores" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-full border px-3 py-1 text-xs ${filter === f.id ? "border-primary bg-primary-tint text-primary-tint-text" : "border-border-subtle text-zinc-600 hover:border-border-strong dark:text-zinc-400"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-status-fail-text">{error}</p>}
      <ResponsiveTable columns={columns} rows={shown} rowKey={(s) => s.id} emptyMessage={loading ? "Loading…" : "No stores here."} pageSize={30} />
    </section>
  );
}
