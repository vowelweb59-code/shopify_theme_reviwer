import { Schema, model, models, type InferSchemaType } from "mongoose";

// The one Google account the app reads Google Ads with (see lib/ads/googleAds.ts).
// A singleton row (`key: "ads"`). Tokens are encrypted with the same key as the
// GA4 connections (lib/analytics/crypto.ts) and `select: false`.
const adsConnectionSchema = new Schema(
  {
    key: { type: String, required: true, default: "ads" },
    googleAccountId: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    encryptedAccessToken: { type: String, default: null, select: false },
    encryptedRefreshToken: { type: String, default: null, select: false },
    tokenExpiresAt: { type: Date, default: null },
    scopes: { type: [String], default: () => [] },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

adsConnectionSchema.index({ key: 1 }, { unique: true });

export type AdsConnectionDoc = InferSchemaType<typeof adsConnectionSchema>;

export const AdsConnection = models.AdsConnection ?? model("AdsConnection", adsConnectionSchema);
