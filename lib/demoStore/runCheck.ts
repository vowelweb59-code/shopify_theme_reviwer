import { connectToDatabase } from "@/lib/db/connect";
import { DemoStoreThemeRecord } from "@/models/demo-store-theme-record";
import { DemoStoreCheckState } from "@/models/demo-store-check-state";
import { fetchLiveDemoStoreTheme, type LiveThemeResult } from "./fetchLiveTheme";
import { checkPendingThemeStoreListings } from "./checkThemeStoreListings";

/**
 * Reads the ops demo store's currently live theme and reconciles it against
 * the open (endedAt: null) history record: same theme id -> just refresh
 * its displayable fields (name/schema can change without the id changing,
 * e.g. a rename); different id -> close the open record (endedAt = now) and
 * start a new one. A fetch failure never touches the records — we don't
 * know the theme changed, only that we couldn't check — it's recorded as
 * lastError instead. Called by both the daily scheduler and the manual
 * "Check Now" button, so this is the one place that owns the reconciliation
 * logic. Also re-checks whether any not-yet-confirmed theme has since gone
 * live on the public Theme Store (see checkPendingThemeStoreListings), run
 * last so a brand-new history record created by this same reconciliation
 * (a theme swap just observed for the first time) gets its first Theme
 * Store check immediately instead of waiting for the next cycle.
 */
export async function runDemoStoreCheck(): Promise<LiveThemeResult> {
  await connectToDatabase();
  const result = await fetchLiveDemoStoreTheme();
  const now = new Date();

  if (!result.ok) {
    await DemoStoreCheckState.findOneAndUpdate({}, { lastCheckedAt: now, lastError: result.error }, { upsert: true });
    await checkPendingThemeStoreListings();
    return result;
  }

  const open = await DemoStoreThemeRecord.findOne({ endedAt: null });
  if (open && open.shopifyThemeId === result.themeId) {
    open.themeName = result.themeName;
    open.schemaName = result.schemaName;
    open.schemaVersion = result.schemaVersion;
    await open.save();
  } else {
    if (open) {
      open.endedAt = now;
      await open.save();
    }
    await DemoStoreThemeRecord.create({
      shopifyThemeId: result.themeId,
      themeName: result.themeName,
      schemaName: result.schemaName,
      schemaVersion: result.schemaVersion,
      startedAt: now,
      endedAt: null,
    });
  }

  await DemoStoreCheckState.findOneAndUpdate({}, { lastCheckedAt: now, lastError: null }, { upsert: true });
  await checkPendingThemeStoreListings();
  return result;
}
