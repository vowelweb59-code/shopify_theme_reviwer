"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { StatusPill, formatDateTime, type PillTone } from "./Ga4StatusPill";
import { Ga4ThemesSection } from "./Ga4ThemesSection";

export type Connection = {
  id: string;
  email: string;
  displayName: string | null;
  status: "active" | "revoked" | "error" | "disconnected";
  connectedAt: string | null;
  lastValidatedAt: string | null;
  disconnectedAt: string | null;
  lastError: string | null;
};

type Banner = { kind: "success" | "error" | "info"; message: string };

const STATUS_PILLS: Record<Connection["status"], { tone: PillTone; label: string }> = {
  active: { tone: "pass", label: "Connected" },
  revoked: { tone: "fail", label: "Access revoked" },
  error: { tone: "warning", label: "Error" },
  disconnected: { tone: "neutral", label: "Disconnected" },
};

// The callback redirects here with ?ga4=<outcome>.
function bannerFromParams(params: URLSearchParams): Banner | null {
  const account = params.get("ga4Account");
  switch (params.get("ga4")) {
    case "connected":
      return { kind: "success", message: `Connected ${account ?? "Google account"}.` };
    case "reconnected":
      return { kind: "success", message: `Reconnected ${account ?? "Google account"}.` };
    case "cancelled":
      return { kind: "info", message: "Google sign-in was cancelled — nothing was changed." };
    case "error":
      return { kind: "error", message: params.get("ga4Error") ?? "Couldn't connect to Google." };
    default:
      return null;
  }
}

const BANNER_CLASSES: Record<Banner["kind"], string> = {
  success: "text-emerald-700 dark:text-emerald-400",
  error: "text-red-700 dark:text-red-300",
  info: "text-zinc-600 dark:text-zinc-400",
};

export function Ga4ConnectionsContent() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, "validate" | "disconnect" | undefined>>({});
  // useSearchParams (not window.location) so server and client render the
  // same tree; seeded once, so it survives the param-stripping below.
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<Banner | null>(() => bannerFromParams(searchParams));

  // Strip the one-shot outcome params so a refresh doesn't replay the banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("ga4")) return;
    ["ga4", "ga4Error", "ga4Account"].forEach((k) => params.delete(k));
    window.history.replaceState({}, "", `/settings?${params.toString()}`);
  }, []);

  const load = useCallback(() => {
    fetch("/api/analytics/google/connections")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        setConnections(data.connections);
        setConfigured(data.configured);
        setLoadError(null);
      })
      .catch(() => setLoadError("Couldn't load Google accounts."));
  }, []);

  useEffect(load, [load]);

  function replaceConnection(updated: Connection) {
    setConnections((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)) ?? null);
  }

  async function act(connection: Connection, action: "validate" | "disconnect") {
    if (action === "disconnect" && !window.confirm(`Disconnect ${connection.email}? Its stored access is deleted; you can reconnect any time.`)) return;
    setBusy((b) => ({ ...b, [connection.id]: action }));
    try {
      const res = await fetch(`/api/analytics/google/connections/${connection.id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      replaceConnection(data.connection);
      if (action === "disconnect") setBanner({ kind: "info", message: `Disconnected ${connection.email}.` });
      else if (data.outcome.ok) setBanner({ kind: "success", message: `${connection.email}: access confirmed.` });
      else setBanner({ kind: "error", message: `${connection.email}: ${data.connection.lastError ?? "access check failed."}` });
    } catch (err) {
      setBanner({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy((b) => ({ ...b, [connection.id]: undefined }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">GA4 Analytics</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Connect every Google account that owns a theme&apos;s GA4 property. Each account is stored separately with
          read-only Analytics access; connecting one never replaces another.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Google accounts"
          description="Tokens are encrypted and stay on the server."
          action={
            configured ? (
              <a
                href="/api/analytics/google/connect"
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                Connect Google account
              </a>
            ) : null
          }
        />

        {banner && (
          <p role="status" className={`mb-4 text-sm ${BANNER_CLASSES[banner.kind]}`}>
            {banner.message}
          </p>
        )}

        {!configured && (
          <p className="mb-4 text-sm text-red-700 dark:text-red-300">
            GA4 isn&apos;t configured on this server: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL and
            ANALYTICS_TOKEN_ENCRYPTION_KEY (see .env.example).
          </p>
        )}

        {loadError ? (
          <div className="flex items-center gap-3 text-sm text-red-700 dark:text-red-300">
            {loadError}
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : !connections ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : connections.length === 0 ? (
          <EmptyState title="No Google accounts connected" description="Connect the account that owns a theme's GA4 property to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-4 font-medium">Google account</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Connected</th>
                  <th className="py-2 pr-4 font-medium">Last checked</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.id} className="border-b border-border-subtle align-top last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">{c.email}</div>
                      {c.displayName && <div className="text-xs text-zinc-500">{c.displayName}</div>}
                      {c.lastError && c.status !== "disconnected" && <div className="mt-1 text-xs text-red-700 dark:text-red-300">{c.lastError}</div>}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill {...(STATUS_PILLS[c.status] ?? STATUS_PILLS.error)} />
                    </td>
                    <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                      {c.status === "disconnected" ? `Disconnected ${formatDateTime(c.disconnectedAt)}` : formatDateTime(c.connectedAt)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">{formatDateTime(c.lastValidatedAt)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {c.status === "active" ? (
                          <>
                            <Button variant="secondary" size="sm" loading={busy[c.id] === "validate"} disabled={Boolean(busy[c.id])} onClick={() => act(c, "validate")}>
                              Check access
                            </Button>
                            <Button variant="destructive" size="sm" loading={busy[c.id] === "disconnect"} disabled={Boolean(busy[c.id])} onClick={() => act(c, "disconnect")}>
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          configured && (
                            <a
                              href={`/api/analytics/google/connect?connectionId=${c.id}`}
                              className="inline-flex items-center rounded-full border border-border-subtle px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-border-strong hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                            >
                              Reconnect
                            </a>
                          )
                        )}
                        {c.status === "error" && (
                          <Button variant="destructive" size="sm" loading={busy[c.id] === "disconnect"} disabled={Boolean(busy[c.id])} onClick={() => act(c, "disconnect")}>
                            Disconnect
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Ga4ThemesSection connections={connections ?? []} configured={configured} />
    </div>
  );
}
