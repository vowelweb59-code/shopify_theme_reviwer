import { Schema, model, models, type InferSchemaType } from "mongoose";

// Deliberately minimal per phase-0-scaffolding-updated.md — a singleton
// document for application-level settings (e.g. enabled rule groups,
// submission-readiness thresholds) that later phases will populate.
const auditSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    enabledCategories: { type: [String], default: undefined },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

export type AuditSettingsDoc = InferSchemaType<typeof auditSettingsSchema>;

export const AuditSettings = models.AuditSettings ?? model("AuditSettings", auditSettingsSchema);
