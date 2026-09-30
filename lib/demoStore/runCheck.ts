import { connectToDatabase } from "@/lib/db/connect";
import { DemoStoreThemeRecord } from "@/models/demo-store-theme-record";
import { DemoStoreCheckState } from "@/models/demo-store-check-state";
import { fetchLiveDemoStoreTheme, type LiveThemeResult } from "./fetchLiveTheme";
import { checkPendingThemeStoreListings } from "./checkThemeStoreListings";
import { DEFAULT_DEMO_STORE, DEMO_STORES } from "./stores";

export type StoreCheckState = { store: string; lastCheckedAt: Date | null; lastError: string | null };

/** History rows from before multi-store tracking have no store; they're the admin store's. */
export async function backfillDemoStoreField(): Promise<void> {
  await DemoStoreThemeRecord.updateMany({ store: { $exists: false } }, { $set: { store: DEFAULT_DEMO_STORE } });
}

/** Each tracked store's last check. The admin store falls back to the pre-multi-store top-level fields. */
export async function readStoreCheckStates(): Promise<{ stores: StoreCheckState[]; nextCheckAt: Date | null }> {
  const state = await DemoStoreCheckState.findOne().lean<{
    lastCheckedAt?: Date | null;
    lastError?: string | null;
    nextCheckAt?: Date | null;
    storeChecks?: StoreCheckState[];
  }>();
  const stores = DEMO_STORES.map((store) => {
    const saved = state?.storeChecks?.find((c) => c.store === store);
    if (saved) return { store, lastCheckedAt: saved.lastCheckedAt ?? null, lastError: saved.lastError ?? null };
    if (store === DEFAULT_DEMO_STORE) return { store, lastCheckedAt: state?.lastCheckedAt ?? null, lastError: state?.lastError ?? null };
    return { store, lastCheckedAt: null, lastError: null };
  });
  return { stores, nextCheckAt: state?.nextCheckAt ?? null };
}

async function saveStoreCheck(store: string, lastCheckedAt: Date, lastError: string | null): Promise<void> {
  const updated = await DemoStoreCheckState.updateOne(
    { "storeChecks.store": store },
    { $set: { "storeChecks.$.lastCheckedAt": lastCheckedAt, "storeChecks.$.lastError": lastError } }
  );
  if (updated.matchedCount === 0) {
    await DemoStoreCheckState.updateOne({}, { $push: { storeChecks: { store, lastCheckedAt, lastError } } }, { upsert: true });
  }
  if (store === DEFAULT_DEMO_STORE) await DemoStoreCheckState.updateOne({}, { $set: { lastCheckedAt, lastError } });
}

/**
 * Reads one store's currently live theme and reconciles it against that
 * store's open (endedAt: null) history record: same theme id -> just
 * refresh its displayable fields (name/schema can change without the id
 * changing, e.g. a rename); different id -> close the open record
 * (endedAt = now) and start a new one. A fetch failure never touches the
 * records — we don't know the theme changed, only that we couldn't check —
 * it's recorded as that store's lastError instead.
 */
async function checkStore(store: string, previous: StoreCheckState | undefined): Promise<LiveThemeResult> {
  const result = await fetchLiveDemoStoreTheme(store);
  const now = new Date();
  if (!result.ok) {
    await saveStoreCheck(store, now, result.error);
    return result;
  }

  const open = await DemoStoreThemeRecord.findOne({ store, endedAt: null });
  if (open && open.shopifyThemeId === result.themeId) {
    open.themeName = result.themeName;
    open.schemaName = result.schemaName;
    open.schemaVersion = result.schemaVersion;
    open.lastSeenAt = now;
    await open.save();
  } else {
    // The switch happened after the last check that still saw the old
    // theme. A record from before hourly checking has no lastSeenAt; the
    // previous check stands in for it, but only if that check succeeded
    // (a failed one saw nothing).
    let startedAfter: Date | null = null;
    if (open) {
      startedAfter = open.lastSeenAt ?? (previous?.lastCheckedAt && !previous.lastError ? previous.lastCheckedAt : null);
      if (!open.lastSeenAt && startedAfter) open.lastSeenAt = startedAfter;
      open.endedAt = now;
      await open.save();
    }
    await DemoStoreThemeRecord.create({
      store,
      shopifyThemeId: result.themeId,
      themeName: result.themeName,
      schemaName: result.schemaName,
      schemaVersion: result.schemaVersion,
      startedAt: now,
      startedAfter,
      lastSeenAt: now,
      endedAt: null,
    });
  }
  await saveStoreCheck(store, now, null);
  return result;
}

/**
 * Checks every tracked demo store (lib/demoStore/stores.ts), one after the
 * other. Called by both the hourly scheduler and the manual "Check Now"
 * button, so this is the one place that owns the reconciliation logic.
 * Then re-checks whether any not-yet-confirmed theme has since gone live on
 * the public Theme Store (see checkPendingThemeStoreListings), run last so
 * a brand-new history record created by this same pass (a theme swap just
 * observed for the first time) gets its first Theme Store check right away.
 */
export async function runDemoStoreCheck({ manual = false }: { manual?: boolean } = {}): Promise<{ store: string; result: LiveThemeResult }[]> {
  await connectToDatabase();
  await backfillDemoStoreField();
  const { stores: previous } = await readStoreCheckStates();
  const results: { store: string; result: LiveThemeResult }[] = [];
  for (const store of DEMO_STORES) {
    results.push({ store, result: await checkStore(store, previous.find((p) => p.store === store)) });
  }
  await checkPendingThemeStoreListings({ force: manual });
  return results;
}
