"use client";

import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { SalesCell, SectionTitle, formatMoney, shareOf, type SalesSummary } from "./shared";

type CountryRow = SalesSummary["countries"][number];

const regionNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return `${regionNames?.of(code) ?? code} (${code})`;
  } catch {
    return code;
  }
}

export function CountriesTab({ data }: { data: SalesSummary }) {
  const total = data.totals.netSales;
  const columns: TableColumn<CountryRow>[] = [
    { key: "country", header: "Country", render: (r) => <span className="font-medium">{countryName(r.country)}</span>, sortValue: (r) => r.country },
    { key: "sales", header: "Sales", render: (r) => <SalesCell m={r} />, sortValue: (r) => r.netSales, className: "text-right" },
    { key: "share", header: "Share of sales", render: (r) => <span className="tabular-nums">{shareOf(r.netSales, total)}</span>, sortValue: (r) => r.netSales, className: "text-right" },
    { key: "gross", header: "Revenue", render: (r) => <span className="tabular-nums">{formatMoney(r.gross)}</span>, sortValue: (r) => r.gross, className: "text-right" },
  ];
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle title="Sales by country" description="The buyer store's country, from the sheet." />
      <ResponsiveTable columns={columns} rows={data.countries} rowKey={(r) => r.country} emptyMessage="No sales imported yet." pageSize={25} />
    </section>
  );
}
