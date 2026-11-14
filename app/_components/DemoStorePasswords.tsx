"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import type { DemoStorePreset } from "@/app/_components/PresetLinksEditor";

function hostOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return null;
  }
}

/**
 * One password box per distinct demo-store host in the presets. A saved password is checked against the store's own password page,
 * stored encrypted on the server and used by every audit of the theme to read that store; it is never shown again (only "saved").
 * Speed (PageSpeed Insights) can't log in, so a password-protected store gets no Core Web Vitals.
 */
export function DemoStorePasswords({ themeId, presets, onSaved, saveHint }: { themeId: string; presets: DemoStorePreset[]; /** Called after the store accepted a password and it was saved (the Under development card runs the check then). */ onSaved?: () => void; saveHint?: string }) {
  const [saved, setSaved] = useState<string[]>([]);
  const hosts = [...new Map(presets.map((p) => [hostOf(p.url), p.url.trim()] as const).filter(([h]) => h)).entries()] as [string, string][];

  useEffect(() => {
    fetch(`/api/themes/${themeId}/demo-passwords`)
      .then((r) => r.json())
      .then((d) => setSaved(d.hosts ?? []))
      .catch(() => undefined);
  }, [themeId]);

  if (hosts.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        Is the demo store password-protected? Type its URL above and a password box appears here; once the store accepts the password the live checks can read it.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-zinc-700 dark:text-zinc-300">Store password (only if the demo store is password-protected)</span>
      {hosts.map(([host, url]) => (
        <HostPassword key={host} themeId={themeId} host={host} url={url} isSaved={saved.includes(host)} onHosts={setSaved} onSaved={onSaved} saveHint={saveHint} />
      ))}
      <p className="text-xs text-zinc-500">
        The password is checked with the store, then kept encrypted and used by the checks to read the pages. Google&apos;s PageSpeed cannot log in, so a
        password-protected store gets no speed score.
      </p>
    </div>
  );
}

function HostPassword({ themeId, host, url, isSaved, onHosts, onSaved, saveHint }: { themeId: string; host: string; url: string; isSaved: boolean; onHosts: (h: string[]) => void; onSaved?: () => void; saveHint?: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/themes/${themeId}/demo-passwords`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMessage({ ok: false, text: data.error ?? "Could not save the password." });
      else {
        setPassword("");
        onHosts(data.hosts ?? []);
        setMessage({ ok: true, text: `The store accepted the password. Saved.${saveHint ? ` ${saveHint}` : ""}` });
        onSaved?.();
      }
    } catch {
      setMessage({ ok: false, text: "Lost connection to the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/themes/${themeId}/demo-passwords?host=${encodeURIComponent(host)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onHosts(data.hosts ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-48 text-xs font-mono text-zinc-600 dark:text-zinc-300">{host}</span>
        {isSaved && <span className="text-xs text-status-pass-text">✓ password saved</span>}
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSaved ? "New password to replace it" : "Store password"}
          className="min-w-48 flex-1 rounded-md border border-border-subtle bg-transparent px-3 py-1.5 text-sm"
        />
        <Button size="sm" variant="secondary" onClick={save} loading={busy} disabled={!password}>
          {onSaved ? "Save password and scan" : "Save password"}
        </Button>
        {isSaved && (
          <Button size="sm" variant="secondary" onClick={remove} disabled={busy}>
            Remove
          </Button>
        )}
      </div>
      {message && <p className={`text-xs ${message.ok ? "text-status-pass-text" : "text-status-fail-text"}`}>{message.text}</p>}
    </div>
  );
}
