import type { ParsedFile } from "@/lib/theme-parser";
import { ENHANCEMENT_DETECTORS } from "./enhancementDetectors";

export type EnhancementMatch = { filePath: string; lineNumber: number | null };
export type EnhancementDetectionResult = { pointId: string; detected: boolean; matches: EnhancementMatch[] };

// Evidence is for "does this look present", not an exhaustive findings list —
// capped so a point that matches everywhere (a generic keyword hit) doesn't
// dump dozens of file paths into the report.
const MAX_MATCHES_PER_POINT = 3;

function firstMatchLine(rawText: string, pattern: RegExp): number | null {
  // Detectors never define patterns with the "g" flag, so .exec() here
  // always starts fresh from index 0 rather than resuming from a stale
  // lastIndex.
  const m = pattern.exec(rawText);
  if (!m) return null;
  return rawText.slice(0, m.index).split("\n").length;
}

/**
 * Runs every registered enhancement-point detector against a theme's parsed
 * source. Captured once, at audit time, onto the AuditRun (see
 * app/api/audit/run/route.ts) — the original ZIP isn't kept afterward, so
 * this is the only chance to check for these patterns.
 *
 * Deliberately independent of the rule engine: a detector failing to match
 * is not a Finding, carries no severity, and never affects coverage or
 * submission readiness. `pointIds` restricts detection to points that
 * currently exist in the EnhancementPoint collection, so a stale detector
 * left behind after a point is retired doesn't silently report on it.
 */
export function detectEnhancementPoints(files: ParsedFile[], pointIds: string[]): EnhancementDetectionResult[] {
  const wanted = new Set(pointIds);
  const relevantFiles = files.filter((f) => f.fileType !== "asset");
  const results: EnhancementDetectionResult[] = [];

  for (const detector of ENHANCEMENT_DETECTORS) {
    if (!wanted.has(detector.pointId)) continue;
    const matches: EnhancementMatch[] = [];

    for (const file of relevantFiles) {
      if (matches.length >= MAX_MATCHES_PER_POINT) break;

      const contentHit = detector.patterns?.find((re) => re.test(file.rawText));
      const pathHit = detector.pathPatterns?.some((re) => re.test(file.path));
      if (contentHit || pathHit) {
        matches.push({ filePath: file.path, lineNumber: contentHit ? firstMatchLine(file.rawText, contentHit) : null });
      }
    }

    if (matches.length < MAX_MATCHES_PER_POINT && detector.predicate) {
      const predicateFiles = detector.predicate(files) ?? [];
      for (const file of predicateFiles) {
        if (matches.length >= MAX_MATCHES_PER_POINT) break;
        if (matches.some((m) => m.filePath === file.path)) continue;
        matches.push({ filePath: file.path, lineNumber: null });
      }
    }

    results.push({ pointId: detector.pointId, detected: matches.length > 0, matches });
  }

  return results;
}
