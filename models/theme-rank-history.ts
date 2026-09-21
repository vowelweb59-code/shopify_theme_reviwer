import { Schema, model, models, type InferSchemaType } from "mongoose";

// An append-only log of every rank/review snapshot ever taken — unlike
// Theme's own themeStoreRank/themeStorePresets[].rank (and their
// previousRank siblings), which only ever hold the current value plus one
// prior point, this is what actually backs the history charts on
// /themes/[themeId]/ranking. Written by two different sources sharing one
// collection: the ranking crawl (lib/themes/runRankingCheck.ts) writes
// rank/page — one row per known preset slug plus the theme's own default
// listing (presetSlug === the theme's own slug); the "Check Theme Store"
// action writes reviewCount/positivePercent, theme-level only, since
// reviews aren't preset-specific. A row from either source has nulls for
// whatever fields the other source doesn't supply — a chart reads only
// the rows where its field of interest is non-null.
const themeRankHistorySchema = new Schema({
  themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true, index: true },
  presetSlug: { type: String, required: true },
  presetName: { type: String, required: true },
  rank: { type: Number, default: null },
  page: { type: Number, default: null },
  reviewCount: { type: Number, default: null },
  positivePercent: { type: Number, default: null },
  checkedAt: { type: Date, required: true },
});

themeRankHistorySchema.index({ themeId: 1, checkedAt: 1 });

export type ThemeRankHistoryDoc = InferSchemaType<typeof themeRankHistorySchema>;

export const ThemeRankHistory = models.ThemeRankHistory ?? model("ThemeRankHistory", themeRankHistorySchema);
