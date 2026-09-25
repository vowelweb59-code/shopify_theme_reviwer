import { Schema, model, models, type InferSchemaType } from "mongoose";

export const FINDING_CATEGORIES = [
  "Theme Store Compliance",
  "Accessibility",
  "Technical SEO",
  "Technical AEO",
  "Performance",
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

// Automatic re-audit history (phase-6 §13) — distinct from FINDING_STATUSES:
// this describes whether the *signature* has been seen before across the
// theme's audit history, computed once at persist time from the theme's
// prior runs. "reintroduced" specifically means the issue looked resolved
// (absent from the immediately preceding run) but has come back.
export const FINDING_HISTORICAL_STATES = ["first_seen", "persistent", "reintroduced"] as const;

const findingSchema = new Schema(
  {
    auditRunId: { type: Schema.Types.ObjectId, required: true, ref: "AuditRun" },
    ruleId: { type: String, required: true },
    requirementId: { type: String },
    filePath: { type: String, required: true },
    lineNumber: { type: Number },
    category: { type: String, required: true, enum: FINDING_CATEGORIES },
    severity: { type: String, required: true, enum: FINDING_SEVERITIES },
    layer: { type: String, required: true, enum: FINDING_LAYERS, default: "static" },
    // Which preset (of possibly several live demo URLs on this run) this
    // finding came from — see lib/audit/liveCheck.ts's runLiveChecksForPresets.
    // null for every static finding, for live findings from a single-URL
    // run, and for the cross-preset comparison findings themselves (those
    // are about the relationship between presets, not one of them).
    presetLabel: { type: String },
    finding: { type: String, required: true },
    recommendation: { type: String },
    sourceReference: { type: String },
    sourceUrl: { type: String },
    sourceSnippet: { type: String },
    status: { type: String, required: true, enum: FINDING_STATUSES, default: "open" },
    ignoredReason: { type: String },
    statusUpdatedAt: { type: Date },
    historicalState: { type: String, enum: FINDING_HISTORICAL_STATES, default: "first_seen" },
  },
  // No __v: findings are never updated with optimistic concurrency.
  { timestamps: { createdAt: "createdAt", updatedAt: false }, versionKey: false }
);

// Every Finding query filters by auditRunId (plus, for page-speed's count,
// category + status), so that's the only index. The per-field indexes that
// used to be here (ruleId, category, severity, status, ...) served no query
// and were ~70% of the collection's index size. Optional fields are left
// out rather than stored as null (see executeAuditRun.ts's toFindingDocs).
findingSchema.index({ auditRunId: 1, category: 1, status: 1 });

export type FindingDoc = InferSchemaType<typeof findingSchema>;

export const Finding = models.Finding ?? model("Finding", findingSchema);
