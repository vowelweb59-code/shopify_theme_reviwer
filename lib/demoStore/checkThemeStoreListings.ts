import { DemoStoreThemeRecord } from "@/models/demo-store-theme-record";
import { fetchThemeStoreFeatureLabels } from "@/lib/themes/themeStoreFeatures";

/**
 * For every theme (by shopifyThemeId) seen on the ops demo store that
 * hasn't yet been confirmed on the public Shopify Theme Store, checks
 * whether it's shown up there since the last check and, if so, flags every
 * history record for that theme id — including past (already-ended)
 * periods, not just the currently-live one, since the point is to surface
 * "this theme has since gone live on the Theme Store" regardless of when
 * this app first saw it on the demo store. Reuses the same
 * name-derived-slug lookup the Themes module uses for its own
 * "Check Theme Store" button (lib/themes/themeStoreFeatures.ts) — only the
 * ok/slug part matters here, not the feature list.
 *
 * Called by runDemoStoreCheck alongside the demo-store poll itself, so it
 * runs once a day automatically (and on manual "Check Now") without a
 * separate schedule or button of its own.
 */
export async function checkPendingThemeStoreListings(): Promise<void> {
  const pending = await DemoStoreThemeRecord.find({ themeStoreListed: { $ne: true } })
    .sort({ startedAt: -1 })
    .select("shopifyThemeId themeName");

  const latestNameByThemeId = new Map<number, string>();
  for (const record of pending) {
    if (!latestNameByThemeId.has(record.shopifyThemeId)) {
      latestNameByThemeId.set(record.shopifyThemeId, record.themeName);
    }
  }

  const now = new Date();
  for (const [shopifyThemeId, themeName] of latestNameByThemeId) {
    const result = await fetchThemeStoreFeatureLabels(themeName);
    await DemoStoreThemeRecord.updateMany(
      { shopifyThemeId },
      { themeStoreListed: result.ok, themeStoreSlug: result.slug, themeStoreCheckedAt: now }
    );
  }
}
