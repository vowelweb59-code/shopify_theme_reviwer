"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { Modal } from "@/app/_components/ui/Modal";
import { StatusPill, formatDateTime, type PillTone } from "./Ga4StatusPill";
import type { Connection } from "./Ga4ConnectionsContent";

type AnalyticsTheme = {
  id: string;
  name: string;
  account: { id: string; email: string; status: string } | null;
  ga4PropertyId: string | null;
  ga4PropertyDisplayName: string | null;
  ga4PropertyTimeZone: string | null;
  connectionStatus: "unmapped" | "connected" | "error";
  lastValidatedAt: string | null;
  lastError: string | null;
  syncedThroughDate: string | null;
  lastSuccessfulSyncAt: string | null;
};

type SyncJob = {
  id: string;
  syncType: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  rangeStart: string;
  chunksDone: number;
  chunksTotal: number;
  nextRetryAt: string | null;
  completedAt: string | null;
  error: { message: string | null; code: string | null } | null;
  warnings: string[];
};

type DiscoveredProperty = {
  propertyId: string;
  displayName: string;
  accountDisplayName: string;
  mappedToTheme: { id: string; name: string } | null;
};

type Banner = { kind: "success" | "error" | "info"; message: string };

const BANNER_CLASSES: Record<Banner["kind"], string> = {
  success: "text-emerald-700 dark:text-emerald-400",
  error: "text-red-700 dark:text-red-300",
  info: "text-zinc-600 dark:text-zinc-400",
};

const INPUT_CLASSES = "w-full rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm disabled:opacity-50";

// A mapping can look fine on the theme while its Google account has since
// been disconnected or revoked, so the pill combines both.
function themeStatus(theme: AnalyticsTheme): { tone: PillTone; label: string } {
  if (theme.connectionStatus === "unmapped") return { tone: "neutral", label: "Not mapped" };
  if (theme.connectionStatus === "error") return { tone: "fail", label: "Error" };
  if (theme.account?.status !== "active") return { tone: "warning", label: "Account needs reconnect" };
  return { tone: "pass", label: "Connected" };
}

function SyncState({ theme, job }: { theme: AnalyticsTheme; job?: SyncJob }) {
  if (!theme.ga4PropertyId) return <span className="text-zinc-500">—</span>;
  let main;
  if (job?.status === "running") {
    main = (
      <>
        <StatusPill tone="neutral" label={`Syncing ${job.chunksDone}/${job.chunksTotal}`} />
        <div className="mt-1 text-xs text-zinc-500">{job.syncType === "initial" ? `Full history since ${job.rangeStart}` : "Recent days"}</div>
      </>
    );
  } else if (job?.status === "queued") {
    main = (
      <>
        <StatusPill tone="warning" label={job.nextRetryAt ? `Retry ${formatDateTime(job.nextRetryAt)}` : "Queued"} />
        {job.error?.message && <div className="mt-1 max-w-xs text-xs text-zinc-500">{job.error.message}</div>}
      </>
    );
  } else if (job?.status === "failed") {
    main = (
      <>
        <StatusPill tone="fail" label="Sync failed" />
        {job.error?.message && <div className="mt-1 max-w-xs text-xs text-red-700 dark:text-red-300">{job.error.message}</div>}
      </>
    );
  } else if (theme.syncedThroughDate) {
    main = (
      <>
        <div className="text-zinc-800 dark:text-zinc-200">Through {theme.syncedThroughDate}</div>
        <div className="text-xs text-zinc-500">Last sync {formatDateTime(theme.lastSuccessfulSyncAt)}</div>
      </>
    );
  } else {
    main = <span className="text-zinc-500">Not synced yet</span>;
  }
  return (
    <>
      {main}
      {job?.warnings.map((w) => (
        <div key={w} className="mt-1 max-w-xs text-xs text-amber-700 dark:text-amber-400">
          {w}
        </div>
      ))}
    </>
  );
}

async function postJson(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

function ThemeForm({
  theme,
  connections,
  onSaved,
  onCancel,
}: {
  theme: AnalyticsTheme | null; // null = adding
  connections: Connection[];
  onSaved: (theme: AnalyticsTheme) => void;
  onCancel: () => void;
}) {
  const activeAccounts = connections.filter((c) => c.status === "active");
  const [name, setName] = useState(theme?.name ?? "");
  const [accountId, setAccountId] = useState(theme?.account?.status === "active" ? theme.account.id : "");
  const [propertyId, setPropertyId] = useState(theme?.account?.status === "active" ? (theme.ga4PropertyId ?? "") : "");
  // Keyed by account so a stale response for a previously chosen account is ignored.
  const [discovery, setDiscovery] = useState<{ accountId: string; properties?: DiscoveredProperty[]; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    fetch(`/api/analytics/google/connections/${accountId}/properties`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        setDiscovery(res.ok ? { accountId, properties: data.properties } : { accountId, error: data.error ?? `HTTP ${res.status}` });
      })
      .catch(() => active && setDiscovery({ accountId, error: "Couldn't load GA4 properties." }));
    return () => {
      active = false;
    };
  }, [accountId]);

  const current = discovery?.accountId === accountId ? discovery : null;
  const loadingProperties = Boolean(accountId) && !current;
  const mappingChanged = accountId !== (theme?.account?.id ?? "") || propertyId !== (theme?.ga4PropertyId ?? "");
  const willValidate = Boolean(accountId && propertyId) && mappingChanged;

  const accounts = [...new Set((current?.properties ?? []).map((p) => p.accountDisplayName))];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (accountId && !propertyId) return setError("Choose a GA4 property, or set the account back to “Map later”.");
    setSaving(true);
    setError(null);
    const body: Record<string, string> = {};
    if (!theme || name.trim() !== theme.name) body.name = name;
    if (willValidate) Object.assign(body, { googleConnectionId: accountId, ga4PropertyId: propertyId });
    try {
      if (theme && Object.keys(body).length === 0) return onCancel();
      const data = theme ? await postJson(`/api/analytics/themes/${theme.id}`, "PATCH", body) : await postJson("/api/analytics/themes", "POST", body);
      onSaved(data.theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Theme name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={INPUT_CLASSES} placeholder="e.g. Adorn" />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Google account</span>
        <select
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            setPropertyId("");
          }}
          className={INPUT_CLASSES}
        >
          <option value="">{theme?.ga4PropertyId ? "Keep current mapping" : "Map later"}</option>
          {activeAccounts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.email}
            </option>
          ))}
        </select>
        {activeAccounts.length === 0 && <span className="text-xs text-zinc-500">Connect a Google account above to choose a GA4 property.</span>}
      </label>

      {accountId && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">GA4 property</span>
          {loadingProperties ? (
            <span className="text-zinc-500">Loading properties…</span>
          ) : current?.error ? (
            <span className="text-red-700 dark:text-red-300">{current.error}</span>
          ) : current?.properties?.length === 0 ? (
            <span className="text-zinc-500">This account can&apos;t see any GA4 properties.</span>
          ) : (
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={INPUT_CLASSES} required>
              <option value="" disabled>
                Choose a property…
              </option>
              {accounts.map((account) => (
                <optgroup key={account} label={account}>
                  {current?.properties
                    ?.filter((p) => p.accountDisplayName === account)
                    .map((p) => {
                      const usedElsewhere = p.mappedToTheme && p.mappedToTheme.id !== theme?.id;
                      return (
                        <option key={p.propertyId} value={p.propertyId} disabled={Boolean(usedElsewhere)}>
                          {p.displayName} ({p.propertyId}){usedElsewhere ? ` — used by ${p.mappedToTheme!.name}` : ""}
                        </option>
                      );
                    })}
                </optgroup>
              ))}
            </select>
          )}
        </label>
      )}

      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={loadingProperties}>
          {willValidate ? "Validate & save" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function Ga4ThemesSection({ connections, configured }: { connections: Connection[]; configured: boolean }) {
  const [themes, setThemes] = useState<AnalyticsTheme[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busy, setBusy] = useState<Record<string, "validate" | "disconnect" | undefined>>({});
  const [editing, setEditing] = useState<AnalyticsTheme | "new" | null>(null);
  const [syncs, setSyncs] = useState<Record<string, SyncJob>>({});
  const [starting, setStarting] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    fetch("/api/analytics/themes")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        setThemes(data.themes);
        setLoadError(null);
      })
      .catch(() => setLoadError("Couldn't load themes."));
  }, []);

  // Reload when an account's status changes (e.g. disconnected above), since
  // each theme row shows its account's status.
  const connectionsKey = connections.map((c) => `${c.id}:${c.status}`).join(",");
  useEffect(load, [load, connectionsKey]);

  const loadSyncs = useCallback(() => {
    fetch("/api/analytics/sync")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => setSyncs(data.latest))
      .catch(() => {}); // sync state is secondary; the theme table still works without it
  }, []);
  useEffect(loadSyncs, [loadSyncs]);

  // Poll while any job is running; when the last one finishes, refresh the
  // themes too (their "synced through" date moved).
  const anyRunning = Object.values(syncs).some((j) => j.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(loadSyncs, 5000);
    return () => {
      clearInterval(timer);
      load();
    };
  }, [anyRunning, loadSyncs, load]);

  async function syncNow(theme: AnalyticsTheme) {
    setStarting((s) => ({ ...s, [theme.id]: true }));
    try {
      const data = await postJson(`/api/analytics/themes/${theme.id}/sync`, "POST");
      setSyncs((prev) => ({ ...prev, [theme.id]: { ...data.sync, status: "running" } }));
      setBanner({ kind: "info", message: `Syncing ${theme.name} from GA4…` });
    } catch (err) {
      setBanner({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setStarting((s) => ({ ...s, [theme.id]: false }));
    }
  }

  function replaceTheme(updated: AnalyticsTheme) {
    setThemes((prev) => {
      if (!prev) return [updated];
      const exists = prev.some((t) => t.id === updated.id);
      return (exists ? prev.map((t) => (t.id === updated.id ? updated : t)) : [...prev, updated]).sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function act(theme: AnalyticsTheme, action: "validate" | "disconnect") {
    if (action === "disconnect" && !window.confirm(`Remove ${theme.name}'s GA4 mapping? The theme stays; you can map it again any time.`)) return;
    setBusy((b) => ({ ...b, [theme.id]: action }));
    try {
      const data = await postJson(`/api/analytics/themes/${theme.id}/${action}`, "POST");
      replaceTheme(data.theme);
      if (action === "disconnect") setBanner({ kind: "info", message: `${theme.name} is no longer mapped to a GA4 property.` });
      else if (data.ok) setBanner({ kind: "success", message: `${theme.name}: GA4 property access confirmed.` });
      else setBanner({ kind: "error", message: `${theme.name}: ${data.theme.lastError ?? "validation failed."}` });
    } catch (err) {
      setBanner({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy((b) => ({ ...b, [theme.id]: undefined }));
    }
  }

  const editingTheme = editing === "new" ? null : editing;

  return (
    <Card>
      <CardHeader
        title="Themes"
        description="Each theme reads its analytics from one GA4 property, through the Google account that can see it."
        action={
          <Button size="md" onClick={() => setEditing("new")}>
            Add theme
          </Button>
        }
      />

      {banner && (
        <p role="status" className={`mb-4 text-sm ${BANNER_CLASSES[banner.kind]}`}>
          {banner.message}
        </p>
      )}

      {loadError ? (
        <div className="flex items-center gap-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
          <Button variant="secondary" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : !themes ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : themes.length === 0 ? (
        <EmptyState title="No themes yet" description="Add a theme, or run npm run seed:analytics-themes to create the current ones." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-border-subtle">
                <th className="py-2 pr-4 font-medium">Theme</th>
                <th className="py-2 pr-4 font-medium">Google account</th>
                <th className="py-2 pr-4 font-medium">GA4 property</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Data sync</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {themes.map((t) => (
                <tr key={t.id} className="border-b border-border-subtle align-top last:border-0">
                  <td className="py-3 pr-4 font-medium text-zinc-950 dark:text-zinc-50">{t.name}</td>
                  <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">{t.account?.email ?? "—"}</td>
                  <td className="py-3 pr-4">
                    {t.ga4PropertyId ? (
                      <>
                        <div className="text-zinc-800 dark:text-zinc-200">{t.ga4PropertyDisplayName ?? "(unnamed)"}</div>
                        <div className="text-xs text-zinc-500">
                          {t.ga4PropertyId}
                          {t.ga4PropertyTimeZone ? ` · ${t.ga4PropertyTimeZone}` : ""}
                        </div>
                      </>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill {...themeStatus(t)} />
                    {t.lastValidatedAt && <div className="mt-1 text-xs text-zinc-500">Checked {formatDateTime(t.lastValidatedAt)}</div>}
                    {t.lastError && <div className="mt-1 max-w-xs text-xs text-red-700 dark:text-red-300">{t.lastError}</div>}
                  </td>
                  <td className="py-3 pr-4">
                    <SyncState theme={t} job={syncs[t.id]} />
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {t.ga4PropertyId && t.connectionStatus === "connected" && t.account?.status === "active" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={starting[t.id]}
                          disabled={syncs[t.id]?.status === "running" || Boolean(busy[t.id])}
                          onClick={() => syncNow(t)}
                        >
                          {syncs[t.id]?.status === "failed" ? "Retry sync" : syncs[t.id]?.status === "queued" ? "Retry now" : "Sync now"}
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" disabled={Boolean(busy[t.id])} onClick={() => setEditing(t)}>
                        {t.ga4PropertyId ? "Edit" : "Map property"}
                      </Button>
                      {t.ga4PropertyId && (
                        <>
                          <Button variant="secondary" size="sm" loading={busy[t.id] === "validate"} disabled={Boolean(busy[t.id])} onClick={() => act(t, "validate")}>
                            Validate
                          </Button>
                          <Button variant="destructive" size="sm" loading={busy[t.id] === "disconnect"} disabled={Boolean(busy[t.id])} onClick={() => act(t, "disconnect")}>
                            Disconnect
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editingTheme ? `Edit ${editingTheme.name}` : "Add theme"}
        description={configured ? "Choosing a property checks that the account can read it before saving." : undefined}
      >
        {editing !== null && (
          <ThemeForm
            theme={editingTheme}
            connections={connections}
            onCancel={() => setEditing(null)}
            onSaved={(saved) => {
              replaceTheme(saved);
              // A newly mapped property starts its history sync server-side.
              if (saved.connectionStatus === "connected") setTimeout(loadSyncs, 1000);
              setEditing(null);
              setBanner({ kind: "success", message: editingTheme ? `Saved ${saved.name}.` : `Added ${saved.name}.` });
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
