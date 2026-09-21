import { Schema, model, models, type InferSchemaType } from "mongoose";

// Singleton document (one row, ever — same pattern as
// models/demo-store-check-state.ts) tracking the automatic daily Theme
// Store ranking crawl. See lib/themes/rankingScheduler.ts.
const themeRankingCheckStateSchema = new Schema(
  {
    lastCheckedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    nextCheckAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type ThemeRankingCheckStateDoc = InferSchemaType<typeof themeRankingCheckStateSchema>;

export const ThemeRankingCheckState = models.ThemeRankingCheckState ?? model("ThemeRankingCheckState", themeRankingCheckStateSchema);
