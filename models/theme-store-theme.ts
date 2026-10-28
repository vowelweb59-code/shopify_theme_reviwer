import { Schema, model, models, type InferSchemaType } from "mongoose";

// One row per theme (base listing slug) on the public Shopify Theme Store,
// whoever made it — distinct from models/theme.ts, which is the user's own
// themes. Filled by lib/themeStore/crawlCatalog.ts.
const themeStoreThemeSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    /** USD; 0 = free. */
    price: { type: Number, default: null },
    isNew: { type: Boolean, default: false },
    /** Presets (style variants) the theme has, the default one included. */
    presets: { type: [{ _id: false, slug: String, name: String }], default: [] },
    /** Industry collection slugs the theme (any preset) is listed in. */
    industries: { type: [String], default: [] },
    /** From the theme's own page; null until the details step has read it. */
    designer: { type: String, default: null },
    positivePercent: { type: Number, default: null },
    reviewCount: { type: Number, default: null },
    latestVersion: { type: String, default: null },
    latestVersionReleasedAt: { type: String, default: null },
    features: { type: [String], default: [] },
    /** The app add-on the theme's page suggests ("Made for your theme"); null when it suggests none. */
    companionApp: { type: { _id: false, name: String, subtitle: { type: String, default: null }, url: String, pricing: { type: String, default: null } }, default: null },
    /** When the theme's page was last checked for companionApp (null = not yet, so the next refresh reads the page again). */
    companionAppAt: { type: Date, default: null },
    detailAt: { type: Date, default: null },
    detailError: { type: String, default: null },
    /** Position of the default preset's card in the store's default order (1 = first). */
    rank: { type: Number, default: null },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export type ThemeStoreThemeDoc = InferSchemaType<typeof themeStoreThemeSchema>;

export const ThemeStoreTheme = models.ThemeStoreTheme ?? model("ThemeStoreTheme", themeStoreThemeSchema);
