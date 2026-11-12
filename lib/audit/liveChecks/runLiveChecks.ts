import type { ExecutedFinding } from "../runRules";
import { fetchPageFacts, type PageFacts } from "./fetchPageFacts";
import { homepageFindings, productPageFindings } from "./structuralFindings";
import { demoRealismFindings, imageProbeFindings, presetOverlapFindings } from "./demoRealism";
import { probeImages } from "./imageProbe";
import { comparePresets, type PresetFacts } from "./presetComparison";
import { mapWithConcurrency, FETCH_CONCURRENCY_LIMIT, type PresetLink, type PresetLiveCheckError } from "./shared";

export type MultiPresetLiveCheckResult = { findings: ExecutedFinding[]; errors: PresetLiveCheckError[] };

type PresetCheckOutcome = { findings: ExecutedFinding[]; home: PageFacts; product?: PageFacts };

/**
 * Fetches a preset's homepage (and, if found, its first product page) as
 * plain HTML — no browser — and runs the structural (JSON-LD/canonical/
 * meta-description) checks against each. A product page fetch failing
 * doesn't invalidate the homepage findings already collected.
 */
/** Reads the headers of a page's first photos for broken or too-small images; any failure here just means no finding. */
async function realismImageFindings(content: NonNullable<PageFacts["content"]>, pageType: "home" | "product", url: string): Promise<ExecutedFinding[]> {
  try {
    return imageProbeFindings(await probeImages(content), pageType, url);
  } catch {
    return [];
  }
}

async function runChecksForPreset(label: string, demoStoreUrl: string): Promise<PresetCheckOutcome> {
  const homeFacts = await fetchPageFacts(demoStoreUrl);
  const findings = homepageFindings(homeFacts).map((f) => ({ ...f, presetLabel: label }));
  // Demo realism (real copy, products and pictures) from the same page loads; skipped when a page has no content read.
  if (homeFacts.content) {
    findings.push(...demoRealismFindings(homeFacts.content, "home", homeFacts.url).map((f) => ({ ...f, presetLabel: label })));
    findings.push(...(await realismImageFindings(homeFacts.content, "home", homeFacts.url)).map((f) => ({ ...f, presetLabel: label })));
  }

  let productFacts: PageFacts | undefined;
  if (homeFacts.firstProductLink) {
    try {
      productFacts = await fetchPageFacts(homeFacts.firstProductLink);
      findings.push(...productPageFindings(productFacts).map((f) => ({ ...f, presetLabel: label })));
      if (productFacts.content) {
        findings.push(...demoRealismFindings(productFacts.content, "product", productFacts.url).map((f) => ({ ...f, presetLabel: label })));
        findings.push(...(await realismImageFindings(productFacts.content, "product", productFacts.url)).map((f) => ({ ...f, presetLabel: label })));
      }
    } catch {
      // Product page fetch failing doesn't invalidate the homepage
      // findings already collected — skip it and move on.
    }
  }

  // The first collection linked from the homepage: does it hold enough products to look like a real catalog?
  const collectionLink = homeFacts.content?.firstCollectionLink;
  if (collectionLink) {
    try {
      const collectionFacts = await fetchPageFacts(collectionLink);
      if (collectionFacts.content) findings.push(...demoRealismFindings(collectionFacts.content, "collection", collectionFacts.url).map((f) => ({ ...f, presetLabel: label })));
    } catch {
      // A collection page that won't load is not a realism finding; skip it.
    }
  }

  return { findings, home: homeFacts, product: productFacts };
}

/**
 * Runs the fetch-based structural check battery against every preset's
 * demo URL, then — once 2+ presets actually succeeded — runs
 * comparePresets() across their collected page facts and appends its
 * findings too. A single preset's demo being unreachable is recorded in
 * `errors` and does not prevent the others (or the comparison, if 2+ of
 * the rest still succeeded) from running. No browser is used anywhere in
 * this module — see fetchPageFacts.ts for what that trades off.
 */
export async function runLiveChecksForPresets(
  presets: PresetLink[],
  onItemComplete?: () => void
): Promise<MultiPresetLiveCheckResult> {
  const findings: ExecutedFinding[] = [];
  const errors: PresetLiveCheckError[] = [];
  const presetFacts: PresetFacts[] = [];

  const results = await mapWithConcurrency(presets, FETCH_CONCURRENCY_LIMIT, async (preset) => {
    try {
      const outcome = await runChecksForPreset(preset.label, preset.url);
      return { ok: true as const, preset, outcome };
    } catch (err) {
      return { ok: false as const, preset, error: err instanceof Error ? err.message : String(err) };
    } finally {
      onItemComplete?.();
    }
  });

  for (const result of results) {
    if (result.ok) {
      findings.push(...result.outcome.findings);
      presetFacts.push({ label: result.preset.label, home: result.outcome.home, product: result.outcome.product });
    } else {
      errors.push({ label: result.preset.label, url: result.preset.url, error: result.error });
    }
  }

  if (presetFacts.length >= 2) {
    findings.push(...comparePresets(presetFacts));
    findings.push(...presetOverlapFindings(presetFacts.map((p) => ({ label: p.label, url: p.home.url, content: p.home.content }))));
  }

  return { findings, errors };
}
