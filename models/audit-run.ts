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

// One entry per preset demo URL supplied for this run — a theme ZIP can
// ship several presets (style variants) of the same codebase, each
// published as its own live store (see lib/audit/liveCheck.ts's
// runLiveChecksForPresets). Plural counterpart to demoStoreUrl/
// liveCheckError below, which stay untouched for pre-existing runs'
// historical display; new runs populate this instead.
const demoStorePresetSchema = new Schema({ label: { type: String, required: true }, url: { type: String, required: true } }, { _id: false });
const presetLiveCheckErrorSchema = new Schema({ label: String, url: String, error: String }, { _id: false });

// Raw page-speed numbers per preset (lib/audit/pageSpeed.ts) — kept
// alongside the Performance-category Finding rows (which describe *why*
// something's flagged) so a report can also show the plain numbers (score/
// LCP/CLS/TBT) at a glance. `source` records which measurement produced
// these: a real Lighthouse read via Google's PageSpeed Insights API, or the
// Playwright-based fallback used when PSI isn't configured/fails.
const pageSpeedMetricSchema = new Schema(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
    // Defaulted rather than required so pre-existing runs (persisted before
    // the Shopify-submission-bar matrix was added) still validate on read —
    // every one of them was, in effect, the home page checked on mobile.
    pageType: { type: String, enum: ["home", "collection", "product"], default: "home" },
    strategy: { type: String, enum: ["mobile", "desktop"], default: "mobile" },
    source: { type: String, required: true, enum: ["psi", "playwright"] },
    performanceScore: { type: Number, default: null },
    accessibilityScore: { type: Number, default: null },
    lcpMs: { type: Number, default: null },
    clsScore: { type: Number, default: null },
    tbtMs: { type: Number, default: null },
    fcpMs: { type: Number, default: null },
    ttfbMs: { type: Number, default: null },
    pageWeightBytes: { type: Number, default: null },
  },
  { _id: false }
);

// Heuristic presence check for one "Future updates" EnhancementPoint (see
// lib/audit/detectEnhancements.ts) against THIS run's parsed theme source.
// Captured once, at audit time, because the original ZIP is never
// persisted — this is the only chance to check for these patterns. Never
// contributes to severity, coverage, or readiness; a run created before
// this feature shipped simply has no enhancementDetections at all, which
// the report UI treats as "re-run this audit to see detection".
const enhancementDetectionSchema = new Schema(
  {
    pointId: { type: String, required: true },
    detected: { type: Boolean, required: true },
    matches: {
      type: [{ filePath: { type: String, required: true }, lineNumber: { type: Number, default: null } }],
      default: undefined,
    },
  },
  { _id: false }
);

const auditRunSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, required: true, ref: "Theme", index: true },
    status: { type: String, required: true, enum: AUDIT_RUN_STATUSES, default: "pending", index: true },
    startedAt: { type: Date, required: true, default: () => new Date(), index: true },
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
    // Plural — see demoStorePresetSchema's comment above. Populated
    // instead of the singular fields above whenever the run was submitted
    // with one or more preset links.
    demoStorePresets: { type: [demoStorePresetSchema], default: undefined },
    liveCheckErrors: { type: [presetLiveCheckErrorSchema], default: undefined },
    pageSpeed: { type: [pageSpeedMetricSchema], default: undefined },
    enhancementDetections: { type: [enhancementDetectionSchema], default: undefined },
    // Snapshot of every rule's version (ruleId -> Rule.version) at the
    // moment this audit ran (phase-6 §14) — lets a later diff tell "this
    // finding is new because a rule was added/changed" apart from "this
    // finding is new because the theme actually changed". Deliberately a
    // snapshot, not a live lookup: the Rule collection's versions can move
    // on, but what mattered for THIS historical run must stay fixed.
    ruleVersionSnapshot: { type: Map, of: Number, default: undefined },
    parserVersion: { type: String, default: null },
    // Whole-of-app version snapshot (phase-8 §28), alongside the
    // per-rule ruleVersionSnapshot above — together these make a
    // historical run's results fully reproducible/explainable.
    applicationVersion: { type: String, default: null },
    ruleEngineVersion: { type: String, default: null },
    requirementsVersion: { type: String, default: null },
    // Per-stage wall-clock ms for this run (phase-8 §14 / phase-4 §21) —
    // extraction, validation, parsing, themeIndex, ruleExecution,
    // liveChecks (if run), findingPersistence, total. Lets a report
    // surface "where did the time go" and catch regressions over time.
    timingMs: { type: Map, of: Number, default: undefined },
  },
  { timestamps: false }
);

// Matches the exact query shape app/api/audit/run/route.ts's
// loadThemeFindingHistory runs on every single audit: find this theme's
// prior complete runs, newest first (phase-8 §17 asks for indexes based
// on actual query patterns, not a blanket "index everything").
auditRunSchema.index({ themeId: 1, status: 1, startedAt: -1 });

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
