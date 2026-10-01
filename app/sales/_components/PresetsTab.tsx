"use client";

import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { industryLabel } from "@/lib/themes/industries";
import { MonthMatrix, SalesCell, SectionTitle, formatCount, formatMoney, shareOf, type SalesSummary } from "./shared";

type PresetRow = SalesSummary["presets"][number];

export function PresetsTab({ data, multiTheme }: { data: SalesSummary; multiTheme: boolean }) {
  const total = data.totals.netSales;
  const columns: TableColumn<PresetRow>[] = [
    {
      key: "preset",
      header: "Preset",
      render: (r) => (
        <span className={r.preset === "Unknown" ? "text-zinc-500 italic" : "font-medium"}>
          {r.preset}
          {multiTheme && <span className="ml-1 text-xs font-normal text-zinc-500">{r.themeName}</span>}
        </span>
      ),
      sortValue: (r) => r.preset,
    },
    { key: "category", header: "Category", render: (r) => industryLabel(r.category), sortValue: (r) => industryLabel(r.category) },
    { key: "stores", header: "Stores", render: (r) => <span className="tabular-nums">{formatCount(r.stores)}</span>, sortValue: (r) => r.stores, className: "text-right" },
    { key: "sales", header: "Sales", render: (r) => <SalesCell m={r} />, sortValue: (r) => r.netSales, className: "text-right" },
    { key: "share", header: "Share of sales", render: (r) => <span className="tabular-nums">{shareOf(r.netSales, total)}</span>, sortValue: (r) => r.netSales, className: "text-right" },
    { key: "gross", header: "Revenue", render: (r) => <span className="tabular-nums">{formatMoney(r.gross)}</span>, sortValue: (r) => r.gross, className: "text-right" },
  ];
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionTitle
          title="Sales by preset"
          description={`Each store's preset is read from its live storefront (see the Stores tab). "Unknown" = the store is closed or renamed its theme and the sheet had no preset either.`}
        />
        <ResponsiveTable columns={columns} rows={data.presets} rowKey={(r) => `${r.themeId}-${r.preset}`} emptyMessage="No sales imported yet." />
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle title="Presets by month" description="Net sales per preset each month." />
        <MonthMatrix rows={data.presetMonths} months={data.months} rowHeader="Preset" emptyMessage="No sales in these months." />
      </section>
    </div>
  );
}
