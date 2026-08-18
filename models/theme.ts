import { Schema, model, models, type InferSchemaType } from "mongoose";

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
  },
  { timestamps: true }
);

// Mongo has no `on delete cascade` — emulate the Theme -> AuditRun -> Finding
// chain here so deleting a Theme also removes its runs and their findings.
async function cascadeDeleteRuns(themeId: unknown) {
  if (!themeId) return;
  const { AuditRun } = await import("./audit-run");
  const { Finding } = await import("./finding");
  const runs = await AuditRun.find({ themeId }).select("_id");
  const runIds = runs.map((r) => r._id);
  if (runIds.length > 0) {
    await Finding.deleteMany({ auditRunId: { $in: runIds } });
    await AuditRun.deleteMany({ _id: { $in: runIds } });
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
