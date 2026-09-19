// A single "how urgently does this theme need attention" score (0-100,
// higher = more urgent) blending four signals per the weights the user
// asked for: 40% days since the theme's last Theme Store release, 30%
// feature coverage, 20% Core Web Vitals (desktop+mobile performance
// averaged), 10% future-update opportunities. Each of the last three is a
// coverage percentage (0-100, higher = better) — inverted here (100 -
// score) so a LOW coverage score contributes HIGH urgency, matching what
// "days since update" already means on its own scale.
//
// Any signal without data yet (no Theme Store check, no completed audit)
// is left out of the weighted average rather than counted as 0% urgency —
// a theme that simply hasn't been checked yet shouldn't look falsely
// "up to date" next to one that's actually been verified fresh. A theme
// with NO signals at all gets `score: null` and sorts to the bottom.
const WEIGHTS = { days: 0.4, features: 0.3, coreWebVitals: 0.2, opportunities: 0.1 };

// Days-since-update saturates urgency at this many days — chosen as 2x the
// 90-day "stale" threshold already used for the Themes list's stale-row
// highlight, so a theme twice as overdue reads as maximally urgent on this
// factor rather than climbing forever.
const DAYS_URGENCY_SATURATION = 180;

export type UpdatePriorityInput = {
  themeStoreVersionReleasedAt: string | Date | null | undefined;
  featuresScore: number | null;
  desktopPerformanceScore: number | null;
  mobilePerformanceScore: number | null;
  opportunitiesScore: number | null;
};

export type UpdatePriorityResult = {
  score: number | null;
  daysSinceUpdate: number | null;
};

export function computeUpdatePriority(input: UpdatePriorityInput, now: Date = new Date()): UpdatePriorityResult {
  const releasedAt = input.themeStoreVersionReleasedAt ? new Date(input.themeStoreVersionReleasedAt) : null;
  const daysSinceUpdate =
    releasedAt && !Number.isNaN(releasedAt.getTime()) ? Math.floor((now.getTime() - releasedAt.getTime()) / 86_400_000) : null;

  const components: { weight: number; urgency: number }[] = [];
  if (daysSinceUpdate !== null) {
    components.push({ weight: WEIGHTS.days, urgency: Math.min(Math.max(daysSinceUpdate, 0) / DAYS_URGENCY_SATURATION, 1) * 100 });
  }
  if (input.featuresScore !== null) {
    components.push({ weight: WEIGHTS.features, urgency: 100 - input.featuresScore });
  }
  const cwvScores = [input.desktopPerformanceScore, input.mobilePerformanceScore].filter((v): v is number => v !== null);
  if (cwvScores.length > 0) {
    components.push({ weight: WEIGHTS.coreWebVitals, urgency: 100 - cwvScores.reduce((a, b) => a + b, 0) / cwvScores.length });
  }
  if (input.opportunitiesScore !== null) {
    components.push({ weight: WEIGHTS.opportunities, urgency: 100 - input.opportunitiesScore });
  }

  if (components.length === 0) return { score: null, daysSinceUpdate };

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedUrgency = components.reduce((sum, c) => sum + c.urgency * c.weight, 0) / totalWeight;
  return { score: Math.round(weightedUrgency), daysSinceUpdate };
}
