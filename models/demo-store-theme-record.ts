import { Schema, model, models, type InferSchemaType } from "mongoose";

// One row per continuous period a given theme (identified by its Shopify
// theme id) was the live/published theme on the ops demo store
// (theme-store-ops-admin.myshopify.com) — endedAt stays null while it's
// still the current live theme. Populated by hourly polling (see
// lib/demoStore/scheduler.ts) of the storefront's publicly embedded theme
// info. The storefront never says when a theme was published, so each
// switch is pinned between two checks (lib/demoStore/liveWindow.ts):
//   went live: after startedAfter, by startedAt (first check that saw it)
//   went off:  after lastSeenAt,   by endedAt   (first check that saw the next theme)
const demoStoreThemeRecordSchema = new Schema(
  {
    shopifyThemeId: { type: Number, required: true },
    themeName: { type: String, required: true },
    schemaName: { type: String, default: null },
    schemaVersion: { type: String, default: null },
    startedAt: { type: Date, required: true },
    // The last successful check that still saw the *previous* theme — the
    // switch happened after this. null = unknown (the first theme ever
    // recorded, or a record from before hourly checking).
    startedAfter: { type: Date, default: null },
    // The last check that saw this theme live. null on records from before
    // hourly checking, where the end time is only known to within a day.
    lastSeenAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    // Whether this theme (by shopifyThemeId) has since been spotted on the
    // *public* Shopify Theme Store listing (themes.shopify.com) — a theme
    // seen live on the internal ops demo store is often still unreleased,
    // and this flags the moment it ships publicly. null = not checked yet,
    // false = checked but not found there (yet). See
    // lib/demoStore/checkThemeStoreListings.ts, run as part of every daily
    // check (and manual "Check Now") alongside the demo-store poll itself.
    // Never flipped back to false/null once true — a listing disappearing
    // from the store isn't something this app tries to detect.
    themeStoreListed: { type: Boolean, default: null },
    themeStoreSlug: { type: String, default: null },
    themeStoreCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type DemoStoreThemeRecordDoc = InferSchemaType<typeof demoStoreThemeRecordSchema>;

export const DemoStoreThemeRecord = models.DemoStoreThemeRecord ?? model("DemoStoreThemeRecord", demoStoreThemeRecordSchema);
