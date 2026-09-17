"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PresetLinksEditor, type DemoStorePreset } from "@/app/_components/PresetLinksEditor";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type ThemeRow = {
  theme: { _id: string; name: string };
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string } | null;
  checkTotals: CheckTotals | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function AddThemeForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [presets, setPresets] = useState<DemoStorePreset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Choose a theme .zip file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.set("themeName", name);
    formData.set("file", file);
    const validPresets = presets.map((p, i) => ({ label: p.label.trim() || `Preset ${i + 1}`, url: p.url.trim() })).filter((p) => p.url);
    if (validPresets.length > 0) formData.set("demoStorePresets", JSON.stringify(validPresets));
    const res = await fetch("/api/themes", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create the theme.");
      return;
    }
    setName("");
    setFile(null);
    setPresets([]);
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        + Add Theme
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">Theme name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
          placeholder="e.g. Adorn"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">Theme .zip</span>
        <input type="file" accept=".zip" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <span className="text-xs text-zinc-500">
          The version is read from the ZIP&apos;s README (a &quot;Version: x.y.z&quot; line) — it isn&apos;t entered manually.
        </span>
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-zinc-700 dark:text-zinc-300">Preset demo store URLs (optional)</span>
        <p className="text-xs text-zinc-500">
          If this theme ships multiple presets (style variants), add each one&apos;s live demo store URL — they&apos;re
          saved on the theme and pre-fill every future &quot;Run Audit&quot;.
        </p>
        <PresetLinksEditor presets={presets} onChange={setPresets} />
      </div>
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {submitting ? "Reading theme…" : "Create theme"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ThemeCard({ row }: { row: ThemeRow }) {
  const { theme, latestVersion, latestAudit, checkTotals } = row;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{theme.name}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {latestVersion ? (
            <>Current Version: {latestVersion.version}</>
          ) : (
            <span className="text-zinc-500">No version tracked yet</span>
          )}
          {latestAudit && <> · Latest Audit: {formatDate(latestAudit.startedAt)}</>}
        </p>
      </div>

      {checkTotals ? (
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <div className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{checkTotals.total}</div>
            <div className="text-zinc-500">Checks</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">{checkTotals.passed}</div>
            <div className="text-zinc-500">Passed</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-red-700 dark:text-red-400">{checkTotals.failed}</div>
            <div className="text-zinc-500">Failed</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-amber-700 dark:text-amber-400">{checkTotals.warnings}</div>
            <div className="text-zinc-500">Warnings</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          {latestVersion ? "No completed audit yet." : "Upload a version to start tracking this theme."}
        </p>
      )}

      <Link
        href={`/themes/${theme._id}`}
        className="w-fit rounded-full border border-black/[.12] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
      >
        Open Theme
      </Link>
    </div>
  );
}

export default function ThemesPage() {
  const [rows, setRows] = useState<ThemeRow[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/themes")
      .then((res) => res.json())
      .then((data) => {
        setRows(data.themes ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Themes</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Version-tracked themes — each version keeps its own stored ZIP and full audit history, on top of the
          same audit engine used everywhere else in this app.
        </p>
      </div>

      <AddThemeForm onCreated={load} />

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/[.12] p-8 text-center text-sm text-zinc-500 dark:border-white/[.15]">
          No themes yet. Add one above.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <ThemeCard key={row.theme._id} row={row} />
        ))}
      </div>
    </div>
  );
}
