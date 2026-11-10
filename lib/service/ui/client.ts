"use client";

export type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Browser-side write to /api/service<path>. Errors come back as { error } (lib/service/api/http.ts). */
export async function mutate<T = unknown>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<MutationResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/service${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
  if (res.status === 401) return { ok: false, error: "Your session expired. Reload the page and sign in again." };
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) return { ok: false, error: payload?.error ?? `Request failed (${res.status}).` };
  return { ok: true, data: payload as T };
}
