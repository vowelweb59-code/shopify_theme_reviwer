import { Schema, model, models, type InferSchemaType } from "mongoose";

// Same shape as AuditRun's own demoStorePresetSchema (models/audit-run.ts)
// — kept as a separate literal schema rather than a shared import since
// this one means something different: the theme's own *default* preset
// URLs (e.g. its 4 style variants), not what one specific run happened to
// be checked against.
const themeDemoStorePresetSchema = new Schema({ label: { type: String, required: true }, url: { type: String, required: true } }, { _id: false });

// A Theme Store listing's own named style variants (e.g. Adorn ships as
// "Adorn", "Ace", "Choice", "Closet", "Precious") — confirmed against
// real listings: each preset gets its own sub-URL
// (/themes/<slug>/presets/<presetSlug>) AND its own separately-ranked
// card in the public "/themes" catalog, scattered anywhere across the
// ~50+ pages (not necessarily near the theme's default listing) — e.g.
// Gravity's presets landed on pages 32, 47, 49, 51 and 53. name/slug come
// from lib/themes/themeStoreFeatures.ts's "Check Theme Store" action;
// rank/page come from the separate "Check Ranking" crawl (see
// lib/demoStore/themeStoreRanking.ts), null until that's run.
const themeStorePresetSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    rank: { type: Number, default: null },
    page: { type: Number, default: null },
    // The rank this preset had as of the check *before* the current one —
    // shifted forward (current -> previous) at the start of every "Check
    // Ranking" crawl, so the UI can show how much it moved since then. Not
    // a full history, just the one prior data point — a manual re-check
    // sooner than a day later still shifts it, so "since last check" is
    // the honest framing, not strictly "since yesterday".
    previousRank: { type: Number, default: null },
  },
  { _id: false }
);

const themeSchema = new Schema(
  {
    name: { type: String, required: true },
    sourceFileName: { type: String, default: null },
    // The persistent Google Sheet checklist tied to this theme (phase-5
    // §14 follow-up) — one spreadsheet reused across every audit run of
    // this theme, not a new one per export. See
    // app/api/reports/[id]/export/google-sheet/route.ts.
    googleSpreadsheetId: { type: String, default: null },
    googleSheetUrl: { type: String, default: null },
    // Default preset demo-store URLs for this theme (Themes module) — set
    // once (at creation or from the Theme Detail page) and reused to
    // pre-fill every "Run Audit" instead of retyping them each time. Purely
    // a convenience default: a specific run can still edit/override them.
    demoStorePresets: { type: [themeDemoStorePresetSchema], default: () => [] },
    // Cached result of checking this theme's public Shopify Theme Store
    // listing (see lib/themes/themeStoreFeatures.ts) — a confirmatory-only
    // signal for AVAILABLE_FEATURES entries our own static/live detectors
    // can't check (empty pointIds): if the Theme Store's own "Features"
    // section names a feature, the theme has it, even though we can't (or
    // haven't yet) verified it from the theme's source. Never used to mark
    // a feature *absent* — the Theme Store page not mentioning something
    // doesn't prove it's missing. Refreshed on request (a live fetch of an
    // external page on every load would be slow and impolite), not on
    // every audit run.
    themeStoreSlug: { type: String, default: null },
    themeStoreFeatures: { type: [String], default: undefined },
    themeStorePresets: { type: [themeStorePresetSchema], default: undefined },
    // The listing's aggregate review stats (confirmed against real
    // listings: Shopify's Theme Store shows a review count + "NN%
    // positive" score, not a 1-5 star average — there's no star rating to
    // report). Shared across a theme and all its presets — a preset's own
    // page shows the identical numbers, reviews aren't preset-specific.
    themeStoreReviewCount: { type: Number, default: null },
    themeStorePositivePercent: { type: Number, default: null },
    themeStoreCheckedAt: { type: Date, default: null },
    themeStoreError: { type: String, default: null },
    // The Theme Store listing's current live version + when that version
    // shipped (from its Release Notes section) — lets the Themes list flag
    // a theme whose uploaded ZIP is behind the live listing, and shows a
    // real "last updated" date instead of this app's own audit cadence.
    themeStoreVersion: { type: String, default: null },
    themeStoreVersionReleasedAt: { type: Date, default: null },
    // This theme's own default listing's overall position in the public
    // Theme Store's "/themes" catalog (see lib/demoStore/themeStoreRanking.ts
    // — shared with the demo-store module since it's the same public
    // catalog, nothing demo-store-specific about the crawl itself); each
    // alternate preset in themeStorePresets carries its own rank/page
    // instead, since presets are separately ranked too. Only meaningful
    // once themeStoreSlug resolves to a real listing; set by a manual
    // "Check Ranking" action, not the Theme Store feature check above — a
    // full catalog crawl can mean dozens of page fetches.
    themeStoreRank: { type: Number, default: null },
    themeStoreRankPage: { type: Number, default: null },
    themeStoreRankCheckedAt: { type: Date, default: null },
    // See themeStorePresetSchema's previousRank for the same "one prior
    // data point, shifted forward on every crawl" semantics.
    themeStorePreviousRank: { type: Number, default: null },
  },
  { timestamps: true }
);

// Mongo has no `on delete cascade` — emulate the Theme -> AuditRun -> Finding
// chain here so deleting a Theme also removes its runs and their findings.
// Also cleans up the Themes-module side of the tree (ThemeVersion/ThemeZip
// and their GridFS bytes) — deleteMany() doesn't trigger ThemeVersion's own
// pre-delete hooks, so that cleanup is repeated here rather than relied on.
async function cascadeDeleteRuns(themeId: unknown) {
  if (!themeId) return;
  const { AuditRun } = await import("./audit-run");
  const { Finding } = await import("./finding");
  const { ThemeVersion } = await import("./theme-version");
  const { ThemeZip } = await import("./theme-zip");
  const { deleteZip } = await import("../lib/themes/zipStorage");

  const runs = await AuditRun.find({ themeId }).select("_id");
  const runIds = runs.map((r) => r._id);
  if (runIds.length > 0) {
    await Finding.deleteMany({ auditRunId: { $in: runIds } });
    await AuditRun.deleteMany({ _id: { $in: runIds } });
  }

  const versions = await ThemeVersion.find({ themeId }).select("_id");
  const versionIds = versions.map((v) => v._id);
  if (versionIds.length > 0) {
    const zips = await ThemeZip.find({ themeVersionId: { $in: versionIds } }).select("gridFsFileId");
    await Promise.all(zips.map((z) => deleteZip(z.gridFsFileId).catch(() => {})));
    await ThemeZip.deleteMany({ themeVersionId: { $in: versionIds } });
    await ThemeVersion.deleteMany({ themeId });
  }
}

themeSchema.pre("findOneAndDelete", async function () {
  const doc = await this.model.findOne(this.getFilter()).select("_id");
  if (doc) await cascadeDeleteRuns(doc._id);
});

themeSchema.pre("deleteOne", { document: true, query: false }, async function () {
  await cascadeDeleteRuns(this._id);
});

export type ThemeDoc = InferSchemaType<typeof themeSchema>;

export const Theme = models.Theme ?? model("Theme", themeSchema);
