import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { PRIMARY_EVENTS } from "@/lib/analytics/constants";
import { industryLabel } from "@/lib/themes/industries";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { SaleRecord } from "@/models/sale-record";
import { SalesStore } from "@/models/sales-store";
import { Theme } from "@/models/theme";
import { buildSummary, type GaMonth, type SaleInput, type SalesSummary } from "./aggregate";
import { listPresetCategories } from "./categories";

export type SummaryQuery = { themeId?: string | null; from?: string | null; to?: string | null };

const MONTH_RE = /^\d{4}-\d{2}$/;

/** GA4 Try Theme + install counts per theme per month (the Analytics "total" rows). */
async function loadGaMonths(themes: { _id: unknown; name: string }[], from?: string | null, to?: string | null): Promise<GaMonth[]> {
  const themeIdByName = new Map(themes.map((t) => [t.name.trim().toLowerCase(), String(t._id)]));
  const analyticsThemes = await AnalyticsTheme.find({})
    .select("_id name themeId")
    .lean<{ _id: unknown; name: string; themeId?: unknown }[]>();
  // Linked by themeId when set, else by the same name ("Adorn" ↔ "Adorn").
  const themeFor = new Map<string, string>();
  for (const a of analyticsThemes) {
    const linked = a.themeId ? String(a.themeId) : themeIdByName.get(a.name.trim().toLowerCase());
    if (linked && themes.some((t) => String(t._id) === linked)) themeFor.set(String(a._id), linked);
  }
  if (themeFor.size === 0) return [];

  const date: Record<string, string> = {};
  if (from) date.$gte = `${from}-01`;
  if (to) date.$lte = `${to}-31`;
  const rows = await AnalyticsAggregate.aggregate<{ _id: { t: unknown; m: string; e: string }; n: number }>([
    {
      $match: {
        analyticsThemeId: { $in: analyticsThemes.filter((a) => themeFor.has(String(a._id))).map((a) => a._id) },
        breakdown: "total",
        eventName: { $in: [PRIMARY_EVENTS.themeInstall, PRIMARY_EVENTS.tryTheme] },
        ...(Object.keys(date).length ? { date } : {}),
      },
    },
    { $group: { _id: { t: "$analyticsThemeId", m: { $substrBytes: ["$date", 0, 7] }, e: "$eventName" }, n: { $sum: "$metrics.eventCount" } } },
  ]);

  const byKey = new Map<string, GaMonth>();
  for (const r of rows) {
    const themeId = themeFor.get(String(r._id.t));
    if (!themeId) continue;
    const key = `${themeId}|${r._id.m}`;
    const g = byKey.get(key) ?? { themeId, month: r._id.m, tryTheme: 0, installs: 0 };
    if (r._id.e === PRIMARY_EVENTS.themeInstall) g.installs += r.n;
    else g.tryTheme += r.n;
    byKey.set(key, g);
  }
  // Installs can be fractional estimates (see ga4-analytics-architecture §5g); show whole numbers.
  return [...byKey.values()].map((g) => ({ ...g, installs: Math.round(g.installs), tryTheme: Math.round(g.tryTheme) }));
}

export async function getSalesSummary(query: SummaryQuery): Promise<SalesSummary & { themesWithSales: { themeId: string; themeName: string }[] }> {
  await connectToDatabase();
  const from = query.from && MONTH_RE.test(query.from) ? query.from : null;
  const to = query.to && MONTH_RE.test(query.to) ? query.to : null;

  const saleFilter: Record<string, unknown> = {};
  if (query.themeId) saleFilter.themeId = query.themeId;
  if (from || to) saleFilter.month = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };

  const themeIdsWithSales = (await SaleRecord.distinct("themeId")).map(String);
  const scopeIds = query.themeId ? [query.themeId] : themeIdsWithSales;
  const [themes, sales, stores, categories] = await Promise.all([
    Theme.find({ _id: { $in: themeIdsWithSales } }).select("name").sort({ name: 1 }).lean<{ _id: unknown; name: string }[]>(),
    SaleRecord.find(saleFilter).select("themeId month chargeType amount share country shopDomain").lean<
      { themeId: unknown; month: string; chargeType: string; amount: number; share: number; country: string; shopDomain: string }[]
    >(),
    SalesStore.find({ themeId: { $in: scopeIds } }).select("themeId shopDomain detectedPreset manualPreset").lean<
      { themeId: unknown; shopDomain: string; detectedPreset: string | null; manualPreset: string | null }[]
    >(),
    listPresetCategories(),
  ]);

  const presetFor = new Map(stores.map((s) => [`${s.themeId}|${s.shopDomain}`, s.manualPreset ?? s.detectedPreset ?? "Unknown"]));
  const categoryFor = new Map(categories.map((c) => [`${c.themeId}|${c.presetName.toLowerCase()}`, c.category]));
  // A store can be set by hand to another theme's preset; match it by name then.
  const categoryByName = new Map<string, string>();
  for (const c of categories) if (c.category && !categoryByName.has(c.presetName.toLowerCase())) categoryByName.set(c.presetName.toLowerCase(), c.category);

  const inputs: SaleInput[] = sales.map((s) => {
    const themeId = String(s.themeId);
    const preset = presetFor.get(`${themeId}|${s.shopDomain}`) ?? "Unknown";
    return {
      themeId,
      month: s.month,
      chargeType: s.chargeType,
      amount: s.amount,
      share: s.share,
      country: s.country,
      shopDomain: s.shopDomain,
      preset,
      category: categoryFor.get(`${themeId}|${preset.toLowerCase()}`) ?? categoryByName.get(preset.toLowerCase()) ?? null,
    };
  });

  const scopedThemes = themes.filter((t) => scopeIds.includes(String(t._id)));
  const ga = await loadGaMonths(scopedThemes, from, to);
  const themeNames = new Map(themes.map((t) => [String(t._id), t.name]));
  return {
    ...buildSummary(inputs, ga, themeNames, industryLabel),
    themesWithSales: themes.map((t) => ({ themeId: String(t._id), themeName: t.name })),
  };
}
