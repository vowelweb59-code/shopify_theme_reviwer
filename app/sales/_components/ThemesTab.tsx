"use client";

import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { MonthMatrix, SalesCell, SectionTitle, formatCount, formatMoney, formatMonth, formatRate, type SalesSummary } from "./shared";

type ThemeMonth = SalesSummary["themeMonths"][number];
type ThemeTotal = SalesSummary["themes"][number];

// Installs and Try Theme come first (the funnel's top), then what sold.
const MONTH_COLUMNS: TableColumn<ThemeMonth>[] = [
  { key: "month", header: "Month", render: (r) => <span className="whitespace-nowrap font-medium">{formatMonth(r.month)}</span>, sortValue: (r) => r.month },
  { key: "theme", header: "Theme", render: (r) => r.themeName, sortValue: (r) => r.themeName },
  { key: "try", header: "Try Theme", render: (r) => <span className="tabular-nums">{formatCount(r.tryTheme)}</span>, sortValue: (r) => r.tryTheme ?? -1, className: "text-right" },
  { key: "installs", header: "Installs", render: (r) => <span className="tabular-nums">{formatCount(r.installs)}</span>, sortValue: (r) => r.installs ?? -1, className: "text-right" },
  { key: "sales", header: "Sales", render: (r) => <SalesCell m={r} />, sortValue: (r) => r.netSales, className: "text-right" },
  { key: "rate", header: "Installs / sales", render: (r) => <span className="tabular-nums">{formatRate(r.installRate)}</span>, sortValue: (r) => r.installRate ?? -1, className: "text-right" },
  { key: "gross", header: "Revenue", render: (r) => <span className="tabular-nums">{formatMoney(r.gross)}</span>, sortValue: (r) => r.gross, className: "text-right" },
  { key: "net", header: "Your share", render: (r) => <span className="tabular-nums">{formatMoney(r.net)}</span>, sortValue: (r) => r.net, className: "text-right" },
];

const TOTAL_COLUMNS: TableColumn<ThemeTotal>[] = [
  { key: "theme", header: "Theme", render: (r) => <span className="font-medium">{r.themeName}</span>, sortValue: (r) => r.themeName },
  { key: "try", header: "Try Theme", render: (r) => <span className="tabular-nums">{formatCount(r.tryTheme)}</span>, sortValue: (r) => r.tryTheme ?? -1, className: "text-right" },
  { key: "installs", header: "Installs", render: (r) => <span className="tabular-nums">{formatCount(r.installs)}</span>, sortValue: (r) => r.installs ?? -1, className: "text-right" },
  { key: "sales", header: "Sales", render: (r) => <SalesCell m={r} />, sortValue: (r) => r.netSales, className: "text-right" },
  { key: "rate", header: "Installs / sales", render: (r) => <span className="tabular-nums">{formatRate(r.installRate)}</span>, sortValue: (r) => r.installRate ?? -1, className: "text-right" },
  { key: "gross", header: "Revenue", render: (r) => <span className="tabular-nums">{formatMoney(r.gross)}</span>, sortValue: (r) => r.gross, className: "text-right" },
  { key: "net", header: "Your share", render: (r) => <span className="tabular-nums">{formatMoney(r.net)}</span>, sortValue: (r) => r.net, className: "text-right" },
];

export function ThemesTab({ data }: { data: SalesSummary }) {
  const byTheme = data.themes.map((t) => ({
    key: t.themeId,
    label: t.themeName,
    total: t,
    byMonth: Object.fromEntries(data.themeMonths.filter((m) => m.themeId === t.themeId).map((m) => [m.month, m])),
  }));
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionTitle
          title="Themes"
          description="Totals for the selected months. Try Theme and installs come from GA4 (Analytics), which only counts the installs it could track, so sales can outnumber GA4 installs."
        />
        <ResponsiveTable columns={TOTAL_COLUMNS} rows={data.themes} rowKey={(r) => r.themeId} emptyMessage="No sales imported yet." />
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle title="Sales by month" description="Net sales (sales minus refunds) per theme, newest month first." />
        <MonthMatrix rows={byTheme} months={data.months} rowHeader="Theme" emptyMessage="No sales in these months." />
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle title="Month by month" description="Each month's Try Theme clicks and installs next to that month's sales." />
        <ResponsiveTable columns={MONTH_COLUMNS} rows={data.themeMonths} rowKey={(r) => `${r.themeId}-${r.month}`} emptyMessage="No data in these months." pageSize={24} />
      </section>
    </div>
  );
}
