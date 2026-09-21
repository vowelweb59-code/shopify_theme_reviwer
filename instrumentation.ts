// Next.js server-boot hook (stable, no config flag needed as of Next 15+).
// Starts the daily-check schedulers once per server process — see
// lib/demoStore/scheduler.ts and lib/themes/rankingScheduler.ts. Guarded
// to the nodejs runtime since these touch MongoDB/setTimeout, neither
// available on the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDemoStoreScheduler } = await import("./lib/demoStore/scheduler");
    const { startThemeRankingScheduler } = await import("./lib/themes/rankingScheduler");
    await startDemoStoreScheduler();
    await startThemeRankingScheduler();
  }
}
