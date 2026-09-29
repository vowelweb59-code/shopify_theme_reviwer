import { Schema, model, models, type InferSchemaType } from "mongoose";

// The one main Theme Store category (industry slug, see
// lib/themes/industries.ts) each preset's sales are counted under on the
// Sales page — the user's choice over counting a sale in every category
// its preset is listed in. `suggested` comes from the ranking crawls (the
// category where the preset ranks best); `manual` is the user's override.
const presetCategorySchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    presetName: { type: String, required: true },
    suggested: { type: String, default: null },
    manual: { type: String, default: null },
  },
  { timestamps: true }
);

presetCategorySchema.index({ themeId: 1, presetName: 1 }, { unique: true });

export type PresetCategoryDoc = InferSchemaType<typeof presetCategorySchema>;

export const PresetCategory = models.PresetCategory ?? model("PresetCategory", presetCategorySchema);
