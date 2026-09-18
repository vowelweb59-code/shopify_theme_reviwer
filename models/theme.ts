import { Schema, model, models, type InferSchemaType } from "mongoose";

// Same shape as AuditRun's own demoStorePresetSchema (models/audit-run.ts)
// — kept as a separate literal schema rather than a shared import since
// this one means something different: the theme's own *default* preset
// URLs (e.g. its 4 style variants), not what one specific run happened to
// be checked against.
const themeDemoStorePresetSchema = new Schema({ label: { type: String, required: true }, url: { type: String, required: true } }, { _id: false });

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
    themeStoreCheckedAt: { type: Date, default: null },
    themeStoreError: { type: String, default: null },
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
