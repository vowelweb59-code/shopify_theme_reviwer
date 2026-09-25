// Next.js server-boot hook (stable, no config flag needed as of Next 15+).
// Starts the background schedulers once per server process — see
// lib/demoStore/scheduler.ts, lib/themes/rankingScheduler.ts and
// lib/analytics/sync/scheduler.ts (GA4 sync). Guarded
// to the nodejs runtime since these touch MongoDB/setTimeout, neither
// available on the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDemoStoreScheduler } = await import("./lib/demoStore/scheduler");
    const { startThemeRankingScheduler } = await import("./lib/themes/rankingScheduler");
    const { startGa4SyncScheduler } = await import("./lib/analytics/sync/scheduler");
    await startDemoStoreScheduler();
    await startThemeRankingScheduler();
    await startGa4SyncScheduler();
  }
}
