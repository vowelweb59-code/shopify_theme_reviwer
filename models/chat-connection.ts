import { Schema, model, models, type InferSchemaType } from "mongoose";

// The one Google account the app reads the Theme Status Group space with
// (see lib/chat/googleChat.ts). A singleton row (`key: "chat"`): there is one
// space, so there is one connection. Tokens are encrypted with the same key
// as the GA4 connections (lib/analytics/crypto.ts) and `select: false`, so a
// stray find() can't leak them.
const chatConnectionSchema = new Schema(
  {
    key: { type: String, required: true, default: "chat" },
    googleAccountId: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    encryptedAccessToken: { type: String, default: null, select: false },
    encryptedRefreshToken: { type: String, default: null, select: false },
    tokenExpiresAt: { type: Date, default: null },
    scopes: { type: [String], default: () => [] },
    // Only messages newer than this are fetched on the next sync.
    lastMessageAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

chatConnectionSchema.index({ key: 1 }, { unique: true });

export type ChatConnectionDoc = InferSchemaType<typeof chatConnectionSchema>;

export const ChatConnection = models.ChatConnection ?? model("ChatConnection", chatConnectionSchema);
