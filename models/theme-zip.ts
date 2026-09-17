import { Schema, model, models, type InferSchemaType } from "mongoose";

// One actual uploaded ZIP file. A ThemeVersion can have more than one of
// these (re-uploading the same version string with changed source, e.g. a
// bugfix without a version bump — see spec's duplicate-version handling) —
// each upload/AuditRun pair stays traceable to the exact bytes it ran
// against. sourceType is deliberately an enum-of-one today so a future Git
// source (lib/themes/themeSource.ts) can be added without a schema change.
const themeZipSchema = new Schema(
  {
    themeVersionId: { type: Schema.Types.ObjectId, required: true, ref: "ThemeVersion", index: true },
    sourceType: { type: String, required: true, enum: ["local_upload"], default: "local_upload" },
    filename: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    checksumSha256: { type: String, required: true, index: true },
    // GridFS file _id (bucket "themeZips" — lib/themes/zipStorage.ts). The
    // actual bytes live in GridFS, not in this document.
    gridFsFileId: { type: Schema.Types.ObjectId, required: true },
    uploadedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

// Lets an upload reuse an existing ThemeZip (and its already-stored GridFS
// bytes) when the exact same bytes are re-uploaded for the same version,
// instead of storing a byte-identical duplicate.
themeZipSchema.index({ themeVersionId: 1, checksumSha256: 1 });

export type ThemeZipDoc = InferSchemaType<typeof themeZipSchema>;

export const ThemeZip = models.ThemeZip ?? model("ThemeZip", themeZipSchema);
