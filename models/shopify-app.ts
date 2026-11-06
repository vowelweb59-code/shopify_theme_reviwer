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
  },
  { timestamps: false }
);

export const ShopifyAppCategory = models.ShopifyAppCategory ?? model("ShopifyAppCategory", shopifyAppCategorySchema);
