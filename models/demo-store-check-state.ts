import { Schema, model, models, type InferSchemaType } from "mongoose";

// Singleton document (one row, ever — same pattern as models/google-auth.ts)
// tracking the automatic daily check of the ops demo store's live theme.
// See lib/demoStore/scheduler.ts.
const demoStoreCheckStateSchema = new Schema(
  {
    lastCheckedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    nextCheckAt: { type: Date, required: true },
    // Per store (lib/demoStore/stores.ts); the top-level lastCheckedAt /
    // lastError above hold the admin store's, from before multi-store tracking.
    storeChecks: {
      type: [{ store: String, lastCheckedAt: { type: Date, default: null }, lastError: { type: String, default: null } }],
      default: [],
      _id: false,
    },
  },
  { timestamps: true }
);

export type DemoStoreCheckStateDoc = InferSchemaType<typeof demoStoreCheckStateSchema>;

export const DemoStoreCheckState = models.DemoStoreCheckState ?? model("DemoStoreCheckState", demoStoreCheckStateSchema);
