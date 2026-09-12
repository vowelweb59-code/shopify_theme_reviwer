import { Schema, model, models, type InferSchemaType } from "mongoose";

// Singleton document holding the one persistent Google Sheet the "Future
// updates" backlog exports to and updates in place on every re-export —
// same "one spreadsheet reused, not a new one per export" contract as
// Theme.googleSpreadsheetId/googleSheetUrl (models/theme.ts), but global
// rather than per-theme since enhancement points aren't scoped to a
// specific theme audit. Mirrors the ReadinessConfig/GoogleAuth convention
// of one small dedicated singleton model per concern rather than growing
// the (currently unused) AuditSettings model to cover unrelated things.
const enhancementSheetSchema = new Schema(
  {
    googleSpreadsheetId: { type: String, default: null },
    googleSheetUrl: { type: String, default: null },
  },
  { timestamps: true }
);

export type EnhancementSheetDoc = InferSchemaType<typeof enhancementSheetSchema>;

export const EnhancementSheet = models.EnhancementSheet ?? model("EnhancementSheet", enhancementSheetSchema);
