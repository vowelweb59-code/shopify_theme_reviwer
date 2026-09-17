import { Schema, model, models, type InferSchemaType } from "mongoose";

// One (theme, version-string) pair — the version string is whatever was
// extracted from the theme ZIP's README (lib/themes/extractReadmeVersion.ts),
// never invented. versionParts/isSemver support ordering (lib/themes/
// compareVersions.ts) without discarding the exact string the README used.
const themeVersionSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, required: true, ref: "Theme", index: true },
    version: { type: String, required: true },
    versionParts: { type: [Number], default: () => [] },
    isSemver: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

// One ThemeVersion per (theme, version string) — re-uploading an existing
// version reuses this doc rather than creating a sibling (see
// app/api/themes/[themeId]/versions/route.ts).
themeVersionSchema.index({ themeId: 1, version: 1 }, { unique: true });

// Mirrors Theme's own cascade pattern (models/theme.ts) — deleting a
// ThemeVersion (only ever done as part of deleting its parent Theme today)
// must not orphan its ThemeZips or the AuditRuns/Findings that reference it.
async function cascadeDeleteVersion(themeVersionId: unknown) {
  if (!themeVersionId) return;
  const { ThemeZip } = await import("./theme-zip");
  const { AuditRun } = await import("./audit-run");
  const { Finding } = await import("./finding");
  const runs = await AuditRun.find({ themeVersionId }).select("_id");
  const runIds = runs.map((r) => r._id);
  if (runIds.length > 0) {
    await Finding.deleteMany({ auditRunId: { $in: runIds } });
    await AuditRun.deleteMany({ _id: { $in: runIds } });
  }
  await ThemeZip.deleteMany({ themeVersionId });
}

themeVersionSchema.pre("findOneAndDelete", async function () {
  const doc = await this.model.findOne(this.getFilter()).select("_id");
  if (doc) await cascadeDeleteVersion(doc._id);
});

themeVersionSchema.pre("deleteOne", { document: true, query: false }, async function () {
  await cascadeDeleteVersion(this._id);
});

export type ThemeVersionDoc = InferSchemaType<typeof themeVersionSchema>;

export const ThemeVersion = models.ThemeVersion ?? model("ThemeVersion", themeVersionSchema);
