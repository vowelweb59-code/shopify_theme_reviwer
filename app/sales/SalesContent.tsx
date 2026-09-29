"use client";

import { useEffect, useRef, useState } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { useApi } from "@/app/analytics/_components/useApi";
import { CategoriesTab, type CrawlProgress } from "./_components/CategoriesTab";
import { CountriesTab } from "./_components/CountriesTab";
import { ImportTab } from "./_components/ImportTab";
import { PresetsTab } from "./_components/PresetsTab";
import { StoresTab, type DetectionProgress } from "./_components/StoresTab";
import { ThemesTab } from "./_components/ThemesTab";
import { Kpi, formatCount, formatMoney, formatMonth, formatRate, type SalesSummary } from "./_components/shared";

type Status = { detection: DetectionProgress; categories: CrawlProgress };

const SELECT = "rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-sm";

export function SalesContent() {
  const [themeId, setThemeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [version, setVersion] = useState(0);
  const params = new URLSearchParams({ ...(themeId ? { themeId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const summary = useApi<SalesSummary>(`/api/sales/summary?${params}&v=${version}`);
  // Month choices come from an unfiltered request, so narrowing the range doesn't shrink them.
  const allMonths = useApi<SalesSummary>(`/api/sales/summary?${themeId ? `themeId=${themeId}&` : ""}v=${version}`);
  const months = allMonths.data?.months ?? [];
  const data = summary.data;
  const refresh = () => setVersion((v) => v + 1);

  // Poll the background jobs while either runs; refresh the tables when one finishes.
  const [status, setStatus] = useState<Status | null>(null);
  const wasRunning = useRef(false);
  const [pollKick, setPollKick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      const res = await fetch("/api/sales/status").catch(() => null);
      const s = res?.ok ? ((await res.json()) as Status) : null;
      if (cancelled || !s) return;
      setStatus(s);
      const running = s.detection.running || s.categories.running;
      if (wasRunning.current && !running) setVersion((v) => v + 1);
      wasRunning.current = running;
      if (running) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollKick]);

  async function startJob(url: string, body?: object) {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    setPollKick((n) => n + 1);
  }

  const hasSales = (data?.themesWithSales.length ?? 0) > 0;
  const importTab = { id: "import", label: "Import", content: <ImportTab onImported={() => { refresh(); setPollKick((n) => n + 1); }} /> };

  return (
    <div className="flex flex-col gap-6">
      {hasSales && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="sales-filter-theme" className="mb-1 block text-xs font-medium text-zinc-500">Theme</label>
            <select id="sales-filter-theme" value={themeId} onChange={(e) => setThemeId(e.target.value)} className={SELECT}>
              <option value="">All themes</option>
              {data?.themesWithSales.map((t) => (
                <option key={t.themeId} value={t.themeId}>
                  {t.themeName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sales-from" className="mb-1 block text-xs font-medium text-zinc-500">From</label>
            <select id="sales-from" value={from} onChange={(e) => setFrom(e.target.value)} className={SELECT}>
              <option value="">First month</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sales-to" className="mb-1 block text-xs font-medium text-zinc-500">To</label>
            <select id="sales-to" value={to} onChange={(e) => setTo(e.target.value)} className={SELECT}>
              <option value="">Latest month</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </div>
          {summary.loading && <span className="pb-2 text-xs text-zinc-500">Updating…</span>}
        </div>
      )}

      {summary.error && <p className="text-sm text-status-fail-text">{summary.error}</p>}

      {data && hasSales && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Net sales" value={formatCount(data.totals.netSales)} detail={data.totals.refunds ? `${data.totals.sales} sold, ${data.totals.refunds} refunded` : undefined} />
          <Kpi label="Revenue" value={formatMoney(data.totals.gross)} />
          <Kpi label="Your share" value={formatMoney(data.totals.net)} />
          <Kpi label="Try Theme" value={formatCount(data.totals.tryTheme)} detail="GA4" />
          <Kpi label="Installs" value={formatCount(data.totals.installs)} detail="GA4" />
          <Kpi
            label="Sales / installs"
            value={formatRate(data.totals.installs ? Math.round((data.totals.netSales / data.totals.installs) * 1000) / 10 : null)}
          />
        </div>
      )}

      {data && !hasSales ? (
        <TabbedPageClient title="" tabs={[importTab]} defaultTabId="import" />
      ) : data ? (
        <TabbedPageClient
          title=""
          defaultTabId="themes"
          tabs={[
            { id: "themes", label: "Themes", content: <ThemesTab data={data} /> },
            { id: "presets", label: "Presets", content: <PresetsTab data={data} multiTheme={!themeId && data.themesWithSales.length > 1} /> },
            {
              id: "categories",
              label: "Categories",
              content: (
                <CategoriesTab data={data} themeId={themeId} crawl={status?.categories ?? null} onChanged={refresh} onStartCrawl={() => startJob("/api/sales/categories/refresh")} />
              ),
            },
            { id: "countries", label: "Countries", content: <CountriesTab data={data} /> },
            {
              id: "stores",
              label: "Stores",
              content: <StoresTab themeId={themeId} detection={status?.detection ?? null} onChanged={refresh} onRecheck={() => startJob("/api/sales/detect", { all: true })} />,
            },
            importTab,
          ]}
        />
      ) : summary.loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        !summary.error && <EmptyState title="No sales yet" description="Import a sales sheet to get started." />
      )}
    </div>
  );
}
