import { Schema, model, models, type InferSchemaType } from "mongoose";
import { FINDING_CATEGORIES, FINDING_SEVERITIES } from "./finding";

const ruleSchema = new Schema(
  {
    // Stable human-assigned ID (e.g. "A11Y-IMG-ALT-001"), referenced by
    // findings for traceability back to the executable check that produced
    // them. Not the Mongo _id.
    ruleId: { type: String, required: true, unique: true, index: true },
    requirementId: { type: String, default: null, index: true },
    category: { type: String, required: true, enum: FINDING_CATEGORIES, index: true },
    defaultSeverity: { type: String, required: true, enum: FINDING_SEVERITIES },
    title: { type: String, required: true },
    description: { type: String, required: true },
    sourceReference: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    enabled: { type: Boolean, required: true, default: true, index: true },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export type RuleDoc = InferSchemaType<typeof ruleSchema>;

export const Rule = models.Rule ?? model("Rule", ruleSchema);
