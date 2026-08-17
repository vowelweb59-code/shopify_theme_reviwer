import { ReadinessConfigModel } from "@/models/readiness-config";
import { DEFAULT_READINESS_CONFIG, type ReadinessConfig } from "./readiness";

/**
 * Fetches the singleton readiness config, creating it with defaults on
 * first read rather than requiring a separate seed step. Shared by every
 * route that needs to evaluate readiness (reports, export) and the
 * settings route that lets a maintainer change it — all reading the same
 * "create on first use" logic rather than three slightly different copies
 * of it. Assumes connectToDatabase() has already been called.
 */
export async function loadReadinessConfig(): Promise<ReadinessConfig> {
  const existing = await ReadinessConfigModel.findOne().lean();
  if (existing) {
    return { blockerSeverities: existing.blockerSeverities, minimumCoveragePercent: existing.minimumCoveragePercent };
  }
  await ReadinessConfigModel.create(DEFAULT_READINESS_CONFIG);
  return DEFAULT_READINESS_CONFIG;
}
