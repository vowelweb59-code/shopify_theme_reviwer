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

// 'static' is the deterministic rule engine (Phase 3+), running against
// theme source code. 'live' (added 2026-08-14) runs against a real,
// running store URL the user supplies — real computed contrast, real
// rendered JSON-LD/meta tags — for the checks static source analysis
// structurally cannot make (CSS custom properties, app-injected schema,
// actual merchant content). Still fully deterministic; no AI/LLM call
// involved, just a real browser rendering a real page.
export const FINDING_LAYERS = ["static", "live"] as const;

// Manual lifecycle status (phase-5 §6) — deliberately independent of any
// automated diff status (phase-6's resolved/still_present/new/changed):
// a user can mark a finding "ignored" with a reason (e.g. an accepted
// exception) and that decision must persist across re-audits rather than
// being silently overwritten just because the same issue is detected again.
export const FINDING_STATUSES = ["open", "resolved", "ignored"] as const;

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
    sourceSnippet: { type: String, default: null },
    status: { type: String, required: true, enum: FINDING_STATUSES, default: "open", index: true },
    ignoredReason: { type: String, default: null },
    statusUpdatedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export type FindingDoc = InferSchemaType<typeof findingSchema>;

export const Finding = models.Finding ?? model("Finding", findingSchema);
