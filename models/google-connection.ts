import { Schema, model, models, type InferSchemaType } from "mongoose";

// One row per connected Google account for GA4 analytics — many accounts,
// each owning different themes' GA4 properties. Deliberately separate from
// models/google-auth.ts (the Sheets-export singleton), which keeps working
// untouched: different scopes, different lifecycle, and a new connect here
// must never replace another account's row the way that singleton does.
//
// Tokens are stored encrypted (lib/analytics/crypto.ts) and are
// `select: false` so a stray find() in an API route can't leak them. A
// transient refresh failure (network, Google 5xx) doesn't change status —
// it only sets lastError, since retrying may simply work.
export const GOOGLE_CONNECTION_STATUSES = [
  "active", // tokens valid (or refreshable)
  // Google rejected the refresh token (invalid_grant): access removed in the
  // Google account, password change, or a Testing-mode consent screen's
  // 7-day token expiry — all look identical, all need a reconnect.
  "revoked",
  "error", // anything else permanent, e.g. the analytics scope wasn't granted
  "disconnected", // disconnected from this app; kept so mapped themes keep their history
] as const;

const googleConnectionSchema = new Schema(
  {
    // Google's stable account id (the OIDC "sub" claim) — unlike email it
    // never changes, so it's the identity a reconnect matches on.
    googleAccountId: { type: String, required: true },
    email: { type: String, required: true },
    displayName: { type: String, default: null },
    status: { type: String, enum: GOOGLE_CONNECTION_STATUSES, required: true, default: "active" },
    encryptedAccessToken: { type: String, default: null, select: false },
    encryptedRefreshToken: { type: String, default: null, select: false },
    tokenExpiresAt: { type: Date, default: null },
    scopes: { type: [String], default: () => [] },
    connectedAt: { type: Date, default: null },
    lastRefreshedAt: { type: Date, default: null },
    lastValidatedAt: { type: Date, default: null },
    disconnectedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

googleConnectionSchema.index({ googleAccountId: 1 }, { unique: true });
googleConnectionSchema.index({ status: 1 });

export type GoogleConnectionDoc = InferSchemaType<typeof googleConnectionSchema>;

export const GoogleConnection = models.GoogleConnection ?? model("GoogleConnection", googleConnectionSchema);
