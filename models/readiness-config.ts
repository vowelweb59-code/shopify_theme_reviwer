import { Schema, model, models, type InferSchemaType } from "mongoose";
import { FINDING_SEVERITIES } from "./finding";

// Singleton document (phase-7 §2) — the one place a maintainer adjusts
// what "ready" actually means (which severities block submission, how
// much rule coverage counts as "enough"), instead of it being hardcoded
// inside the readiness-evaluation logic itself. There is exactly one of
// these; app/api/settings/readiness/route.ts creates it on first read if
// it doesn't exist yet, using lib/audit/readiness.ts's DEFAULT_READINESS_CONFIG.
const readinessConfigSchema = new Schema(
  {
    blockerSeverities: { type: [String], required: true, enum: FINDING_SEVERITIES, default: ["blocker"] },
    minimumCoveragePercent: { type: Number, required: true, min: 0, max: 100, default: 70 },
  },
  { timestamps: true }
);

export type ReadinessConfigDoc = InferSchemaType<typeof readinessConfigSchema>;

export const ReadinessConfigModel = models.ReadinessConfig ?? model("ReadinessConfig", readinessConfigSchema);
