// Next.js server-boot hook (stable, no config flag needed as of Next 15+).
// Starts the background schedulers once per server process — see
// lib/demoStore/scheduler.ts, lib/themes/rankingScheduler.ts and
// lib/analytics/sync/scheduler.ts (GA4 sync). Guarded
// to the nodejs runtime since these touch MongoDB/setTimeout, neither
// available on the edge runtime. Each starts independently: one failing
// (e.g. MongoDB unreachable at boot) is logged and doesn't stop the
// others or the server itself.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const starters: [string, () => Promise<void>][] = [
      ["demo-store", async () => (await import("./lib/demoStore/scheduler")).startDemoStoreScheduler()],
      ["theme-ranking", async () => (await import("./lib/themes/rankingScheduler")).startThemeRankingScheduler()],
      ["ga4-sync", async () => (await import("./lib/analytics/sync/scheduler")).startGa4SyncScheduler()],
    ];
    for (const [name, start] of starters) {
      try {
        await start();
      } catch (err) {
        console.error(`[instrumentation] ${name} scheduler failed to start:`, err instanceof Error ? err.message : err);
      }
    }
  }
}
