import { Schema, model, models, type InferSchemaType } from "mongoose";

// One row per continuous period a given theme (identified by its Shopify
// theme id) was the live/published theme on the ops demo store
// (theme-store-ops-admin.myshopify.com) — endedAt stays null while it's
// still the current live theme. Populated by daily polling (see
// lib/demoStore/scheduler.ts) of the storefront's publicly embedded theme
// info, so startedAt/endedAt mark when *we first/last observed* the theme,
// not necessarily the exact second it was switched in the Shopify admin.
const demoStoreThemeRecordSchema = new Schema(
  {
    shopifyThemeId: { type: Number, required: true },
    themeName: { type: String, required: true },
    schemaName: { type: String, default: null },
    schemaVersion: { type: String, default: null },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type DemoStoreThemeRecordDoc = InferSchemaType<typeof demoStoreThemeRecordSchema>;

export const DemoStoreThemeRecord = models.DemoStoreThemeRecord ?? model("DemoStoreThemeRecord", demoStoreThemeRecordSchema);
