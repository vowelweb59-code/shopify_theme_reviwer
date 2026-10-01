import { Schema, model, models, type InferSchemaType } from "mongoose";

export const PARTNER_TIERS = ["platinum", "plus", "premier", "select"] as const;

// A Shopify partner (agency / freelancer) from the public Partner Directory,
// kept as a pool of potential affiliates. One row per directory profile slug.
const shopifyPartnerSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    rating: { type: Number, default: null },
    reviewCount: { type: Number, default: null },
    /** The location line as the directory shows it. */
    location: { type: String, default: null },
    /** Country slugs whose directory page lists this partner (a partner can serve several). */
    countrySlugs: { type: [String], default: [] },
    /** Directory tier (platinum / plus / premier / select); null = untiered. */
    tier: { type: String, enum: [...PARTNER_TIERS, null], default: null },
    startingPrice: { type: Number, default: null },
    services: { type: [String], default: [] },
    moreServices: { type: Number, default: 0 },
    firstSeenAt: { type: Date, default: Date.now },
    /** Updated on every crawl that still finds the partner. */
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

shopifyPartnerSchema.index({ countrySlugs: 1, reviewCount: -1 });

export type ShopifyPartnerDoc = InferSchemaType<typeof shopifyPartnerSchema>;

export const ShopifyPartner = models.ShopifyPartner ?? model("ShopifyPartner", shopifyPartnerSchema);
