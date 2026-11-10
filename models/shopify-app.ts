import { Schema, model, models, type InferSchemaType } from "mongoose";

// One row per app on the public Shopify App Store, whoever made it. Filled by
// lib/shopifyApps/crawlApps.ts; classified into merchant-lifecycle stages at read
// time (lib/shopifyApps/lifecycle.ts), so changing the mapping needs no re-read.
const shopifyAppSchema = new Schema(
  {
    handle: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tagline: { type: String, default: null },
    /** null = no reviews yet. */
    rating: { type: Number, default: null },
    reviewCount: { type: Number, default: 0 },
    pricingLabel: { type: String, default: null },
    builtForShopify: { type: Boolean, default: false },
    /** Slugs of the (leaf) App Store categories the app is listed in. */
    categories: { type: [String], default: [] },
    /** From the app's own page; null until the details step has read it. */
    developer: { type: String, default: null },
    launchedAt: { type: String, default: null },
    /** % of ratings at 1…5 stars. */
    ratingShares: { type: [Number], default: null },
    detailAt: { type: Date, default: null },
    detailError: { type: String, default: null },
    /** Which version of the detail reader filled this app; apps below the current one are re-read (lib/shopifyApps/crawlApps.ts). */
    detailVersion: { type: Number, default: 0 },
    /** The listing's own short description. */
    description: { type: String, default: null },
    /** Feature handles the app ticks ("cf.faq.display_options.search_bar"); labels live in ShopifyAppFeature. */
    features: { type: [String], default: [] },
    plans: {
      type: [new Schema({ name: String, price: { type: String, default: null }, note: { type: String, default: null }, features: { type: [String], default: [] } }, { _id: false })],
      default: [],
    },
    languages: { type: [String], default: [] },
    worksWith: { type: [String], default: [] },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export type ShopifyAppDoc = InferSchemaType<typeof shopifyAppSchema>;

export const ShopifyApp = models.ShopifyApp ?? model("ShopifyApp", shopifyAppSchema);

// The App Store's category tree, one row per category read (leaf categories hold the apps).
const shopifyAppCategorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    leaf: { type: Boolean, default: true },
    /** Watched: its apps are re-read weekly (others monthly) and before any other app. FAQ is watched from the start. */
    priority: { type: Boolean, default: false },
    /** When the Read-this-category action last finished for it. */
    lastReadAt: { type: Date, default: null },
  },
  { timestamps: false }
);

export const ShopifyAppCategory = models.ShopifyAppCategory ?? model("ShopifyAppCategory", shopifyAppCategorySchema);

// The catalog of features App Store listings tick, keyed by Shopify's stable handle ("cf.faq.display_options.search_bar").
const shopifyAppFeatureSchema = new Schema(
  {
    handle: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    /** "Display options" */
    group: { type: String, required: true },
    /** The handle's category key ("faq", "bulk_editor"); matches the last words of a category slug. */
    categoryKey: { type: String, required: true, index: true },
  },
  { timestamps: false }
);

export const ShopifyAppFeature = models.ShopifyAppFeature ?? model("ShopifyAppFeature", shopifyAppFeatureSchema);
