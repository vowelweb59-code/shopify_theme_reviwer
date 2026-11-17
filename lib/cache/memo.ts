// A tiny in-process cache for work that is expensive to repeat and cheap to be a few seconds old (owner, 2026-11-17: "the app is very
// slow, make it faster without upgrading"). One Node process serves the whole site, so a Map on globalThis is enough: no extra
// service, and it survives a dev hot reload. Two callers asking at the same time share ONE load (no pile-up on a small instance).
// A failed load is not kept. `forgetMemo("service:")` drops every entry whose key starts with that prefix; writers call it so a
// change shows at once instead of after the TTL.
type Entry = { at: number; value?: unknown; promise?: Promise<unknown> };
const g = globalThis as typeof globalThis & { _memo?: Map<string, Entry> };
const store = (g._memo ??= new Map<string, Entry>());
const MAX_ENTRIES = 200;

export async function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit) {
    if (hit.promise) return hit.promise as Promise<T>;
    if (Date.now() - hit.at < ttlMs) return hit.value as T;
  }
  const promise = load().then(
    (value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    },
    (err) => {
      store.delete(key);
      throw err;
    }
  );
  store.set(key, { at: Date.now(), promise });
  if (store.size > MAX_ENTRIES) {
    for (const [k, e] of store) if (!e.promise) { store.delete(k); if (store.size <= MAX_ENTRIES) break; }
  }
  return promise;
}

export function forgetMemo(prefix: string): void {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}
