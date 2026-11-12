import type { CategoryChecks } from "./deriveChecksForAuditRun";
import type { PageSpeedMetric } from "@/lib/audit/pageSpeed";
import { AVAILABLE_FEATURES, featureStatus } from "@/lib/audit/availableFeatures";
import { buildEnhancementReportForRun, type EnhancementDetectionRecord } from "@/lib/audit/enhancementReport";

export type ScoreCard = {
  id: string;
  label: string;
  // 0-100, rounded. null means "not available" (nothing to measure yet, or
  // no live checks/PSI data for this run) — never a fabricated 0.
  score: number | null;
  detail: string;
};

function categoryScore(categories: CategoryChecks[], matchCategories: string[], id: string, label: string): ScoreCard {
  const items = categories.filter((c) => matchCategories.includes(c.category)).flatMap((c) => c.items);
  if (items.length === 0) return { id, label, score: null, detail: "No checks in this category yet." };
  const passed = items.filter((i) => i.status === "PASS").length;
  return { id, label, score: Math.round((passed / items.length) * 100), detail: `${passed} of ${items.length} passed` };
}

function averageDefined(values: (number | undefined)[]): number | null {
  const defined = values.filter((v): v is number => typeof v === "number");
  if (defined.length === 0) return null;
  return Math.round(defined.reduce((sum, v) => sum + v, 0) / defined.length);
}

// performanceScore only ever comes from a real PageSpeed Insights read
// (lib/audit/pageSpeed.ts) — the local Playwright fallback used when
// PAGESPEED_API_KEY isn't configured never produces one, so this card
// honestly reports "not available" rather than a fabricated score in that
// (currently the default) configuration.
function performanceScoreCard(id: string, label: string, pageSpeed: PageSpeedMetric[] | undefined, strategy: "desktop" | "mobile"): ScoreCard {
  const forStrategy = (pageSpeed ?? []).filter((m) => m.strategy === strategy);
  // The score is the average over the presets' home pages, so a preset with extra pages measured (collection, product)
  // doesn't weigh more than the others. Older runs with no home entries fall back to every measured page.
  const homePages = forStrategy.filter((m) => m.pageType === "home" && m.performanceScore !== undefined);
  const relevant = homePages.length > 0 ? homePages : forStrategy;
  const score = averageDefined(relevant.map((m) => m.performanceScore));
  if (score === null) {
    return {
      id,
      label,
      score: null,
      detail:
        relevant.length > 0
          ? "No PageSpeed Insights score available — configure PAGESPEED_API_KEY for a real Lighthouse read."
          : `Not tested — no ${strategy} measurement was taken for this run.`,
    };
  }
  const noun = homePages.length > 0 ? "preset" : "page";
  return { id, label, score, detail: `Averaged across ${relevant.length} ${noun}${relevant.length === 1 ? "" : "s"} measured` };
}

function featuresScoreCard(enhancementDetections: EnhancementDetectionRecord[] | undefined, themeStoreLabels?: Set<string>): ScoreCard {
  const detections = new Map((enhancementDetections ?? []).map((d) => [d.pointId, d.detected]));
  const statuses = AVAILABLE_FEATURES.map((f) => featureStatus(f, detections, themeStoreLabels));
  const checked = statuses.filter((s) => s !== "not_checked").length;
  const detected = statuses.filter((s) => s === "detected").length;
  if (checked === 0) {
    return { id: "features", label: "Features", score: null, detail: "Not yet checked for this theme." };
  }
  return {
    id: "features",
    label: "Features",
    score: Math.round((detected / checked) * 100),
    detail: `${detected} of ${checked} checked features covered (${AVAILABLE_FEATURES.length} in the full catalog)`,
  };
}

function opportunitiesScoreCard(
  enhancementDetections: EnhancementDetectionRecord[] | undefined,
  enhancementPoints: { pointId: string; themeCount?: number | null }[]
): ScoreCard {
  const { points, detectionAvailable } = buildEnhancementReportForRun(enhancementDetections, enhancementPoints);
  if (!detectionAvailable) {
    return { id: "opportunities", label: "Opportunities", score: null, detail: "Re-run this audit to see opportunity coverage." };
  }
  const checked = points.filter((p) => p.detected !== null);
  if (checked.length === 0) {
    return { id: "opportunities", label: "Opportunities", score: null, detail: "No opportunities checked yet." };
  }
  const covered = checked.filter((p) => p.detected === true).length;
  return {
    id: "opportunities",
    label: "Opportunities",
    score: Math.round((covered / checked.length) * 100),
    detail: `${covered} of ${checked.length} future-update opportunities already covered`,
  };
}

const DEMO_PENALTY: Record<string, number> = { blocker: 25, high: 25, medium: 10, low: 4 };

/**
 * Demo realism (lib/audit/liveChecks/demoRealism.ts): each preset starts at 100 and loses 25 per high finding, 10 per medium
 * and 4 per low (never below 0); the card is the average over the presets whose demo store was read. Null when no preset demo
 * store was audited, so an untested theme never shows a misleading 100.
 */
export function demoRealismScoreCard(demoRealism: DemoRealismInput | undefined): ScoreCard {
  const id = "demo-realism";
  const label = "Demo Realism";
  if (!demoRealism || demoRealism.presetLabels.length === 0) {
    return { id, label, score: null, detail: "Not tested — no demo store URLs were audited for this run." };
  }
  const scores = demoRealism.presetLabels.map((preset) => {
    const penalty = demoRealism.findings.filter((f) => f.presetLabel === preset).reduce((sum, f) => sum + (DEMO_PENALTY[f.severity] ?? 0), 0);
    return Math.max(0, 100 - penalty);
  });
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const n = demoRealism.presetLabels.length;
  return {
    id,
    label,
    score,
    detail: `Averaged across ${n} preset${n === 1 ? "" : "s"}; ${demoRealism.findings.length} finding${demoRealism.findings.length === 1 ? "" : "s"} (−25 high, −10 medium, −4 low)`,
  };
}

export type DemoRealismInput = { presetLabels: string[]; findings: { severity: string; presetLabel?: string | null }[] };

/**
 * The 9 Lighthouse-style scores shown on Theme Detail's Overview, computed
 * for one specific audit run (never persisted — cheap to derive from data
 * the route already loaded). Each score is independent: a category with no
 * checks yet, or a run with no live checks/PSI data, reports `score: null`
 * rather than a misleading 0.
 */
export function computeScoreboard({
  categories,
  pageSpeed,
  enhancementDetections,
  enhancementPoints,
  themeStoreFeatures,
  demoRealism,
}: {
  demoRealism?: DemoRealismInput;
  categories: CategoryChecks[];
  pageSpeed: PageSpeedMetric[] | undefined;
  enhancementDetections: EnhancementDetectionRecord[] | undefined;
  enhancementPoints: { pointId: string; themeCount?: number | null }[];
  // A theme's cached Shopify Theme Store listing feature names (see
  // lib/themes/themeStoreFeatures.ts) — confirms AVAILABLE_FEATURES entries
  // our own detectors can't check, never used to mark one absent.
  themeStoreFeatures?: string[];
}): ScoreCard[] {
  const themeStoreLabels = themeStoreFeatures ? new Set(themeStoreFeatures.map((f) => f.toLowerCase())) : undefined;
  return [
    performanceScoreCard("desktop-performance", "Desktop Performance", pageSpeed, "desktop"),
    performanceScoreCard("mobile-performance", "Mobile Performance", pageSpeed, "mobile"),
    categoryScore(categories, ["Accessibility"], "accessibility", "Accessibility"),
    categoryScore(categories, ["Technical SEO", "Technical AEO"], "seo", "SEO"),
    categoryScore(categories, ["Theme Store Compliance"], "store-requirement", "Store Requirement"),
    demoRealismScoreCard(demoRealism),
    categoryScore(categories, ["Internal Standard"], "internal-standards", "Internal Standards"),
    featuresScoreCard(enhancementDetections, themeStoreLabels),
    opportunitiesScoreCard(enhancementDetections, enhancementPoints),
  ];
}
