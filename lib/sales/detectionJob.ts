import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { SaleRecord } from "@/models/sale-record";
import { SalesStore } from "@/models/sales-store";
import { checkStore, sheetPresetName } from "./detectStorePreset";
import { presetNamesFor } from "./presetNames";

// Visits each buyer's storefront to see which preset it runs. One job at a
// time, a few stores in parallel, so a big import doesn't flood Shopify or
// the single Render instance. Progress is kept in memory for the page.

const CONCURRENCY = 4;

type JobState = { running: Promise<void> | null; total: number; done: number; startedAt: Date | null; finishedAt: Date | null };
const g = globalThis as typeof globalThis & { _salesDetection?: JobState };
const state = (g._salesDetection ??= { running: null, total: 0, done: 0, startedAt: null, finishedAt: null });

export function detectionProgress() {
  return { running: state.running !== null, total: state.total, done: state.done, startedAt: state.startedAt, finishedAt: state.finishedAt };
}

/** The first real preset name the sheet gives for this store (Preset column, then the one after it). */
async function presetFromSheet(themeId: string, shopDomain: string, presetNames: string[]): Promise<string | null> {
  const rows = await SaleRecord.find({ themeId, shopDomain }).select("sheetPreset sheetPresetAlt").sort({ soldAt: -1 }).lean<{ sheetPreset: string; sheetPresetAlt: string }[]>();
  for (const r of rows) {
    const name = sheetPresetName(r.sheetPreset, presetNames) ?? sheetPresetName(r.sheetPresetAlt, presetNames);
    if (name) return name;
  }
  return null;
}

async function runDetection(filter: Record<string, unknown>) {
  await connectToDatabase();
  const stores = await SalesStore.find(filter).select("themeId shopDomain").lean<{ _id: unknown; themeId: unknown; shopDomain: string }[]>();
  state.total = stores.length;
  state.done = 0;

  const themes = new Map<string, { name: string; presets: string[] }>();
  async function themeInfo(themeId: string) {
    if (!themes.has(themeId)) {
      const t = await Theme.findById(themeId).select("name themeStorePresets").lean<{ name: string; themeStorePresets?: { name: string }[] }>();
      themes.set(themeId, { name: t?.name ?? "", presets: t ? presetNamesFor(t) : [] });
    }
    return themes.get(themeId)!;
  }

  let next = 0;
  async function worker() {
    while (next < stores.length) {
      const store = stores[next++];
      const themeId = String(store.themeId);
      try {
        const theme = await themeInfo(themeId);
        const check = await checkStore(store.shopDomain, theme.name, theme.presets);
        const fromSheet = check.presetFromName ? null : await presetFromSheet(themeId, store.shopDomain, theme.presets);
        await SalesStore.updateOne(
          { _id: store._id },
          {
            $set: {
              status: check.status,
              liveUrl: check.liveUrl,
              liveThemeName: check.liveThemeName,
              liveSchemaName: check.liveSchemaName,
              detectedPreset: check.presetFromName ?? fromSheet,
              detectedSource: check.presetFromName ? "theme_name" : fromSheet ? "sheet" : "none",
              checkedAt: new Date(),
              error: check.error,
            },
          }
        );
      } catch (err) {
        console.error(`[sales] checking ${store.shopDomain} failed:`, err instanceof Error ? err.message : err);
      }
      state.done++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, stores.length) }, worker));
}

/**
 * Starts a detection run in the background (or returns the one already
 * running). `all` re-checks every store; otherwise only stores never
 * checked yet.
 */
export function startDetection({ all = false, themeId }: { all?: boolean; themeId?: string } = {}): void {
  if (state.running) return;
  const filter: Record<string, unknown> = all ? {} : { status: "pending" };
  if (themeId) filter.themeId = themeId;
  state.startedAt = new Date();
  state.finishedAt = null;
  state.running = runDetection(filter)
    .catch((err) => console.error("[sales] preset detection failed:", err))
    .finally(() => {
      state.running = null;
      state.finishedAt = new Date();
    });
}
