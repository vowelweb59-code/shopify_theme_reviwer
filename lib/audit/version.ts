import packageJson from "@/package.json";

// Bump manually whenever the theme parser's extraction logic changes in a
// way that could affect which findings appear — a new field captured, a
// regex fixed, a new file type recognized. There's no automated way to
// detect "did the parser change"; this is a deliberately manual signal,
// the same discipline Rule.version already asks for (and has never yet
// needed, since no rule has had a second version).
export const PARSER_VERSION = "1.0.0";

// Bump manually whenever runRules()'s execution/dedup/orchestration logic
// changes — not when an individual rule changes (that's Rule.version,
// snapshotted separately per run).
export const RULE_ENGINE_VERSION = "1.0.0";

// Aggregate version of the requirements knowledge base as a whole (phase-8
// §28) — bump manually on any meaningful addition/removal/rewrite across
// scripts/seed-requirements.ts. Individual requirements don't carry their
// own version numbers, only this whole-of-set one.
export const REQUIREMENTS_VERSION = "1.0.0";

// package.json's own version — read directly rather than duplicated here,
// so there's exactly one place that can drift.
export const APPLICATION_VERSION = packageJson.version;
