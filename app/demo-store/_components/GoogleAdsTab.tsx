"use client";

import { Megaphone } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";

type Account = { id: string; name: string | null; manager: boolean; currency: string | null; error?: string };
type AdsData = { configured: boolean; developerToken: boolean; connected: boolean; email?: string; error?: string; accounts?: Account[] };

const formatId = (id: string) => id.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");

export function GoogleAdsTab() {
  const { data, loading, error, reload } = useApi<AdsData>("/api/ads");
  // The connect flow returns here with ?ads=connected|cancelled|error; seeded once, then the params are stripped.
  const searchParams = useSearchParams();
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(() => {
    const result = searchParams.get("ads");
    if (!result) return null;
    if (result === "connected") return { ok: true, text: `Connected as ${searchParams.get("adsAccount") ?? "your Google account"}.` };
    if (result === "cancelled") return { ok: false, text: "Connecting was cancelled." };
    return { ok: false, text: searchParams.get("adsError") ?? "Couldn't connect Google Ads." };
  });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.has("ads")) return;
    for (const k of ["ads", "adsAccount", "adsError"]) p.delete(k);
    const query = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  async function disconnect() {
    await fetch("/api/ads", { method: "DELETE" });
    setOutcome(null);
    reload();
  }

  const columns: TableColumn<Account>[] = [
    { key: "name", header: "Account", render: (a) => <span className="font-medium text-zinc-950 dark:text-zinc-50">{a.name ?? "—"}</span>, sortValue: (a) => (a.name ?? "").toLowerCase() },
    { key: "id", header: "Customer ID", render: (a) => <span className="tabular-nums">{formatId(a.id)}</span>, sortValue: (a) => a.id },
    { key: "type", header: "Type", render: (a) => (a.manager ? "Manager (MCC)" : "Ad account"), sortValue: (a) => (a.manager ? 0 : 1) },
    { key: "currency", header: "Currency", render: (a) => a.currency ?? "—", sortValue: (a) => a.currency ?? "" },
    { key: "note", header: "", render: (a) => (a.error ? <span className="text-xs text-status-fail-text">{a.error}</span> : null) },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Google Ads</h2>
      <p className="max-w-3xl text-sm text-zinc-500">
        Connect the Google account that has access to your Google Ads accounts. The app asks for access to Google Ads only, and you can disconnect here at any time.
      </p>

      {outcome && <p className={`text-sm ${outcome.ok ? "text-green-600" : "text-status-fail-text"}`}>{outcome.text}</p>}
      {error && <p className="text-sm text-status-fail-text">{error}</p>}
      {data && !data.configured && (
        <p className="text-sm text-status-fail-text">Google isn&apos;t configured on this server (GOOGLE_CLIENT_ID/SECRET, ANALYTICS_TOKEN_ENCRYPTION_KEY, APP_URL).</p>
      )}

      {!loading && data && !data.connected && (
        <div className="flex flex-col items-start gap-2">
          {data.error && <p className="text-sm text-status-fail-text">{data.error}</p>}
          <a href="/api/ads/google/connect" className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            <Megaphone className="mr-1.5 h-4 w-4" aria-hidden />
            Connect Google Ads
          </a>
        </div>
      )}

      {data?.connected && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              Connected as <strong>{data.email}</strong>
            </span>
            <Button type="button" onClick={disconnect}>
              Disconnect
            </Button>
            <a href="/api/ads/google/connect" className="text-xs text-primary underline">
              Use another account
            </a>
          </div>
          {data.error && <p className="text-sm text-status-fail-text">{data.error}</p>}
          {data.accounts && data.accounts.length > 0 && <ResponsiveTable columns={columns} rows={data.accounts} rowKey={(a) => a.id} theadClassName="bg-primary-tint text-primary-tint-text" pageSize={25} />}
          {data.accounts && data.accounts.length === 0 && !data.error && <p className="text-sm text-zinc-500">This Google account can&apos;t open any Google Ads accounts.</p>}
        </>
      )}
    </section>
  );
}
