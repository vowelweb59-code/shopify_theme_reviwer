// Stable finding identity (phase-6 §4-5), shared between the re-audit diff
// (lib/audit/diffFindings.ts) and the persist-time history classification
// (lib/audit/findingHistory.ts) — both need to agree on what counts as
// "the same finding" across audit runs, so the matching logic lives in one
// place rather than being reimplemented twice and silently drifting apart.

export type DiffableFinding = {
  ruleId: string;
  category: string;
  filePath: string;
  severity: "blocker" | "high" | "medium" | "low";
  finding: string;
  layer?: "static" | "live";
};

export function normalizeMessage(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ").replace(/['"]/g, '"');
}

/** ruleId + category + filePath + normalized message — the strongest, most conservative match. */
export function exactSignature(f: DiffableFinding): string {
  return `${f.ruleId}::${f.category}::${f.filePath}::${normalizeMessage(f.finding)}`;
}

/** ruleId + category + filePath only — used as a weaker fallback (phase-6's "changed" state), never for carrying forward manual status. */
export function locationSignature(f: DiffableFinding): string {
  return `${f.ruleId}::${f.category}::${f.filePath}`;
}
