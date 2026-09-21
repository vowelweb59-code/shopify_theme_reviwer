import { Schema, model, models, type InferSchemaType } from "mongoose";

// Current snapshot of a theme's (or preset's) rank under one tracked
// ThemeRankingFilter — a row exists here only when that listing was
// actually found under that filter, so "no row" is exactly "doesn't
// belong to this category," which is what drives the ranking table
// showing only matching presets when a filter is active. Unlike
// models/theme-rank-history.ts this isn't an append-only log — each
// crawl upserts in place, previousRank shifted forward the same way
// Theme's own themeStoreRank/previousRank pair works, so the "Change"
// badge still works per filtered view.
const themeFilteredRankSchema = new Schema(
  {
    filterId: { type: Schema.Types.ObjectId, ref: "ThemeRankingFilter", required: true },
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    presetSlug: { type: String, required: true },
    presetName: { type: String, required: true },
    rank: { type: Number, required: true },
    page: { type: Number, required: true },
    previousRank: { type: Number, default: null },
    checkedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

themeFilteredRankSchema.index({ filterId: 1, themeId: 1, presetSlug: 1 }, { unique: true });

export type ThemeFilteredRankDoc = InferSchemaType<typeof themeFilteredRankSchema>;

export const ThemeFilteredRank = models.ThemeFilteredRank ?? model("ThemeFilteredRank", themeFilteredRankSchema);
