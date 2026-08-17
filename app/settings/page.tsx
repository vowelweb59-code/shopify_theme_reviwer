"use client";

import { useEffect, useState } from "react";

const SEVERITIES = ["blocker", "high", "medium", "low"] as const;

type ReadinessConfig = { blockerSeverities: string[]; minimumCoveragePercent: number };

export default function SettingsPage() {
  const [config, setConfig] = useState<ReadinessConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/readiness")
      .then((res) => res.json())
      .then((data) => {
        if (active) setConfig(data.config);
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleSeverity(severity: string) {
    if (!config) return;
    const has = config.blockerSeverities.includes(severity);
    const blockerSeverities = has
      ? config.blockerSeverities.filter((s) => s !== severity)
      : [...config.blockerSeverities, severity];
    setConfig({ ...config, blockerSeverities });
    setSaved(false);
  }

  function save() {
    if (!config) return;
    if (config.blockerSeverities.length === 0) {
      setError("At least one severity must be a blocker.");
      return;
    }
    setSaving(true);
    setError(null);
    fetch("/api/settings/readiness", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
      .then((res) => res.json())
      .then((data) => {
        setSaving(false);
        if (data.error) setError(data.error);
        else {
          setConfig(data.config);
          setSaved(true);
        }
      });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Configure what &ldquo;submission ready&rdquo; actually means (phase-7 §2) — changing these changes every
          audit&apos;s READY/NOT_READY/INCOMPLETE verdict, not just the current one.
        </p>
      </div>

      {!config ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]">
          <div>
            <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">Blocker severities</h2>
            <p className="mt-1 text-xs text-zinc-500">
              An open finding at one of these severities makes the audit NOT_READY. Resolved/ignored findings never
              count, regardless of severity.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {SEVERITIES.map((s) => (
                <label key={s} className="flex items-center gap-2 capitalize">
                  <input
                    type="checkbox"
                    checked={config.blockerSeverities.includes(s)}
                    onChange={() => toggleSeverity(s)}
                    className="h-4 w-4"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">Minimum coverage for a READY claim</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Below this, the audit is INCOMPLETE rather than READY, even with zero blockers — too many requirements
              have no automated check behind them yet.
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="number"
                min={0}
                max={100}
                value={config.minimumCoveragePercent}
                onChange={(e) => {
                  setConfig({ ...config, minimumCoveragePercent: Number(e.target.value) });
                  setSaved(false);
                }}
                className="w-20 rounded-md border border-black/[.12] bg-transparent px-3 py-1.5 dark:border-white/[.15]"
              />
              <span className="text-zinc-500">%</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
