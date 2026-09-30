// Pure aggregation behind the Sales page's tables. Every table uses the same
// money/count logic (salesMetrics) so theme, preset, category and country
// views always agree with each other.

export type SaleInput = {
  themeId: string;
  month: string;
  chargeType: string;
  amount: number;
  share: number;
  country: string;
  shopDomain: string;
  /** Effective preset (manual > detected > "Unknown"). */
  preset: string;
  /** Effective category slug, or null when the preset has none yet. */
  category: string | null;
};

export type Metrics = { sales: number; refunds: number; netSales: number; gross: number; net: number };

export type GaMonth = { themeId: string; month: string; tryTheme: number; installs: number };

function emptyMetrics(): Metrics {
  return { sales: 0, refunds: 0, netSales: 0, gross: 0, net: 0 };
}

function add(m: Metrics, s: SaleInput) {
  if (s.chargeType === "refund") m.refunds++;
  else if (s.chargeType === "sale") m.sales++;
  m.netSales = m.sales - m.refunds;
  m.gross = round2(m.gross + s.amount);
  m.net = round2(m.net + s.share);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function groupBy(sales: SaleInput[], key: (s: SaleInput) => string): Map<string, Metrics> {
  const out = new Map<string, Metrics>();
  for (const s of sales) {
    const k = key(s);
    const m = out.get(k) ?? emptyMetrics();
    add(m, s);
    out.set(k, m);
  }
  return out;
}

/** Month → count of net sales, for a "rows × months" matrix. */
export type MonthMatrixRow = { key: string; label: string; total: Metrics; byMonth: Record<string, Metrics> };

function matrix(sales: SaleInput[], key: (s: SaleInput) => string, label: (k: string) => string): MonthMatrixRow[] {
  const rows = new Map<string, MonthMatrixRow>();
  for (const s of sales) {
    const k = key(s);
    const row = rows.get(k) ?? { key: k, label: label(k), total: emptyMetrics(), byMonth: {} };
    add(row.total, s);
    const cell = row.byMonth[s.month] ?? emptyMetrics();
    add(cell, s);
    row.byMonth[s.month] = cell;
    rows.set(k, row);
  }
  return [...rows.values()].sort((a, b) => b.total.netSales - a.total.netSales || a.label.localeCompare(b.label));
}

export type ThemeMonthRow = Metrics & {
  themeId: string;
  themeName: string;
  month: string;
  tryTheme: number | null;
  installs: number | null;
  /** Net sales ÷ installs, as a %; null without install data. */
  installRate: number | null;
};

export type SalesSummary = {
  months: string[];
  totals: Metrics & { tryTheme: number | null; installs: number | null };
  themeMonths: ThemeMonthRow[];
  themes: (Metrics & { themeId: string; themeName: string; tryTheme: number | null; installs: number | null; installRate: number | null })[];
  presets: (Metrics & { themeId: string; themeName: string; preset: string; category: string | null; stores: number })[];
  presetMonths: MonthMatrixRow[];
  categories: (Metrics & { category: string | null; presets: string[] })[];
  categoryMonths: MonthMatrixRow[];
  countries: (Metrics & { country: string })[];
};

/** GA4 installs as a percentage of net sales; null without installs or sales. */
export function installRate(installs: number | null, netSales: number): number | null {
  return installs != null && netSales > 0 ? Math.round((installs / netSales) * 1000) / 10 : null;
}

export function buildSummary(
  sales: SaleInput[],
  ga: GaMonth[],
  themeNames: Map<string, string>,
  categoryLabel: (slug: string | null) => string
): SalesSummary {
  const hasGa = new Set(ga.map((g) => g.themeId));
  const gaByKey = new Map(ga.map((g) => [`${g.themeId}|${g.month}`, g]));
  const months = [...new Set([...sales.map((s) => s.month), ...ga.map((g) => g.month)])].sort();

  // Theme × month — every month either side has data for, so a month with
  // installs but no sales still shows up (and vice versa).
  const byThemeMonth = groupBy(sales, (s) => `${s.themeId}|${s.month}`);
  const themeIds = [...new Set([...sales.map((s) => s.themeId), ...ga.map((g) => g.themeId)])];
  const themeMonths: ThemeMonthRow[] = [];
  for (const themeId of themeIds) {
    for (const month of months) {
      const m = byThemeMonth.get(`${themeId}|${month}`);
      const g = gaByKey.get(`${themeId}|${month}`);
      if (!m && !g) continue;
      const metrics = m ?? emptyMetrics();
      const installs = hasGa.has(themeId) ? (g?.installs ?? 0) : null;
      themeMonths.push({
        themeId,
        themeName: themeNames.get(themeId) ?? "Unknown theme",
        month,
        tryTheme: hasGa.has(themeId) ? (g?.tryTheme ?? 0) : null,
        installs,
        installRate: installRate(installs, metrics.netSales),
        ...metrics,
      });
    }
  }
  themeMonths.sort((a, b) => b.month.localeCompare(a.month) || a.themeName.localeCompare(b.themeName));

  const byTheme = groupBy(sales, (s) => s.themeId);
  const themes = themeIds
    .map((themeId) => {
      const m = byTheme.get(themeId) ?? emptyMetrics();
      const gaRows = ga.filter((g) => g.themeId === themeId);
      const installs = hasGa.has(themeId) ? gaRows.reduce((n, g) => n + g.installs, 0) : null;
      const tryTheme = hasGa.has(themeId) ? gaRows.reduce((n, g) => n + g.tryTheme, 0) : null;
      return { themeId, themeName: themeNames.get(themeId) ?? "Unknown theme", tryTheme, installs, installRate: installRate(installs, m.netSales), ...m };
    })
    .sort((a, b) => b.netSales - a.netSales);

  const presetKey = (s: SaleInput) => `${s.themeId}|${s.preset}`;
  const byPreset = groupBy(sales, presetKey);
  const presets = [...byPreset].map(([key, m]) => {
    const [themeId, preset] = key.split("|");
    const sample = sales.find((s) => presetKey(s) === key);
    const stores = new Set(sales.filter((s) => presetKey(s) === key).map((s) => s.shopDomain)).size;
    return { themeId, themeName: themeNames.get(themeId) ?? "Unknown theme", preset, category: sample?.category ?? null, stores, ...m };
  });
  presets.sort((a, b) => b.netSales - a.netSales || a.preset.localeCompare(b.preset));

  const presetMonths = matrix(sales, presetKey, (k) => {
    const [themeId, preset] = k.split("|");
    return themeIds.length > 1 ? `${preset} (${themeNames.get(themeId) ?? "?"})` : preset;
  });

  const byCategory = groupBy(sales, (s) => s.category ?? "");
  const categories = [...byCategory]
    .map(([cat, m]) => ({
      category: cat || null,
      presets: [...new Set(sales.filter((s) => (s.category ?? "") === cat).map((s) => s.preset))].sort(),
      ...m,
    }))
    .sort((a, b) => b.netSales - a.netSales);
  const categoryMonths = matrix(sales, (s) => s.category ?? "", (k) => categoryLabel(k || null));

  const countries = [...groupBy(sales, (s) => s.country || "—")].map(([country, m]) => ({ country, ...m })).sort((a, b) => b.netSales - a.netSales);

  const totalMetrics = emptyMetrics();
  for (const s of sales) add(totalMetrics, s);
  const anyGa = ga.length > 0;
  return {
    months,
    totals: {
      ...totalMetrics,
      tryTheme: anyGa ? ga.reduce((n, g) => n + g.tryTheme, 0) : null,
      installs: anyGa ? ga.reduce((n, g) => n + g.installs, 0) : null,
    },
    themeMonths,
    themes,
    presets,
    presetMonths,
    categories,
    categoryMonths,
    countries,
  };
}
