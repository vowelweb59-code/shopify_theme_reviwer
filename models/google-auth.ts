import { Schema, model, models, type InferSchemaType } from "mongoose";

// Singleton document holding the OAuth tokens for the one Google account
// this internal tool is connected to (Sheets export). accessToken +
// expiryDate are refreshed automatically via refreshToken — see
// lib/google/oauth.ts's getAuthorizedClient(), which persists a refreshed
// accessToken back here so the next call doesn't re-hit the token endpoint
// unnecessarily.
const googleAuthSchema = new Schema(
  {
    googleEmail: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiryDate: { type: Number, required: true },
    scope: { type: String, required: true },
  },
  { timestamps: true }
);

export type GoogleAuthDoc = InferSchemaType<typeof googleAuthSchema>;

export const GoogleAuth = models.GoogleAuth ?? model("GoogleAuth", googleAuthSchema);
