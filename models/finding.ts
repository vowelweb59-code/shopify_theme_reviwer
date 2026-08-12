import { Schema, model, models, type InferSchemaType } from "mongoose";

export const FINDING_CATEGORIES = [
  "Theme Store Compliance",
  "Accessibility",
  "Technical SEO",
  "Technical AEO",
  "Bug",
  "Internal Standard",
] as const;

export const FINDING_SEVERITIES = ["blocker", "high", "medium", "low"] as const;

// Only 'static' exists for now — the deterministic rule engine built in
// Phase 3 onward. An 'llm' layer could be added later without changing this
// shape, but AI-assisted review is explicitly not part of the core pipeline.
export const FINDING_LAYERS = ["static"] as const;

const findingSchema = new Schema(
  {
    auditRunId: { type: Schema.Types.ObjectId, required: true, ref: "AuditRun", index: true },
    ruleId: { type: String, required: true, index: true },
    requirementId: { type: String, default: null, index: true },
    filePath: { type: String, required: true },
    lineNumber: { type: Number, default: null },
    category: { type: String, required: true, enum: FINDING_CATEGORIES, index: true },
    severity: { type: String, required: true, enum: FINDING_SEVERITIES, index: true },
    layer: { type: String, required: true, enum: FINDING_LAYERS, default: "static" },
    finding: { type: String, required: true },
    recommendation: { type: String, default: null },
    sourceReference: { type: String, default: null },
    sourceUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export type FindingDoc = InferSchemaType<typeof findingSchema>;

export const Finding = models.Finding ?? model("Finding", findingSchema);
