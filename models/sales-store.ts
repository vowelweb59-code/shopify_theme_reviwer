import { Schema, model, models, type InferSchemaType } from "mongoose";

export const STORE_STATUSES = ["pending", "live", "password", "unavailable", "dropped", "error"] as const;
export const PRESET_SOURCES = ["theme_name", "sheet", "manual", "none"] as const;

// What each store that bought a theme is running now, read from its public
// storefront (`Shopify.theme`), and which preset its sales count under.
// One row per shop domain + theme.
const salesStoreSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    shopDomain: { type: String, required: true, lowercase: true, trim: true },
    /** live / password: the store still runs this theme; dropped: it switched to another theme. */
    status: { type: String, enum: STORE_STATUSES, default: "pending" },
    liveUrl: { type: String, default: null },
    liveThemeName: { type: String, default: null },
    liveSchemaName: { type: String, default: null },
    /** Preset detected automatically (from the live theme name, else the sheet). */
    detectedPreset: { type: String, default: null },
    detectedSource: { type: String, enum: PRESET_SOURCES, default: "none" },
    /** Set by hand on the Sales page; wins over detection. */
    manualPreset: { type: String, default: null },
    checkedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

salesStoreSchema.index({ themeId: 1, shopDomain: 1 }, { unique: true });
salesStoreSchema.index({ status: 1, checkedAt: 1 });

export type SalesStoreDoc = InferSchemaType<typeof salesStoreSchema>;

export const SalesStore = models.SalesStore ?? model("SalesStore", salesStoreSchema);
