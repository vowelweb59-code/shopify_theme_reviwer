// Next.js server-boot hook (stable, no config flag needed as of Next 15+).
// Starts the demo-store daily-check scheduler once per server process —
// see lib/demoStore/scheduler.ts. Guarded to the nodejs runtime since this
// touches MongoDB/setTimeout, neither available on the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDemoStoreScheduler } = await import("./lib/demoStore/scheduler");
    await startDemoStoreScheduler();
  }
}
