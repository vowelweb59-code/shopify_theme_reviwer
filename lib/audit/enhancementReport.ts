// Joins the full EnhancementPoint catalog against one audit run's stored
// per-theme detection results (AuditRun.enhancementDetections). Shared by
// app/api/reports/[id]/route.ts (the on-screen "Future updates" report tab)
// and app/api/reports/[id]/export/google-sheet/route.ts (the same data as
// a sheet tab) so the two never drift apart on what "detected" means for a
// given point.
export type EnhancementDetectionRecord = {
  pointId: string;
  detected: boolean;
  matches?: { filePath: string; lineNumber: number | null }[];
};

export type EnhancementReportPoint<T> = T & {
  detected: boolean | null;
  matches: { filePath: string; lineNumber: number | null }[];
};

/**
 * `detected` is null when this run has no detection entry for a point —
 * either the whole run predates the detection feature (see
 * `detectionAvailable`), or the point itself was added after this run
 * already happened. Both cases render the same way downstream: "not yet
 * checked", never silently absent.
 */
export function buildEnhancementReportForRun<T extends { pointId: string; themeCount?: number | null }>(
  enhancementDetections: EnhancementDetectionRecord[] | undefined,
  enhancementPoints: T[]
): { points: EnhancementReportPoint<T>[]; detectionAvailable: boolean } {
  const detectionAvailable = Array.isArray(enhancementDetections);
  const detectionByPointId = new Map((enhancementDetections ?? []).map((d) => [d.pointId, d]));

  const points = enhancementPoints
    .map((p) => {
      const detection = detectionByPointId.get(p.pointId);
      return { ...p, detected: detection?.detected ?? null, matches: detection?.matches ?? [] };
    })
    .sort((a, b) => (b.themeCount ?? -1) - (a.themeCount ?? -1));

  return { points, detectionAvailable };
}
