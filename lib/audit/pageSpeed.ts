import { chromium, type Page } from "playwright";
import type { ExecutedFinding } from "./runRules";
import type { PresetLink, PresetLiveCheckError } from "./liveCheck";

export type PageSpeedMetric = {
  label: string;
  url: string;
  source: "psi" | "playwright";
  performanceScore?: number;
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
const NAV_TIMEOUT_MS = 20_000;

type PsiMetrics = { performanceScore?: number; lcpMs?: number; clsScore?: number; tbtMs?: number };

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
  categories?: { performance?: { score?: number | null; auditRefs?: LighthouseAuditRef[] } };
};

type PsiResponse = { lighthouseResult?: LighthouseResult };

/**
 * Calls Google's PageSpeed Insights v5 API for a real Lighthouse read
 * (mobile strategy, to match PSI's own default emphasis), returning the
 * full Lighthouse result object — not just a few extracted numbers — so
 * callers can surface its complete "Opportunities"/"Diagnostics" audit list
 * (the same data GTmetrix/PSI/Lighthouse itself present), not just the
 * headline score and Core Web Vitals. Returns null — never throws —
 * whenever PAGESPEED_API_KEY isn't configured, the request fails, or it
 * times out, so the caller can fall back to Playwright-based metrics
 * instead of failing the whole audit.
 */
export async function fetchPsiLighthouseResult(url: string): Promise<LighthouseResult | null> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ url, key: apiKey, strategy: "mobile", category: "performance" });
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

/** The same 4 headline numbers this module has always surfaced — now derived from the full Lighthouse result rather than fetched separately. */
export function extractCoreMetrics(lhr: LighthouseResult): PsiMetrics {
  const audits = lhr.audits ?? {};
  const scoreRaw = lhr.categories?.performance?.score;
  return {
    performanceScore: typeof scoreRaw === "number" ? Math.round(scoreRaw * 100) : undefined,
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
 * Scope: homepage only per preset, not the product page — PSI is
 * rate/quota-limited per API key, and doubling calls isn't worth it for a
 * first version of this check.
 */
export async function runPageSpeedChecksForPresets(presets: PresetLink[]): Promise<PageSpeedCheckResult> {
  const findings: ExecutedFinding[] = [];
  const errors: PresetLiveCheckError[] = [];
  const metrics: PageSpeedMetric[] = [];
  const needsFallback: PresetLink[] = [];

  for (const preset of presets) {
    const lhr = await fetchPsiLighthouseResult(preset.url);
    if (lhr) {
      const psi = extractCoreMetrics(lhr);
      metrics.push({ label: preset.label, url: preset.url, source: "psi", ...psi });
      findings.push(...psiThresholdFindings(preset.label, preset.url, psi));
      findings.push(...extractOpportunityFindings(preset.label, preset.url, lhr));
    } else {
      needsFallback.push(preset);
    }
  }

  if (needsFallback.length > 0) {
    let browser: import("playwright").Browser | undefined;
    try {
      browser = await chromium.launch();
      for (const preset of needsFallback) {
        let context: import("playwright").BrowserContext | undefined;
        try {
          // Roughly matches PSI's own default mobile viewport.
          context = await browser.newContext({ viewport: { width: 390, height: 844 } });
          const page = await context.newPage();
          const fallback = await collectPlaywrightMetrics(page, preset.url);
          metrics.push({
            label: preset.label,
            url: preset.url,
            source: "playwright",
            ttfbMs: fallback.ttfbMs,
            fcpMs: fallback.fcpMs ?? undefined,
            pageWeightBytes: fallback.pageWeightBytes,
          });
          findings.push(...fallbackThresholdFindings(preset.label, preset.url, fallback));
        } catch (err) {
          errors.push({ label: preset.label, url: preset.url, error: err instanceof Error ? err.message : String(err) });
        } finally {
          await context?.close();
        }
      }
    } finally {
      await browser?.close();
    }
  }

  return { findings, errors, metrics };
}
