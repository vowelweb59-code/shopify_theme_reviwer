import { pricingModel, type PricingModel } from "./parseApps";
import { STAGES, stageOfCategory, type StageKey } from "./lifecycle";
import { TOPIC_LABEL, topicsOfApp } from "./topics";

// Turns the apps read from the App Store into "where is there room for a new app" numbers, per category
// (the job an app does) and per lifecycle stage. Pure: takes plain rows, returns plain data.
//
// Reviews stand in for demand (only a small share of installs leave one, but the share is similar across
// categories). Every sub-score is a percentile rank *among categories* rather than an absolute threshold —
// App Store ratings bunch at 4.5–5.0, so "4.4" only means something compared with the other categories.

export type AppRow = {
  handle: string;
  name: string;
  tagline?: string | null;
  rating: number | null;
  reviewCount: number;
  pricingLabel: string | null;
  builtForShopify: boolean;
  categories: string[];
  developer: string | null;
  launchedAt: string | null;
  ratingShares: number[] | null;
};

export type CategoryRow = { slug: string; label: string };

/** How finely apps are grouped: Shopify's category; a niche (category › topic); or a topic across all categories. */
export type Level = "category" | "niche" | "topic";

type Group = { label: string; stage: StageKey; apps: AppRow[] };

function groupApps(apps: AppRow[], categories: CategoryRow[], level: Level): Map<string, Group> {
  const labelOf = new Map(categories.map((c) => [c.slug, c.label]));
  const groups = new Map<string, Group>();
  const add = (key: string, label: string, stage: StageKey, app: AppRow) => {
    const g = groups.get(key) ?? { label, stage, apps: [] };
    g.apps.push(app);
    groups.set(key, g);
  };
  const stageVotes = new Map<string, Map<StageKey, number>>();
  for (const app of apps) {
    const topics = level === "category" ? [] : topicsOfApp(app.name, app.tagline ?? null);
    for (const slug of app.categories) {
      const catLabel = labelOf.get(slug) ?? slug;
      const stage = stageOfCategory(slug);
      if (level === "category") add(slug, catLabel, stage, app);
      for (const topic of topics) {
        if (level === "niche") add(`${slug}::${topic}`, `${catLabel} › ${TOPIC_LABEL[topic]}`, stage, app);
        if (level === "topic") {
          // A topic's stage is the one most of its apps' categories sit in.
          const votes = stageVotes.get(topic) ?? new Map<StageKey, number>();
          votes.set(stage, (votes.get(stage) ?? 0) + 1);
          stageVotes.set(topic, votes);
        }
      }
    }
    if (level === "topic") for (const topic of topics) add(`topic::${topic}`, TOPIC_LABEL[topic], "scale", app);
  }
  if (level === "topic") {
    for (const [key, g] of groups) {
      const votes = [...(stageVotes.get(key.slice("topic::".length)) ?? [])].sort((a, b) => b[1] - a[1]);
      if (votes[0]) g.stage = votes[0][0];
      // An app listed in several categories was counted once per category above; the group holds it once.
      g.apps = [...new Set(g.apps)];
    }
  }
  return groups;
}

export const MIN_APPS_FOR_SCORE = 5;
export const WEIGHTS = { demand: 0.3, weakness: 0.25, openness: 0.25, headroom: 0.2 } as const;
const LEADERS = 5;
const BREAKOUT_MIN_REVIEWS = 25;
const BREAKOUT_MAX_AGE_MONTHS = 24;

export type PricingMix = Record<PricingModel, number>;

export type CategoryInsight = {
  slug: string;
  label: string;
  stage: StageKey;
  apps: number;
  reviews: number;
  /** Reviews per app: how much demand each competitor shares. */
  reviewsPerApp: number;
  /** Review-weighted rating of the LEADERS most-reviewed apps; null if none has reviews. */
  leaderRating: number | null;
  /** Review-weighted % of 1–2 star ratings among apps whose page was read; null if none was. */
  lowStarShare: number | null;
  /** Share of the category's reviews held by its 3 most-reviewed apps. */
  top3Share: number;
  /** Share of the 10 most-reviewed apps carrying the Built for Shopify badge. */
  bfsShare: number;
  /** Apps launched within 24 months that already have BREAKOUT_MIN_REVIEWS reviews: proof a newcomer can win here. Counts only apps whose page was read. */
  breakouts: number;
  /** Apps launched in the last 12 months (page read only). */
  launches12m: number;
  pricing: PricingMix;
  /** 0–100; null when the category has fewer than MIN_APPS_FOR_SCORE apps. */
  gap: number | null;
  components: { demand: number; weakness: number; openness: number; headroom: number } | null;
  reasons: string[];
  topApps: { handle: string; name: string; rating: number | null; reviewCount: number }[];
};

export type StageInsight = {
  key: StageKey;
  label: string;
  question: string;
  apps: number;
  reviews: number;
  categories: number;
  /** Best (highest-gap) category in the stage. */
  best: { slug: string; label: string; gap: number } | null;
  /** Apps launched per calendar year (page read only), keyed by year. */
  launchesByYear: Record<string, number>;
  pricing: PricingMix;
};

export type Analytics = {
  categories: CategoryInsight[];
  stages: StageInsight[];
  coverage: { apps: number; withDetails: number };
  /** Years that have at least one launch, ascending. */
  launchYears: number[];
};

const emptyMix = (): PricingMix => ({ free: 0, freemium: 0, trial: 0, paid: 0, unknown: 0 });

/** Percentile rank of each value among the non-null ones (0 = lowest, 1 = highest; ties share their average rank). Null stays null. */
export function percentileRanks(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (present.length < 2) return values.map((v) => (v === null ? null : 0.5));
  return values.map((v) => {
    if (v === null) return null;
    const first = present.indexOf(v);
    const last = present.lastIndexOf(v);
    return (first + last) / 2 / (present.length - 1);
  });
}

const weightedMean = (pairs: [number, number][]) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  return total > 0 ? pairs.reduce((s, [v, w]) => s + v * w, 0) / total : null;
};

const monthsBetween = (iso: string, now: Date) => {
  const d = new Date(iso);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
};

function mixOf(apps: AppRow[]): PricingMix {
  const mix = emptyMix();
  for (const a of apps) mix[pricingModel(a.pricingLabel)]++;
  return mix;
}

function basics(slug: string, label: string, stage: StageKey, apps: AppRow[], now: Date): CategoryInsight {
  const byReviews = [...apps].sort((a, b) => b.reviewCount - a.reviewCount);
  const reviews = apps.reduce((s, a) => s + a.reviewCount, 0);
  const leaders = byReviews.slice(0, LEADERS).filter((a) => a.rating !== null && a.reviewCount > 0);
  const withShares = apps.filter((a) => a.ratingShares && a.reviewCount > 0);
  const detailed = apps.filter((a) => a.launchedAt);
  return {
    slug,
    label,
    stage,
    apps: apps.length,
    reviews,
    reviewsPerApp: apps.length ? reviews / apps.length : 0,
    leaderRating: weightedMean(leaders.map((a) => [a.rating as number, a.reviewCount])),
    lowStarShare: weightedMean(withShares.map((a) => [a.ratingShares![0] + a.ratingShares![1], a.reviewCount])),
    top3Share: reviews > 0 ? byReviews.slice(0, 3).reduce((s, a) => s + a.reviewCount, 0) / reviews : 0,
    bfsShare: byReviews.length ? byReviews.slice(0, 10).filter((a) => a.builtForShopify).length / Math.min(10, byReviews.length) : 0,
    breakouts: detailed.filter((a) => monthsBetween(a.launchedAt!, now) <= BREAKOUT_MAX_AGE_MONTHS && a.reviewCount >= BREAKOUT_MIN_REVIEWS).length,
    launches12m: detailed.filter((a) => monthsBetween(a.launchedAt!, now) <= 12).length,
    pricing: mixOf(apps),
    gap: null,
    components: null,
    reasons: [],
    topApps: byReviews.slice(0, LEADERS).map((a) => ({ handle: a.handle, name: a.name, rating: a.rating, reviewCount: a.reviewCount })),
  };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function computeAnalytics(apps: AppRow[], categories: CategoryRow[], now: Date = new Date(), level: Level = "category"): Analytics {
  // A niche or topic needs enough apps to say anything; thinner ones are left out rather than shown unscored.
  const insights = [...groupApps(apps, categories, level)]
    .filter(([, g]) => level === "category" || g.apps.length >= MIN_APPS_FOR_SCORE)
    .map(([slug, g]) => basics(slug, g.label, g.stage, [...new Set(g.apps)], now));
  const scored = insights.filter((c) => c.apps >= MIN_APPS_FOR_SCORE);

  const demand = percentileRanks(scored.map((c) => c.reviews));
  const headroom = percentileRanks(scored.map((c) => c.reviewsPerApp));
  const weakRating = percentileRanks(scored.map((c) => (c.leaderRating === null ? null : -c.leaderRating)));
  const weakLowStar = percentileRanks(scored.map((c) => c.lowStarShare));
  const lowConcentration = percentileRanks(scored.map((c) => -c.top3Share));
  const newcomers = percentileRanks(scored.map((c) => c.breakouts));
  const lowBadge = percentileRanks(scored.map((c) => -c.bfsShare));

  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0.5;
  };

  scored.forEach((c, i) => {
    const components = {
      demand: demand[i] ?? 0.5,
      weakness: mean([weakRating[i], weakLowStar[i]]),
      openness: mean([lowConcentration[i], newcomers[i], lowBadge[i]]),
      headroom: headroom[i] ?? 0.5,
    };
    c.components = components;
    c.gap = Math.round(100 * (WEIGHTS.demand * components.demand + WEIGHTS.weakness * components.weakness + WEIGHTS.openness * components.openness + WEIGHTS.headroom * components.headroom));
    const reasons: string[] = [];
    if (components.demand >= 0.7) reasons.push(`High demand: ${c.reviews.toLocaleString()} reviews, more than ${pct(components.demand)} of categories`);
    if (components.headroom >= 0.7) reasons.push(`Each app shares a lot of demand (${Math.round(c.reviewsPerApp).toLocaleString()} reviews per app)`);
    if (weakRating[i] !== null && weakRating[i]! >= 0.7) reasons.push(`Leaders are rated only ${c.leaderRating!.toFixed(2)}★`);
    if (weakLowStar[i] !== null && weakLowStar[i]! >= 0.7) reasons.push(`${c.lowStarShare!.toFixed(1)}% of reviews are 1–2 stars`);
    if (lowConcentration[i] !== null && lowConcentration[i]! >= 0.7) reasons.push(`No lock-in: top 3 apps hold just ${pct(c.top3Share)} of reviews`);
    if (c.breakouts >= 2 && (newcomers[i] ?? 0) >= 0.7) reasons.push(`${c.breakouts} apps under 2 years old already have ${BREAKOUT_MIN_REVIEWS}+ reviews`);
    if (c.bfsShare === 0 && c.apps >= 10) reasons.push("No Built for Shopify app among the leaders");
    c.reasons = reasons;
  });

  const stages: StageInsight[] = STAGES.map((s) => {
    const inStage = insights.filter((c) => c.stage === s.key);
    const stageApps = apps.filter((a) => a.categories.some((slug) => stageOfCategory(slug) === s.key));
    const launchesByYear: Record<string, number> = {};
    for (const a of stageApps) if (a.launchedAt) launchesByYear[a.launchedAt.slice(0, 4)] = (launchesByYear[a.launchedAt.slice(0, 4)] ?? 0) + 1;
    const best = inStage.filter((c) => c.gap !== null).sort((a, b) => b.gap! - a.gap!)[0];
    return {
      key: s.key,
      label: s.label,
      question: s.question,
      apps: stageApps.length,
      reviews: stageApps.reduce((sum, a) => sum + a.reviewCount, 0),
      categories: inStage.length,
      best: best ? { slug: best.slug, label: best.label, gap: best.gap! } : null,
      launchesByYear,
      pricing: mixOf(stageApps),
    };
  });

  const years = new Set<number>();
  for (const a of apps) if (a.launchedAt) years.add(Number(a.launchedAt.slice(0, 4)));

  return {
    categories: insights.sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1) || b.reviews - a.reviews),
    stages,
    coverage: { apps: apps.length, withDetails: apps.filter((a) => a.launchedAt).length },
    launchYears: [...years].sort((a, b) => a - b),
  };
}
