// Named stages an audit run passes through, in order, each with a rough
// percent-complete anchor for a progress bar. The percentages are
// deliberately approximate (based on typical timing proportions observed
// against real themes — see this session's own measurements) rather than
// computed live: a real per-millisecond estimate isn't available without
// re-running the exact same theme/presets first, and an approximate,
// monotonically-increasing bar is far more useful than a bare spinner.
export const AUDIT_STAGES = {
  extracting: { label: "Extracting theme files", percent: 5 },
  running_rules: { label: "Running the static rule engine", percent: 20 },
  detecting_features: { label: "Detecting features & future-update opportunities", percent: 30 },
  checking_live: { label: "Checking live demo store(s) & page speed", percent: 35 },
  persisting: { label: "Saving results", percent: 95 },
} as const;

export type AuditStageKey = keyof typeof AUDIT_STAGES;

// The checking_live stage can run from a few seconds to a couple of
// minutes depending on how many presets/pages are being checked and
// whether PageSpeed Insights is configured — stageProgress gives it real
// sub-progress (e.g. "3 of 8 checked") instead of sitting at one percent
// for the whole stage. Spans the same 35-90% band checking_live's own
// anchor starts to leave headroom for "persisting" (95%) and completion
// (100%, set once status flips to "complete").
const LIVE_STAGE_START_PERCENT = AUDIT_STAGES.checking_live.percent;
const LIVE_STAGE_END_PERCENT = 90;

export function percentForStage(stage: AuditStageKey | null, stageProgress?: { completed: number; total: number } | null): number {
  if (!stage) return 0;
  if (stage === "checking_live" && stageProgress && stageProgress.total > 0) {
    const fraction = Math.min(1, stageProgress.completed / stageProgress.total);
    return Math.round(LIVE_STAGE_START_PERCENT + fraction * (LIVE_STAGE_END_PERCENT - LIVE_STAGE_START_PERCENT));
  }
  return AUDIT_STAGES[stage].percent;
}
