import { Schema, model, models, type InferSchemaType } from "mongoose";
import { FINDING_CATEGORIES, FINDING_SEVERITIES } from "./finding";

export const REQUIREMENT_SOURCE_TYPES = [
  "shopify_theme_store",
  "internal_standard",
  "technical_seo",
  "technical_aeo",
  "accessibility",
  "best_practice",
] as const;

export const REQUIREMENT_STATUSES = ["active", "deprecated", "draft"] as const;

export const RULE_STATUSES = ["not_implemented", "partial", "implemented"] as const;

const requirementSchema = new Schema(
  {
    // Stable human-assigned ID (e.g. "SHOPIFY-A11Y-001") — NOT the Mongo
    // _id. Rules, findings, and coverage reporting all reference this so
    // they stay stable across re-seeds and database resets.
    requirementId: { type: String, required: true, unique: true, index: true },
    sourceType: { type: String, required: true, enum: REQUIREMENT_SOURCE_TYPES, index: true },
    category: { type: String, required: true, enum: FINDING_CATEGORIES, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    requirementText: { type: String, default: null }, // verbatim/near-verbatim source text, when available
    sourceName: { type: String, default: null },
    sourceReference: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    severity: { type: String, required: true, enum: FINDING_SEVERITIES },
    status: { type: String, required: true, enum: REQUIREMENT_STATUSES, default: "active" },
    ruleStatus: { type: String, required: true, enum: RULE_STATUSES, default: "not_implemented", index: true },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

export type RequirementDoc = InferSchemaType<typeof requirementSchema>;

export const Requirement = models.Requirement ?? model("Requirement", requirementSchema);
