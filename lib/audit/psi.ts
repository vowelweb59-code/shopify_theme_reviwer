export type PsiStrategy = "mobile" | "desktop";

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

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
// A real Lighthouse run on Google's end typically finishes in 5-10s, but a
// resource-constrained caller (e.g. a free-tier host under concurrent load)
// can see its own request/response handling add noticeable overhead on top
// of that — 25s left too little margin in practice (confirmed against a
// real deployment, several calls failed even with the one-retry below).
const PSI_TIMEOUT_MS = 35_000;

/**
 * Calls Google's PageSpeed Insights v5 API for a real Lighthouse read,
 * returning the full Lighthouse result object — not just a few extracted
 * numbers — so callers can surface its complete "Opportunities"/
 * "Diagnostics" audit list, as well as accessibility audits like
 * color-contrast and target-size. Returns null — never throws — whenever
 * PAGESPEED_API_KEY isn't configured, the request fails, or it times out.
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
// a single dropped connection or unusually slow PSI response shouldn't
// permanently fail that one preset — one retry before giving up (observed
// in practice: the exact same request that hung/failed once succeeded in
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
