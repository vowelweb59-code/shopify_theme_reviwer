import { SyncRequestError, startSync } from "./runSync";

/**
 * Starts a theme's first (or catch-up) sync right after its GA4 property is
 * mapped, without making the request wait for it. Failures to start are
 * fine to drop: the scheduler retries due themes on its next tick.
 */
export function kickOffSyncAfterMapping(themeId: string): void {
  startSync(themeId, "mapped").catch((err) => {
    if (!(err instanceof SyncRequestError)) console.error("[ga4-sync] couldn't start sync after mapping:", err instanceof Error ? err.message : err);
  });
}
