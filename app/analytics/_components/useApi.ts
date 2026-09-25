"use client";

import { useCallback, useEffect, useState } from "react";

export type ApiState<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

type Result<T> = { key: string | null; data: T | null; error: string | null };

/**
 * GET a JSON endpoint whenever `url` changes (null = don't fetch yet). A
 * newer request aborts the one in flight, so quickly flipping filters never
 * lets a slow, stale response overwrite a fresh one. The previous data
 * stays visible while the next loads, so the page doesn't flash empty.
 * "Loading" is derived — the latest settled response is for a different
 * request than the current one — rather than set inside the effect.
 */
export function useApi<T>(url: string | null): ApiState<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: null, data: null, error: null });
  const key = url ? `${url}#${attempt}` : null;

  useEffect(() => {
    if (!url || !key) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status}).`);
        setResult({ key, data: body as T, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResult((prev) => ({ key, data: prev.data, error: err instanceof Error ? err.message : "Request failed." }));
      });
    return () => controller.abort();
  }, [url, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const settled = result.key === key;
  return { data: result.data, error: settled ? result.error : null, loading: key !== null && !settled, reload };
}
