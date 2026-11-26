import "server-only";
import { analyseSpace, formatSpaceThreads, type SpaceInsights } from "../import/space-insights";
import { listServiceMessages } from "./google";
import { serviceRefreshToken } from "./sync";

// Temporary "Space scan" tab (owner, 2026-11-26): reads one whole Chat space through the Service Chat connection (its account must be a
// member) and lists the pending tasks and the pitch opportunities it finds. Nothing is stored in the database: the last result is kept in
// memory only, so it is gone after a restart and the owner presses Scan again. Chat can only be read on the live server.
export const SPACE_SCAN_SPACE = process.env.SERVICE_SPACE_SCAN_SPACE?.trim() || "spaces/AAQAYekyB1Y";
const SINCE = new Date("2019-01-01T00:00:00Z");

export interface SpaceScanResult extends SpaceInsights {
  space: string;
  scannedAt: string;
}

const g = globalThis as unknown as { __spaceScan?: SpaceScanResult };

export function lastSpaceScan(): SpaceScanResult | null {
  return g.__spaceScan ?? null;
}

export async function scanSpace(now = new Date()): Promise<SpaceScanResult> {
  const msgs = await listServiceMessages(await serviceRefreshToken(), SPACE_SCAN_SPACE, { from: SINCE, to: new Date(now.getTime() + 60_000) });
  const result: SpaceScanResult = {
    ...analyseSpace(msgs.map((m) => ({ id: m.externalId, sender: m.senderName, postedAt: m.postedAt, text: m.text }))),
    space: SPACE_SCAN_SPACE,
    scannedAt: now.toISOString(),
  };
  g.__spaceScan = result;
  return result;
}

/** The whole space as threaded plain text (a download), so it can be read by a person or an AI assistant outside the app. */
export async function exportSpaceText(now = new Date()): Promise<string> {
  const msgs = await listServiceMessages(await serviceRefreshToken(), SPACE_SCAN_SPACE, { from: SINCE, to: new Date(now.getTime() + 60_000) });
  return formatSpaceThreads(msgs.map((m) => ({ id: m.externalId, sender: m.senderName, postedAt: m.postedAt, text: m.text, threadName: m.threadName })));
}
