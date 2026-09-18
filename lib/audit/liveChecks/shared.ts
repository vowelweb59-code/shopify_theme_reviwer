export type PresetLink = { label: string; url: string };
export type PresetLiveCheckError = { label: string; url: string; error: string };

// fetch()-based checks (page-fact extraction, PSI calls) have a near-zero
// memory footprint compared to the Chromium-per-preset model this replaced
// — this limit exists only to avoid hammering a single demo store with many
// simultaneous requests, not to protect this process's own memory budget.
export const FETCH_CONCURRENCY_LIMIT = 4;

/**
 * Like Promise.all(items.map(fn)), but runs at most `limit` invocations of
 * fn concurrently instead of all of them at once. Preserves each result at
 * its original index, same guarantee Promise.all gives — comparePresets
 * (and anything else relying on ordering) is unaffected by this being
 * throttled rather than fully parallel.
 */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
