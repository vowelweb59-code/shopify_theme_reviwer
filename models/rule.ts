import { Schema, model, models, type InferSchemaType } from "mongoose";
import { FINDING_CATEGORIES, FINDING_SEVERITIES } from "./finding";

// Failure here could materially affect Theme Store submission (phase-7
// §17) — "critical" rules are the ones a maintainer should never let ship
// untested or unreviewed. Computed heuristically at seed time from
// category+severity (see scripts/seed-rules.ts), not hand-curated per
// rule — a defensible default, not a claim of certainty.
export const RULE_CRITICALITIES = ["critical", "important", "informational"] as const;

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
    // Detected at seed time by scanning lib/**/*.test.ts for the literal
    // ruleId string (phase-7 §16) — a heuristic, not a coverage-tool
    // measurement, but reliable in practice since every test in this
    // project references its ruleId directly to look the rule up.
    hasTests: { type: Boolean, required: true, default: false, index: true },
    criticality: { type: String, enum: RULE_CRITICALITIES, default: "informational", index: true },
  },
  { timestamps: true }
);

export type RuleDoc = InferSchemaType<typeof ruleSchema>;

export const Rule = models.Rule ?? model("Rule", ruleSchema);
