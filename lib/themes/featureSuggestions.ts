import { AVAILABLE_FEATURES, featureSources, featureStatus, type AvailableFeature, type FeatureSources, type FeatureStatus } from "@/lib/audit/availableFeatures";

export type ThemeFeatureInput = {
  name: string;
  themeStoreFeatures?: string[];
  detections?: { pointId: string; detected: boolean }[];
  /** Feature ids the live demo stores showed on the latest audit; undefined when no demo store was read. */
  liveFeatures?: string[];
};

export type FeatureCell = { status: FeatureStatus; sources: FeatureSources };

/** One theme's evidence for every catalog feature. */
export function featureCells(theme: ThemeFeatureInput): Map<string, FeatureCell> {
  const detections = new Map((theme.detections ?? []).map((d) => [d.pointId, d.detected]));
  const labels = theme.themeStoreFeatures ? new Set(theme.themeStoreFeatures.map((l) => l.toLowerCase())) : undefined;
  const live = theme.liveFeatures ? new Set(theme.liveFeatures) : undefined;
  return new Map(
    AVAILABLE_FEATURES.map((f) => [f.id, { status: featureStatus(f, detections, labels, live), sources: featureSources(f, detections, labels, live) }])
  );
}

/** A theme has the feature when any source confirms it (the orange "conflict" counts as having it: the listing or code says yes). */
export function hasFeature(cell: FeatureCell | undefined): boolean {
  return cell?.status === "detected" || cell?.status === "conflict";
}

export type FeatureGap = {
  feature: AvailableFeature;
  /** Themes that do not have it. */
  missing: string[];
  /** Themes that do. */
  have: string[];
};

/**
 * Features to add across the portfolio, most widespread gap first: a feature at least one theme lacks, ranked by how many themes
 * lack it, then by how many have it (a feature most themes already ship is a proven one). Features every theme has are left out.
 */
export function portfolioSuggestions(themes: ThemeFeatureInput[], limit = 12): FeatureGap[] {
  const cells = themes.map(featureCells);
  return AVAILABLE_FEATURES.map((feature) => {
    const missing: string[] = [];
    const have: string[] = [];
    themes.forEach((t, i) => (hasFeature(cells[i].get(feature.id)) ? have : missing).push(t.name));
    return { feature, missing, have };
  })
    .filter((g) => g.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length || b.have.length - a.have.length || a.feature.label.localeCompare(b.feature.label))
    .slice(0, limit);
}

export type ThemeGaps = { theme: string; total: number; gaps: { feature: AvailableFeature; haveCount: number }[] };

/**
 * Per theme: the features it lacks, ordered by how many of the other themes already have them (catch-up first). `limit` caps the
 * list shown per theme; `total` is the full count of what it lacks.
 */
export function suggestionsByTheme(themes: ThemeFeatureInput[], limit = 8): ThemeGaps[] {
  const cells = themes.map(featureCells);
  const haveCount = new Map(AVAILABLE_FEATURES.map((f) => [f.id, cells.filter((c) => hasFeature(c.get(f.id))).length]));
  return themes
    .map((t, i) => {
      const gaps = AVAILABLE_FEATURES.filter((f) => !hasFeature(cells[i].get(f.id)))
        .map((feature) => ({ feature, haveCount: haveCount.get(feature.id) ?? 0 }))
        .sort((a, b) => b.haveCount - a.haveCount || a.feature.label.localeCompare(b.feature.label));
      return { theme: t.name, total: gaps.length, gaps: gaps.slice(0, limit) };
    })
    .sort((a, b) => b.total - a.total || a.theme.localeCompare(b.theme));
}
