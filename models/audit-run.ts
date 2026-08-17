import { Schema, model, models, type InferSchemaType } from "mongoose";

export const AUDIT_RUN_STATUSES = ["pending", "running", "complete", "failed"] as const;

const auditRunSummarySchema = new Schema(
  {
    total: { type: Number, required: true, default: 0 },
    blocker: { type: Number, required: true, default: 0 },
    high: { type: Number, required: true, default: 0 },
    medium: { type: Number, required: true, default: 0 },
    low: { type: Number, required: true, default: 0 },
    byCategory: { type: Map, of: Number, default: undefined },
  },
  { _id: false }
);

// Parser-level diagnostics (Phase 2) — deliberately not the full ParsedFile[]
// (too large/proprietary to persist by default), just enough to show what
// was parsed and what wasn't, per phase-2's error-handling requirements.
const fileErrorSchema = new Schema({ path: String, error: String }, { _id: false });

// A rule throwing must never crash the whole audit (phase-3 requirement) —
// the offending rule is skipped and recorded here for diagnostics instead.
const ruleErrorSchema = new Schema({ ruleId: String, error: String }, { _id: false });

// Distinguishes "no issue found" from "could not reliably analyze" — see
// lib/audit/diagnostics.ts (phase-4 §17).
const diagnosticsSchema = new Schema(
  {
    parserWarnings: { type: Number, required: true, default: 0 },
    unresolvedDynamicReferences: { type: Number, required: true, default: 0 },
    filesSkipped: { type: Number, required: true, default: 0 },
    rulesSkippedDueToError: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

// A live check failing (unreachable URL, navigation timeout) must not fail
// the whole audit run — the static results still stand on their own.
const liveCheckErrorSchema = new Schema({ url: String, error: String }, { _id: false });

const auditRunSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, required: true, ref: "Theme", index: true },
    status: { type: String, required: true, enum: AUDIT_RUN_STATUSES, default: "pending" },
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date, default: null },
    error: { type: String, default: null },
    summary: { type: auditRunSummarySchema, default: undefined },
    fileStats: { type: Map, of: Number, default: undefined },
    skippedFileCount: { type: Number, default: null },
    fileErrors: { type: [fileErrorSchema], default: undefined },
    ruleErrors: { type: [ruleErrorSchema], default: undefined },
    diagnostics: { type: diagnosticsSchema, default: undefined },
    // A real, running store URL with the theme + actual merchant content
    // installed — checked live (real computed contrast, rendered JSON-LD/
    // meta tags) alongside the static theme-code findings above.
    demoStoreUrl: { type: String, default: null },
    liveCheckError: { type: liveCheckErrorSchema, default: undefined },
    // Snapshot of every rule's version (ruleId -> Rule.version) at the
    // moment this audit ran (phase-6 §14) — lets a later diff tell "this
    // finding is new because a rule was added/changed" apart from "this
    // finding is new because the theme actually changed". Deliberately a
    // snapshot, not a live lookup: the Rule collection's versions can move
    // on, but what mattered for THIS historical run must stay fixed.
    ruleVersionSnapshot: { type: Map, of: Number, default: undefined },
    parserVersion: { type: String, default: null },
  },
  { timestamps: false }
);

async function cascadeDeleteFindings(auditRunId: unknown) {
  if (!auditRunId) return;
  const { Finding } = await import("./finding");
  await Finding.deleteMany({ auditRunId });
}

auditRunSchema.pre("findOneAndDelete", async function () {
  const doc = await this.model.findOne(this.getFilter()).select("_id");
  if (doc) await cascadeDeleteFindings(doc._id);
});

auditRunSchema.pre("deleteOne", { document: true, query: false }, async function () {
  await cascadeDeleteFindings(this._id);
});

export type AuditRunDoc = InferSchemaType<typeof auditRunSchema>;

export const AuditRun = models.AuditRun ?? model("AuditRun", auditRunSchema);
