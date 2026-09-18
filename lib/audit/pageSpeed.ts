import type { Page } from "playwright";
import type { ExecutedFinding } from "./runRules";
import { findFirstProductLink, launchBrowserWithTimeout, withNavigationRetry, type PresetLink, type PresetLiveCheckError } from "./liveCheck";

export type PageType = "home" | "collection" | "product";
export type PsiStrategy = "mobile" | "desktop";

export type PageSpeedMetric = {
  label: string;
  url: string;
  pageType: PageType;
  strategy: PsiStrategy;
  source: "psi" | "playwright";
  performanceScore?: number;
  accessibilityScore?: number;
  lcpMs?: number;
  clsScore?: number;
  tbtMs?: number;
  fcpMs?: number;
  ttfbMs?: number;
  pageWeightBytes?: number;
};

export type PageSpeedCheckResult = {
  findings: ExecutedFinding[];
  errors: PresetLiveCheckError[];
  metrics: PageSpeedMetric[];
};

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_TIMEOUT_MS = 25_000;
// See lib/audit/liveCheck.ts's own NAV_TIMEOUT_MS comment — same reasoning
// (a real store's first hit can be slow, plus this file's own
// withNavigationRetry usage below absorbs one transient timeout).
const NAV_TIMEOUT_MS = 30_000;

type PsiMetrics = { performanceScore?: number; accessibilityScore?: number; lcpMs?: number; clsScore?: number; tbtMs?: number };

// Only the fields this module actually reads from Lighthouse's real result
// shape (the same JSON PSI returns and `lighthouse` itself produces) — see
// https://github.com/GoogleChrome/lighthouse/blob/main/types/lhr/lhr.d.ts.
// Loosely typed (`unknown`-safe optionals) since this is external API data.
export type LighthouseAuditDetails = {
  type?: string;
  overallSavingsMs?: number;
  overallSavingsBytes?: number;
  items?: Array<Record<string, unknown>>;
};
export type LighthouseAudit = {
  title?: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  details?: LighthouseAuditDetails;
};
export type LighthouseAuditRef = { id: string; weight?: number; group?: string };
export type LighthouseResult = {
  audits?: Record<string, LighthouseAudit | undefined>;
  categories?: {
    performance?: { score?: number | null; auditRefs?: LighthouseAuditRef[] };
    accessibility?: { score?: number | null };
  };
};

type PsiResponse = { lighthouseResult?: LighthouseResult };

/**
 * Calls Google's PageSpeed Insights v5 API for a real Lighthouse read,
 * returning the full Lighthouse result object — not just a few extracted
 * numbers — so callers can surface its complete "Opportunities"/
 * "Diagnostics" audit list (the same data GTmetrix/PSI/Lighthouse itself
 * present), not just the headline score and Core Web Vitals. `categories`
 * defaults to performance only (the original single-page scorecard's
 * scope); pass `["performance", "accessibility"]` for the Shopify
 * submission-bar matrix, which needs both. Returns null — never throws —
 * whenever PAGESPEED_API_KEY isn't configured, the request fails, or it
 * times out, so the caller can fall back to Playwright-based metrics
 * instead of failing the whole audit.
 */
async function fetchPsiOnce(url: string, strategy: PsiStrategy, categories: string[], apiKey: string): Promise<LighthouseResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ url, key: apiKey, strategy });
    for (const category of categories) params.append("category", category);
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as PsiResponse;
    return data.lighthouseResult ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// A run against several presets makes many of these calls back to back, and
// a single dropped connection or unusually slow PSI response on this
// machine shouldn't permanently fall that one preset back to the much
// coarser Playwright heuristic — one retry before giving up (observed in
// practice: the exact same request that hung/failed once succeeded in
// well under a second on an immediate retry).
export async function fetchPsiLighthouseResult(
  url: string,
  strategy: PsiStrategy = "mobile",
  categories: string[] = ["performance"]
): Promise<LighthouseResult | null> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) return null;

  const first = await fetchPsiOnce(url, strategy, categories, apiKey);
  if (first) return first;
  return fetchPsiOnce(url, strategy, categories, apiKey);
}

/**
 * The headline numbers this module surfaces — accessibilityScore is only
 * populated when the "accessibility" category was requested (see
 * fetchPsiLighthouseResult), undefined otherwise.
 */
export function extractCoreMetrics(lhr: LighthouseResult): PsiMetrics {
  const audits = lhr.audits ?? {};
  const perfScoreRaw = lhr.categories?.performance?.score;
  const a11yScoreRaw = lhr.categories?.accessibility?.score;
  return {
    performanceScore: typeof perfScoreRaw === "number" ? Math.round(perfScoreRaw * 100) : undefined,
    accessibilityScore: typeof a11yScoreRaw === "number" ? Math.round(a11yScoreRaw * 100) : undefined,
    lcpMs: audits["largest-contentful-paint"]?.numericValue,
    clsScore: audits["cumulative-layout-shift"]?.numericValue,
    tbtMs: audits["total-blocking-time"]?.numericValue,
  };
}

/**
 * Thresholds are Google's own published Core Web Vitals / Lighthouse
 * scoring bands (see PERF-BP-003 through PERF-BP-006's sourceUrl), not
 * invented numbers. Capped at "high" — this is advisory guidance, not a
 * hard Theme Store submission rule, so it's never a "blocker".
 */
export function psiThresholdFindings(label: string, url: string, metrics: PsiMetrics): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];

  if (metrics.performanceScore !== undefined) {
    if (metrics.performanceScore < 50) {
      findings.push({
        ruleId: "LIVE-PERF-SCORE-001",
        requirementId: "PERF-BP-003",
        filePath: url,
        category: "Performance",
        severity: "high",
        presetLabel: label,
        finding: `Lighthouse performance score (mobile) is ${metrics.performanceScore}/100 — Google classifies scores below 50 as "poor".`,
        recommendation: "See the \"Suggested fixes\" list below for the specific opportunities and diagnostics behind this score, ranked by impact.",
      });
    } else if (metrics.performanceScore < 90) {
      findings.push({
        ruleId: "LIVE-PERF-SCORE-001",
        requirementId: "PERF-BP-003",
        filePath: url,
        category: "Performance",
        severity: "medium",
        presetLabel: label,
        finding: `Lighthouse performance score (mobile) is ${metrics.performanceScore}/100 — Google classifies scores under 90 as "needs improvement".`,
        recommendation: "See the \"Suggested fixes\" list below for the specific opportunities and diagnostics behind this score, ranked by impact.",
      });
    }
  }

  if (metrics.lcpMs !== undefined) {
    if (metrics.lcpMs > 4000) {
      findings.push({
        ruleId: "LIVE-PERF-LCP-001",
        requirementId: "PERF-BP-004",
        filePath: url,
        category: "Performance",
        severity: "high",
        presetLabel: label,
        finding: `Largest Contentful Paint is ${(metrics.lcpMs / 1000).toFixed(2)}s — over Google's 4s "poor" threshold.`,
        recommendation: "Optimize the largest above-the-fold element: preload/compress its image, or remove render-blocking resources ahead of it.",
      });
    } else if (metrics.lcpMs > 2500) {
      findings.push({
        ruleId: "LIVE-PERF-LCP-001",
        requirementId: "PERF-BP-004",
        filePath: url,
        category: "Performance",
        severity: "medium",
        presetLabel: label,
        finding: `Largest Contentful Paint is ${(metrics.lcpMs / 1000).toFixed(2)}s — in Google's "needs improvement" range (2.5–4s).`,
        recommendation: "Optimize the largest above-the-fold element: preload/compress its image, or remove render-blocking resources ahead of it.",
      });
    }
  }

  if (metrics.clsScore !== undefined) {
    if (metrics.clsScore > 0.25) {
      findings.push({
        ruleId: "LIVE-PERF-CLS-001",
        requirementId: "PERF-BP-005",
        filePath: url,
        category: "Performance",
        severity: "high",
        presetLabel: label,
        finding: `Cumulative Layout Shift is ${metrics.clsScore.toFixed(2)} — over Google's 0.25 "poor" threshold.`,
        recommendation: "Reserve space for images/embeds/ads and avoid inserting content above existing content after load.",
      });
    } else if (metrics.clsScore > 0.1) {
      findings.push({
        ruleId: "LIVE-PERF-CLS-001",
        requirementId: "PERF-BP-005",
        filePath: url,
        category: "Performance",
        severity: "medium",
        presetLabel: label,
        finding: `Cumulative Layout Shift is ${metrics.clsScore.toFixed(2)} — in Google's "needs improvement" range (0.1–0.25).`,
        recommendation: "Reserve space for images/embeds/ads and avoid inserting content above existing content after load.",
      });
    }
  }

  if (metrics.tbtMs !== undefined) {
    if (metrics.tbtMs > 600) {
      findings.push({
        ruleId: "LIVE-PERF-TBT-001",
        requirementId: "PERF-BP-006",
        filePath: url,
        category: "Performance",
        severity: "high",
        presetLabel: label,
        finding: `Total Blocking Time is ${Math.round(metrics.tbtMs)}ms — over Lighthouse's 600ms "poor" threshold.`,
        recommendation: "Break up long JavaScript tasks and defer non-critical scripts.",
      });
    } else if (metrics.tbtMs > 200) {
      findings.push({
        ruleId: "LIVE-PERF-TBT-001",
        requirementId: "PERF-BP-006",
        filePath: url,
        category: "Performance",
        severity: "medium",
        presetLabel: label,
        finding: `Total Blocking Time is ${Math.round(metrics.tbtMs)}ms — in Lighthouse's "needs improvement" range (200–600ms).`,
        recommendation: "Break up long JavaScript tasks and defer non-critical scripts.",
      });
    }
  }

  return findings;
}

const SHOPIFY_ACCESSIBILITY_THRESHOLD = 90;
const SHOPIFY_PERFORMANCE_THRESHOLD = 60;

function averageDefined(values: (number | undefined)[]): number | undefined {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Shopify's own literal Theme Store submission bar — distinct from the
 * generic Google Lighthouse guidance psiThresholdFindings uses above:
 * "Themes must have a minimum average Lighthouse accessibility score of 90
 * across the theme's product, collection, and home page, for both desktop
 * and mobile", plus a minimum performance score of 60 on each of those
 * same pages/strategies (stated as separate per-page minimums, not an
 * average, in Shopify's own submission feedback). `matrix` should contain
 * one entry per (page type, strategy) combination checked.
 */
export function shopifySubmissionBarFindings(label: string, matrix: PageSpeedMetric[]): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];

  for (const strategy of ["mobile", "desktop"] as const) {
    const strategyMetrics = matrix.filter((m) => m.strategy === strategy);
    if (strategyMetrics.length === 0) continue;

    const avgAccessibility = averageDefined(strategyMetrics.map((m) => m.accessibilityScore));
    if (avgAccessibility !== undefined && avgAccessibility < SHOPIFY_ACCESSIBILITY_THRESHOLD) {
      const pagesChecked = strategyMetrics.map((m) => m.pageType).join(", ");
      findings.push({
        ruleId: "LIVE-SHOPIFY-A11Y-SCORE-001",
        requirementId: "SHOPIFY-A11Y-008",
        filePath: strategyMetrics[0].url,
        category: "Accessibility",
        severity: "high",
        presetLabel: label,
        finding: `Average Lighthouse accessibility score across the ${pagesChecked} pages (${strategy}) is ${avgAccessibility.toFixed(1)}/100 — below Shopify's required minimum average of ${SHOPIFY_ACCESSIBILITY_THRESHOLD}.`,
        recommendation: "Run the accessibility audit for each page individually and fix the lowest-scoring one first.",
      });
    }

    for (const m of strategyMetrics) {
      if (typeof m.performanceScore === "number" && m.performanceScore < SHOPIFY_PERFORMANCE_THRESHOLD) {
        findings.push({
          ruleId: "LIVE-SHOPIFY-PERF-SCORE-001",
          requirementId: "SHOPIFY-PERF-001",
          filePath: m.url,
          category: "Performance",
          severity: "high",
          presetLabel: label,
          finding: `Lighthouse performance score for the ${m.pageType} page (${strategy}) is ${m.performanceScore}/100 — below Shopify's required minimum of ${SHOPIFY_PERFORMANCE_THRESHOLD}.`,
          recommendation: 'See the "Suggested fixes" list for this page\'s specific opportunities and diagnostics.',
        });
      }
    }
  }

  return findings;
}

// Lighthouse groups every performance audit into "metrics" (Core Web
// Vitals — already covered by psiThresholdFindings above), "load-
// opportunities" (specific fixes with an estimated time/byte saving, e.g.
// "Eliminate render-blocking resources"), and "diagnostics" (other issues
// without a direct savings estimate, e.g. "Avoid an excessive DOM size").
// GTmetrix/PSI/Lighthouse all surface both of the latter two groups as
// their "what to fix" list — that's what this extracts.
const OPPORTUNITY_AUDIT_GROUPS = new Set(["load-opportunities", "diagnostics"]);
// Lighthouse's own pass/needs-improvement/fail bands (0.9+ green, 0.5-0.89
// orange, <0.5 red) — same cutoff already used for the overall score above.
const PASSING_SCORE_THRESHOLD = 0.9;
const FAILING_SCORE_THRESHOLD = 0.5;
const MAX_ITEM_EXAMPLES = 3;

/**
 * Lighthouse audit descriptions are Markdown with inline `[text](url)`
 * "Learn more" links — this renders as a findings-table plain-text cell, so
 * the link syntax is stripped to its label text, and the first URL found is
 * pulled out separately for `sourceUrl` instead of being dropped.
 */
function stripMarkdownLinks(text: string): { text: string; url?: string } {
  let url: string | undefined;
  const stripped = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    url ??= href;
    return label;
  });
  return { text: stripped, url };
}

/**
 * Best-effort, since item shape varies per audit (e.g. `wastedBytes` for
 * unused-code audits, `totalBytes` for payload audits, `wastedMs` for
 * render-blocking resources) — picks whichever of those fields is present
 * rather than assuming one fixed schema, so the specific offending
 * resources (not just the aggregate savings number) are visible.
 */
function summarizeAuditItems(details: LighthouseAuditDetails | undefined): string | null {
  const items = details?.items;
  if (!Array.isArray(items) || items.length === 0) return null;

  const examples = items
    .slice(0, MAX_ITEM_EXAMPLES)
    .map((item) => {
      const rawUrl = typeof item.url === "string" ? item.url : null;
      const label = rawUrl ? rawUrl.split("/").pop() || rawUrl : null;
      const bytes =
        typeof item.wastedBytes === "number" ? item.wastedBytes : typeof item.totalBytes === "number" ? item.totalBytes : null;
      const ms = typeof item.wastedMs === "number" ? item.wastedMs : null;
      const parts = [label, bytes ? `${Math.round(bytes / 1024)}KB` : null, ms ? `${Math.round(ms)}ms` : null].filter(Boolean);
      return parts.length > 0 ? parts.join(" — ") : null;
    })
    .filter((s): s is string => s !== null);
  if (examples.length === 0) return null;

  const more = items.length > MAX_ITEM_EXAMPLES ? ` (+${items.length - MAX_ITEM_EXAMPLES} more)` : "";
  return `Affected: ${examples.join("; ")}${more}`;
}

function ruleIdForLighthouseAudit(auditId: string): string {
  return `LIVE-PERF-LH-${auditId.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
}

/**
 * Surfaces every failing Lighthouse "opportunity"/"diagnostic" audit as its
 * own finding, using Lighthouse's own title/description/savings numbers
 * rather than reinventing guidance per check — the same "what to fix" list
 * GTmetrix/PSI/Lighthouse itself present, so improving the score isn't a
 * mystery beyond the 4 headline metrics. One finding per failing audit;
 * passing (score >= 0.9), non-scored (informative/manual/notApplicable),
 * and Core-Web-Vitals "metrics"-group audits are all skipped — the latter
 * because psiThresholdFindings above already covers them as the report's
 * top-line scorecard, and duplicating them here would say the same thing
 * twice.
 */
export function extractOpportunityFindings(label: string, url: string, lhr: LighthouseResult): ExecutedFinding[] {
  const audits = lhr.audits ?? {};
  const auditRefs = lhr.categories?.performance?.auditRefs ?? [];
  const findings: ExecutedFinding[] = [];

  for (const ref of auditRefs) {
    if (!ref.group || !OPPORTUNITY_AUDIT_GROUPS.has(ref.group)) continue;
    const audit = audits[ref.id];
    if (!audit) continue;
    if (audit.scoreDisplayMode !== "numeric" && audit.scoreDisplayMode !== "binary") continue;
    if (typeof audit.score !== "number" || audit.score >= PASSING_SCORE_THRESHOLD) continue;

    const { text: description, url: learnMoreUrl } = stripMarkdownLinks(audit.description ?? "");
    const itemsSummary = summarizeAuditItems(audit.details);
    const headline = [audit.title, audit.displayValue ? `(${audit.displayValue})` : null].filter(Boolean).join(" ");

    findings.push({
      ruleId: ruleIdForLighthouseAudit(ref.id),
      requirementId: "PERF-BP-008",
      filePath: url,
      category: "Performance",
      severity: audit.score < FAILING_SCORE_THRESHOLD ? "high" : "medium",
      presetLabel: label,
      finding: [headline, itemsSummary].filter(Boolean).join(" — "),
      recommendation: description || undefined,
      sourceReference: "Google Lighthouse / PageSpeed Insights",
      sourceUrl: learnMoreUrl,
    });
  }

  return findings;
}

type FallbackMetrics = { ttfbMs: number; fcpMs: number | null; pageWeightBytes: number };

/**
 * Navigation Timing / Paint / Resource Timing read from a real page load —
 * used only when PSI isn't configured or fails. Deliberately not framed as
 * a Lighthouse-equivalent measurement (see LIVE-PERF-TTFB-001/
 * LIVE-PERF-WEIGHT-001's ruleIds and capped-at-medium severity below).
 */
async function collectPlaywrightMetrics(page: Page, url: string): Promise<FallbackMetrics> {
  await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paint = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const pageWeightBytes =
      resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) + (nav?.transferSize || 0);
    return {
      ttfbMs: nav ? nav.responseStart - nav.requestStart : 0,
      fcpMs: paint ? paint.startTime : null,
      pageWeightBytes,
    };
  });
}

/**
 * Discovers the collection and product URLs to check alongside the
 * homepage — Shopify's submission bar requires all three. The collection
 * URL needs no navigation at all: `/collections/all` is a Shopify-provided
 * route every store has by default. The product URL does need a real page
 * load to find a real link (reusing lib/audit/liveCheck.ts's own product-
 * discovery function rather than duplicating it) — `product` stays
 * undefined, not an error, when none can be found, same as liveCheck.ts's
 * own graceful handling of a store with no visible product link.
 */
async function discoverPageUrls(homeUrl: string): Promise<{ home: string; collection: string; product?: string }> {
  const collection = new URL("/collections/all", homeUrl).toString();
  let product: string | undefined;
  let browser: import("playwright").Browser | undefined;
  try {
    browser = await launchBrowserWithTimeout();
    const activeBrowser = browser;
    product = await withNavigationRetry(async () => {
      const context = await activeBrowser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        return (await findFirstProductLink(page)) ?? undefined;
      } finally {
        await context.close();
      }
    });
  } catch {
    // Leave product undefined — home/collection are still checked below.
  } finally {
    await browser?.close();
  }
  return { home: homeUrl, collection, product };
}

const TTFB_THRESHOLD_MS = 800;
const PAGE_WEIGHT_THRESHOLD_BYTES = 3_000_000;

/**
 * A bounded heuristic, not a real Lighthouse measurement — deliberately
 * capped at "medium" severity and using distinct ruleIds so it's never
 * confused with the PSI-grounded findings above.
 */
export function fallbackThresholdFindings(label: string, url: string, metrics: FallbackMetrics): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];

  if (metrics.ttfbMs > TTFB_THRESHOLD_MS) {
    findings.push({
      ruleId: "LIVE-PERF-TTFB-001",
      requirementId: "PERF-BP-007",
      filePath: url,
      category: "Performance",
      severity: "medium",
      presetLabel: label,
      finding: `Time to First Byte is ${Math.round(metrics.ttfbMs)}ms — over the commonly-cited 800ms "good" threshold. Measured via the browser's Navigation Timing API (no PageSpeed Insights API key configured), not a full Lighthouse audit — treat as a heuristic.`,
      recommendation: "Investigate server/CDN response time for this store, or configure PAGESPEED_API_KEY for a real Lighthouse read.",
    });
  }

  if (metrics.pageWeightBytes > PAGE_WEIGHT_THRESHOLD_BYTES) {
    findings.push({
      ruleId: "LIVE-PERF-WEIGHT-001",
      requirementId: "PERF-BP-007",
      filePath: url,
      category: "Performance",
      severity: "medium",
      presetLabel: label,
      finding: `Total transferred page weight is ${(metrics.pageWeightBytes / 1_000_000).toFixed(1)}MB — over the commonly-cited 3MB budget. Measured via the browser's Resource Timing API (no PageSpeed Insights API key configured), not a full Lighthouse audit — treat as a heuristic.`,
      recommendation: "Audit and compress large images/scripts/fonts loaded on this page, or configure PAGESPEED_API_KEY for a real Lighthouse read.",
    });
  }

  return findings;
}

/**
 * Runs a live page-speed check per preset demo URL: Google's PageSpeed
 * Insights API first — real Lighthouse performance score, Core Web Vitals,
 * and the full "Opportunities"/"Diagnostics" audit list (the same report
 * structure GTmetrix/PSI/Lighthouse itself show) — falling back to
 * Playwright-based Navigation Timing metrics for whichever presets PSI
 * couldn't service (that fallback only produces the basic TTFB/page-weight
 * heuristic findings, not the full audit list, since it isn't running real
 * Lighthouse). Never throws — a failure becomes an `errors` entry, same as
 * lib/audit/liveCheck.ts.
 *
 * Every preset gets the homepage/mobile scorecard + opportunities list, as
 * before. Only the first ("baseline") preset additionally gets the full
 * Shopify-submission-bar matrix (home + collection + product, mobile +
 * desktop, performance + accessibility) — see
 * shopifySubmissionBarFindings' own comment for why it's scoped to one
 * preset rather than every one.
 */
export async function runPageSpeedChecksForPresets(
  presets: PresetLink[],
  onItemComplete?: () => void
): Promise<PageSpeedCheckResult> {
  const findings: ExecutedFinding[] = [];
  const errors: PresetLiveCheckError[] = [];
  const metrics: PageSpeedMetric[] = [];
  const needsFallback: PresetLink[] = [];

  // Every preset's home-page read, and the baseline's extra matrix reads,
  // run concurrently rather than one at a time. Sequentially, 5 presets
  // (the baseline alone needing 6 PSI calls for its full matrix) meant a
  // single slow/degraded PSI response multiplied across ~10 calls could
  // turn one "Run Audit" click into several minutes — long enough that a
  // browser/proxy gives up and the user just sees "failed to run the
  // audit" even though the run was still quietly working server-side.
  // Concurrency bounds the worst case to the slowest single call (plus its
  // one retry) instead of the sum of every call.
  await Promise.all(
    presets.map(async (preset, index) => {
      const isBaseline = index === 0;
      const homeCategories = isBaseline ? ["performance", "accessibility"] : ["performance"];

      // Kicked off immediately rather than after the mobile home-page read
      // below — URL discovery is a Playwright navigation with no PSI
      // dependency, and the desktop home-page read doesn't depend on the
      // mobile one either. Overlapping them shortens the baseline preset's
      // own critical path instead of chaining three independent requests.
      const urlsPromise = isBaseline ? discoverPageUrls(preset.url) : null;
      const desktopHomePromise = isBaseline
        ? fetchPsiLighthouseResult(preset.url, "desktop", ["performance", "accessibility"])
        : null;

      const homeLhr = await fetchPsiLighthouseResult(preset.url, "mobile", homeCategories);
      if (!homeLhr) {
        needsFallback.push(preset);
        return;
      }

      const homeMetrics = extractCoreMetrics(homeLhr);
      const homeMetric: PageSpeedMetric = {
        label: preset.label,
        url: preset.url,
        pageType: "home",
        strategy: "mobile",
        source: "psi",
        ...homeMetrics,
      };
      metrics.push(homeMetric);
      findings.push(...psiThresholdFindings(preset.label, preset.url, homeMetrics));
      findings.push(...extractOpportunityFindings(preset.label, preset.url, homeLhr));

      if (!isBaseline) {
        onItemComplete?.();
        return;
      }

      const matrix: PageSpeedMetric[] = [homeMetric];

      const desktopHomeLhr = await desktopHomePromise;
      if (desktopHomeLhr) {
        const m: PageSpeedMetric = {
          label: preset.label,
          url: preset.url,
          pageType: "home",
          strategy: "desktop",
          source: "psi",
          ...extractCoreMetrics(desktopHomeLhr),
        };
        matrix.push(m);
        metrics.push(m);
      } else {
        errors.push({ label: preset.label, url: preset.url, error: "PageSpeed Insights request failed for the home page (desktop)." });
      }

      const urls = await urlsPromise!;
      const remainingPages: { pageType: PageType; url: string }[] = [
        { pageType: "collection", url: urls.collection },
        ...(urls.product ? [{ pageType: "product" as const, url: urls.product }] : []),
      ];
      const requests: { pageType: PageType; url: string; strategy: PsiStrategy }[] = remainingPages.flatMap((p) =>
        (["mobile", "desktop"] as const).map((strategy) => ({ ...p, strategy }))
      );

      const results = await Promise.all(
        requests.map(async (r) => ({ ...r, lhr: await fetchPsiLighthouseResult(r.url, r.strategy, ["performance", "accessibility"]) }))
      );
      for (const r of results) {
        if (!r.lhr) {
          errors.push({ label: preset.label, url: r.url, error: `PageSpeed Insights request failed for the ${r.pageType} page (${r.strategy}).` });
          continue;
        }
        const m: PageSpeedMetric = { label: preset.label, url: r.url, pageType: r.pageType, strategy: r.strategy, source: "psi", ...extractCoreMetrics(r.lhr) };
        matrix.push(m);
        metrics.push(m);
      }

      findings.push(...shopifySubmissionBarFindings(preset.label, matrix));
      onItemComplete?.();
    })
  );

  if (needsFallback.length > 0) {
    let browser: import("playwright").Browser | undefined;
    try {
      browser = await launchBrowserWithTimeout();
      const activeBrowser = browser;
      // One browser, many concurrent contexts (a supported Playwright
      // pattern) — same reasoning as the PSI concurrency above: several
      // presets falling back sequentially, each with its own retry, was
      // itself capable of adding minutes to a single Run Audit.
      await Promise.all(
        needsFallback.map(async (preset) => {
          try {
            const fallback = await withNavigationRetry(async () => {
              // Roughly matches PSI's own default mobile viewport.
              const context = await activeBrowser.newContext({ viewport: { width: 390, height: 844 } });
              try {
                const page = await context.newPage();
                return await collectPlaywrightMetrics(page, preset.url);
              } finally {
                await context.close();
              }
            });
            metrics.push({
              label: preset.label,
              url: preset.url,
              pageType: "home",
              strategy: "mobile",
              source: "playwright",
              ttfbMs: fallback.ttfbMs,
              fcpMs: fallback.fcpMs ?? undefined,
              pageWeightBytes: fallback.pageWeightBytes,
            });
            findings.push(...fallbackThresholdFindings(preset.label, preset.url, fallback));
          } catch (err) {
            errors.push({ label: preset.label, url: preset.url, error: err instanceof Error ? err.message : String(err) });
          } finally {
            onItemComplete?.();
          }
        })
      );
    } finally {
      await browser?.close();
    }
  }

  return { findings, errors, metrics };
}
