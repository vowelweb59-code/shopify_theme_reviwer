import type { ExecutedFinding } from "../runRules";
import { fetchPageFacts, type PageFacts } from "./fetchPageFacts";
import { homepageFindings, productPageFindings } from "./structuralFindings";
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
async function runChecksForPreset(label: string, demoStoreUrl: string): Promise<PresetCheckOutcome> {
  const homeFacts = await fetchPageFacts(demoStoreUrl);
  const findings = homepageFindings(homeFacts).map((f) => ({ ...f, presetLabel: label }));

  let productFacts: PageFacts | undefined;
  if (homeFacts.firstProductLink) {
    try {
      productFacts = await fetchPageFacts(homeFacts.firstProductLink);
      findings.push(...productPageFindings(productFacts).map((f) => ({ ...f, presetLabel: label })));
    } catch {
      // Product page fetch failing doesn't invalidate the homepage
      // findings already collected — skip it and move on.
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

  if (presetFacts.length >= 2) findings.push(...comparePresets(presetFacts));

  return { findings, errors };
}
