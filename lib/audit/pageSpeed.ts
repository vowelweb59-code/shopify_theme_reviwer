import type { ExecutedFinding } from "./runRules";
import { fetchPsiLighthouseResult, type LighthouseAuditDetails, type LighthouseResult, type PsiStrategy } from "./psi";
import { contrastFindingsFromPsi, touchTargetFindingsFromPsi } from "./liveChecks/psiAccessibilityFindings";
import { fetchPageFacts } from "./liveChecks/fetchPageFacts";
import { mapWithConcurrency, type PresetLink, type PresetLiveCheckError } from "./liveChecks/shared";

// Not a memory concern (these are plain fetch() calls) — this bounds how
// many simultaneous outbound requests to Google's PSI API a single Render
// instance fires at once. Confirmed by testing against a real deployment:
// fully unbounded (5 presets × up to 3 concurrent calls each, ~13 requests
// at once) caused several PSI calls to fail outright even after their
// built-in retry, apparently because a resource-constrained free-tier
// instance's network stack couldn't service that many concurrent HTTPS
// requests reliably. A modest cap fixes that without reintroducing the
// old queue-of-1 slowness.
const PSI_CONCURRENCY_LIMIT = 2;

export type PageType = "home" | "collection" | "product";
export type { PsiStrategy };

export type PageSpeedMetric = {
  label: string;
  url: string;
  pageType: PageType;
  strategy: PsiStrategy;
  performanceScore?: number;
  accessibilityScore?: number;
  lcpMs?: number;
  clsScore?: number;
  tbtMs?: number;
};

export type PageSpeedCheckResult = {
  findings: ExecutedFinding[];
  errors: PresetLiveCheckError[];
  metrics: PageSpeedMetric[];
};

type PsiMetrics = { performanceScore?: number; accessibilityScore?: number; lcpMs?: number; clsScore?: number; tbtMs?: number };

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
export function psiThresholdFindings(label: string, url: string, metrics: PsiMetrics, strategy: PsiStrategy = "mobile"): ExecutedFinding[] {
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
        finding: `Lighthouse performance score (${strategy}) is ${metrics.performanceScore}/100 — Google classifies scores below 50 as "poor".`,
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
        finding: `Lighthouse performance score (${strategy}) is ${metrics.performanceScore}/100 — Google classifies scores under 90 as "needs improvement".`,
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
        finding: `Largest Contentful Paint (${strategy}) is ${(metrics.lcpMs / 1000).toFixed(2)}s — over Google's 4s "poor" threshold.`,
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
        finding: `Largest Contentful Paint (${strategy}) is ${(metrics.lcpMs / 1000).toFixed(2)}s — in Google's "needs improvement" range (2.5–4s).`,
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
        finding: `Cumulative Layout Shift (${strategy}) is ${metrics.clsScore.toFixed(2)} — over Google's 0.25 "poor" threshold.`,
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
        finding: `Cumulative Layout Shift (${strategy}) is ${metrics.clsScore.toFixed(2)} — in Google's "needs improvement" range (0.1–0.25).`,
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
        finding: `Total Blocking Time (${strategy}) is ${Math.round(metrics.tbtMs)}ms — over Lighthouse's 600ms "poor" threshold.`,
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
        finding: `Total Blocking Time (${strategy}) is ${Math.round(metrics.tbtMs)}ms — in Lighthouse's "needs improvement" range (200–600ms).`,
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
// Vitals — already covered by psiThresholdFindings above), "diagnostics"
// (issues without a direct savings estimate, e.g. "Avoid an excessive DOM
// size"), and — in current Lighthouse versions — "insights" (specific,
// per-resource fixes with an estimated time/byte saving, e.g. "Render-
// blocking requests", "Improve image delivery"; this replaced the older
// "load-opportunities" group name, confirmed against a real PSI response
// where "load-opportunities" no longer appears at all and every actionable
// scored failure sat under "insights" instead — kept both names since a
// stale/cached Lighthouse version could still use the old one). GTmetrix/
// PSI/Lighthouse all surface these as their "what to fix" list — that's
// what this extracts.
const OPPORTUNITY_AUDIT_GROUPS = new Set(["load-opportunities", "insights", "diagnostics"]);
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
export function extractOpportunityFindings(label: string, url: string, lhr: LighthouseResult, strategy: PsiStrategy = "mobile"): ExecutedFinding[] {
  const audits = lhr.audits ?? {};
  const auditRefs = lhr.categories?.performance?.auditRefs ?? [];
  const findings: ExecutedFinding[] = [];

  for (const ref of auditRefs) {
    if (!ref.group || !OPPORTUNITY_AUDIT_GROUPS.has(ref.group)) continue;
    const audit = audits[ref.id];
    if (!audit) continue;
    // "metricSavings" is the scoreDisplayMode current Lighthouse uses for
    // most of the "insights" group's scored, per-resource audits (render-
    // blocking requests, image delivery, cache lifetimes, etc.) — without
    // it, every one of those was silently skipped despite being real,
    // scored failures (confirmed against a real PSI response: a 58/100
    // performance score with several 0-scoring insights produced zero
    // opportunity findings before this was added).
    if (audit.scoreDisplayMode !== "numeric" && audit.scoreDisplayMode !== "binary" && audit.scoreDisplayMode !== "metricSavings") continue;
    if (typeof audit.score !== "number" || audit.score >= PASSING_SCORE_THRESHOLD) continue;

    const { text: description, url: learnMoreUrl } = stripMarkdownLinks(audit.description ?? "");
    const itemsSummary = summarizeAuditItems(audit.details);
    const headline = [audit.title, `(${strategy})`, audit.displayValue ? `(${audit.displayValue})` : null].filter(Boolean).join(" ");

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

/**
 * Discovers the collection and product URLs to check alongside the
 * homepage — Shopify's submission bar requires all three. The collection
 * URL needs no request at all: `/collections/all` is a Shopify-provided
 * route every store has by default. The product URL is found via a plain
 * fetch+parse of the homepage's HTML (see fetchPageFacts.ts) rather than a
 * browser navigation — `product` stays undefined, not an error, when none
 * can be found.
 */
async function discoverPageUrls(homeUrl: string): Promise<{ home: string; collection: string; product?: string }> {
  const collection = new URL("/collections/all", homeUrl).toString();
  let product: string | undefined;
  try {
    const facts = await fetchPageFacts(homeUrl);
    product = facts.firstProductLink ?? undefined;
  } catch {
    // Leave product undefined — home/collection are still checked below.
  }
  return { home: homeUrl, collection, product };
}

/**
 * Runs a live page-speed check per preset demo URL against Google's
 * PageSpeed Insights API — real Lighthouse performance score, Core Web
 * Vitals, the full "Opportunities"/"Diagnostics" audit list, and (since
 * every home-page call now requests the accessibility category too)
 * contrast/touch-target findings derived from the same response. A preset
 * PSI can't reach becomes an `errors` entry rather than failing the whole
 * run; there is no local-browser fallback — this module makes no use of
 * Chromium/Playwright anywhere.
 *
 * Every preset gets the homepage/mobile scorecard + opportunities list +
 * accessibility findings, as before. Only the first ("baseline") preset
 * additionally gets the full Shopify-submission-bar matrix (home +
 * collection + product, mobile + desktop, performance + accessibility) —
 * see shopifySubmissionBarFindings' own comment for why it's scoped to one
 * preset rather than every one. A consequence of dropping the Playwright
 * fallback: non-baseline presets' product pages are no longer individually
 * checked for contrast/touch-target issues (only their homepage is) —
 * accepted as part of eliminating Chromium entirely.
 */
export async function runPageSpeedChecksForPresets(
  presets: PresetLink[],
  onItemComplete?: () => void
): Promise<PageSpeedCheckResult> {
  const findings: ExecutedFinding[] = [];
  const errors: PresetLiveCheckError[] = [];
  const metrics: PageSpeedMetric[] = [];

  // Every preset's home-page read, and the baseline's extra matrix reads,
  // run concurrently rather than one at a time — these are plain fetch()
  // calls to Google's API with no local memory cost, so there's no reason
  // to queue them the way the old Chromium-based checks had to be. Still
  // throttled (PSI_CONCURRENCY_LIMIT), not fully unbounded — see its own
  // comment for why.
  await mapWithConcurrency(presets, PSI_CONCURRENCY_LIMIT, async (preset, index) => {
    const isBaseline = index === 0;
    const homeCategories = ["performance", "accessibility"];

    // Kicked off immediately rather than after the mobile home-page read
    // below — URL discovery is an independent fetch with no PSI
    // dependency, and the desktop home-page read doesn't depend on the
    // mobile one either.
    const urlsPromise = isBaseline ? discoverPageUrls(preset.url) : null;
    const desktopHomePromise = isBaseline
      ? fetchPsiLighthouseResult(preset.url, "desktop", ["performance", "accessibility"])
      : null;

    const homeLhr = await fetchPsiLighthouseResult(preset.url, "mobile", homeCategories);
    if (!homeLhr) {
      errors.push({ label: preset.label, url: preset.url, error: "PageSpeed Insights request failed for the home page (mobile)." });
      onItemComplete?.();
      return;
    }

    const homeMetrics = extractCoreMetrics(homeLhr);
    const homeMetric: PageSpeedMetric = {
      label: preset.label,
      url: preset.url,
      pageType: "home",
      strategy: "mobile",
      ...homeMetrics,
    };
    metrics.push(homeMetric);
    findings.push(...psiThresholdFindings(preset.label, preset.url, homeMetrics, "mobile"));
    findings.push(...extractOpportunityFindings(preset.label, preset.url, homeLhr, "mobile"));
    findings.push(...contrastFindingsFromPsi(preset.label, preset.url, homeLhr));
    findings.push(...touchTargetFindingsFromPsi(preset.label, preset.url, homeLhr));

    if (!isBaseline) {
      onItemComplete?.();
      return;
    }

    const matrix: PageSpeedMetric[] = [homeMetric];

    const desktopHomeLhr = await desktopHomePromise;
    if (desktopHomeLhr) {
      const desktopHomeMetrics = extractCoreMetrics(desktopHomeLhr);
      const m: PageSpeedMetric = { label: preset.label, url: preset.url, pageType: "home", strategy: "desktop", ...desktopHomeMetrics };
      matrix.push(m);
      metrics.push(m);
      findings.push(...psiThresholdFindings(preset.label, preset.url, desktopHomeMetrics, "desktop"));
      findings.push(...extractOpportunityFindings(preset.label, preset.url, desktopHomeLhr, "desktop"));
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

    const results = await mapWithConcurrency(requests, PSI_CONCURRENCY_LIMIT, async (r) => ({
      ...r,
      lhr: await fetchPsiLighthouseResult(r.url, r.strategy, ["performance", "accessibility"]),
    }));
    for (const r of results) {
      if (!r.lhr) {
        errors.push({ label: preset.label, url: r.url, error: `PageSpeed Insights request failed for the ${r.pageType} page (${r.strategy}).` });
        continue;
      }
      const rMetrics = extractCoreMetrics(r.lhr);
      const m: PageSpeedMetric = { label: preset.label, url: r.url, pageType: r.pageType, strategy: r.strategy, ...rMetrics };
      matrix.push(m);
      metrics.push(m);
      findings.push(...psiThresholdFindings(preset.label, r.url, rMetrics, r.strategy));
      findings.push(...extractOpportunityFindings(preset.label, r.url, r.lhr, r.strategy));
      if (r.strategy === "mobile") {
        findings.push(...contrastFindingsFromPsi(preset.label, r.url, r.lhr));
        findings.push(...touchTargetFindingsFromPsi(preset.label, r.url, r.lhr));
      }
    }

    findings.push(...shopifySubmissionBarFindings(preset.label, matrix));
    onItemComplete?.();
  });

  return { findings, errors, metrics };
}
