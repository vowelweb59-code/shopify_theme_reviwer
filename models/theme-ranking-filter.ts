import { Schema, model, models, type InferSchemaType } from "mongoose";

// One row per distinct Sort + Collection combination the user has ever
// selected on the ranking table's filter controls — registering a
// combination here is what makes it a "tracked" filter, picked up by
// lib/themes/rankingScheduler.ts's daily tick alongside the default
// (unfiltered) crawl, per explicit product decision: filtered views stay
// fresh automatically, not just on the moment someone picks them.
const themeRankingFilterSchema = new Schema(
  {
    sortBy: { type: String, enum: ["relevance", "newest"], default: "relevance" },
    // null = no industry/collection filter, i.e. sort-only.
    industry: { type: String, default: null },
    lastCheckedAt: { type: Date, default: null },
    nextCheckAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

themeRankingFilterSchema.index({ sortBy: 1, industry: 1 }, { unique: true });

export type ThemeRankingFilterDoc = InferSchemaType<typeof themeRankingFilterSchema>;

export const ThemeRankingFilter = models.ThemeRankingFilter ?? model("ThemeRankingFilter", themeRankingFilterSchema);
