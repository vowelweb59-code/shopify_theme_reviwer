"use client";

import { useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import {
  DiagnosticsNote,
  FindingsTable,
  SummaryBar,
  type AuditDiagnostics,
  type FindingRow,
  type FindingSummary,
} from "@/app/_components/findings";

type DemoStorePreset = { label: string; url: string };
type PresetLiveCheckError = { label: string; url: string; error: string };

type AuditRunResult = {
  theme: { name: string };
  auditRun: {
    _id: string;
    status: string;
    error?: string | null;
    fileStats?: Record<string, number>;
    skippedFileCount?: number;
    fileErrors?: { path: string; error: string }[];
    summary?: FindingSummary;
    diagnostics?: AuditDiagnostics;
    // Legacy single-URL fields — only ever present on a run from before
    // the multi-preset feature shipped.
    demoStoreUrl?: string | null;
    liveCheckError?: { url: string; error: string } | null;
    // Current fields, always used by new runs (even a single preset link
    // becomes a 1-item array).
    demoStorePresets?: DemoStorePreset[];
    liveCheckErrors?: PresetLiveCheckError[];
  };
  findings?: FindingRow[];
};

export default function AuditPage() {
  const [themeName, setThemeName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [presets, setPresets] = useState<DemoStorePreset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AuditRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validPresetCount = presets.filter((p) => p.url.trim()).length;

  function updatePreset(index: number, patch: Partial<DemoStorePreset>) {
    setPresets((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePreset(index: number) {
    setPresets((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Choose a theme .zip file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.set("themeName", themeName);
    formData.set("file", file);
    const validPresets = presets
      .map((p, i) => ({ label: p.label.trim() || `Preset ${i + 1}`, url: p.url.trim() }))
      .filter((p) => p.url);
    if (validPresets.length > 0) formData.set("demoStorePresets", JSON.stringify(validPresets));

    const res = await fetch("/api/audit/run", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to run the audit.");
      if (data.auditRun) setResult(data);
      return;
    }
    setResult(data);
  }

  return (
    <PageContainer>
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Audit</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Upload a Shopify theme .zip. The parser extracts structural facts (images, headings, schema
          blocks, Liquid references, and more), then the deterministic rule engine evaluates them against
          Shopify Theme Store, accessibility, and technical SEO/AEO requirements. If the theme ships several
          presets (style variants of the same codebase), optionally add each preset&apos;s own live demo store URL
          below — every preset gets the same live checks (real rendered contrast, real rendered JSON-LD) run
          against it, labeled by preset, and when 2 or more are given they&apos;re also compared against each
          other for structural drift (a preset that&apos;s fallen out of sync with its siblings).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Theme name</span>
          <input
            required
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
            placeholder="e.g. Adorn"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Theme .zip</span>
          <input
            type="file"
            accept=".zip"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>

        <div className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Preset demo store URLs (optional)</span>
          {presets.length === 0 && (
            <p className="text-xs text-zinc-500">
              No preset links added — the audit will run static checks only. The first preset you add is treated
              as the baseline the others are compared against for the sync check.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {presets.map((preset, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  value={preset.label}
                  onChange={(e) => updatePreset(i, { label: e.target.value })}
                  placeholder={`Preset ${i + 1} name`}
                  className="w-40 rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
                />
                <input
                  type="url"
                  value={preset.url}
                  onChange={(e) => updatePreset(i, { url: e.target.value })}
                  placeholder="https://preset-demo-store.myshopify.com"
                  className="min-w-64 flex-1 rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
                />
                {i === 0 && validPresetCount > 1 && (
                  <span className="rounded-full bg-black/[.06] px-2 py-1 text-xs text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
                    Baseline
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePreset(i)}
                  className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPresets((prev) => [...prev, { label: "", url: "" }])}
            className="w-fit rounded-full border border-black/[.12] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            + Add preset link
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {submitting ? (validPresetCount > 0 ? "Parsing + checking live presets…" : "Parsing…") : "Run audit"}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-5">
          <div className="rounded-md border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
            <p>
              <strong>{result.theme.name}</strong> — status: <strong>{result.auditRun.status}</strong>
              {result.auditRun.status === "complete" && (
                <>
                  {" — "}
                  <Link href={`/reports/${result.auditRun._id}`} className="underline hover:text-zinc-950 dark:hover:text-zinc-50">
                    view full report
                  </Link>
                </>
              )}
            </p>
            {result.auditRun.error && <p className="mt-2 text-red-700 dark:text-red-300">{result.auditRun.error}</p>}

            {result.auditRun.demoStorePresets && result.auditRun.demoStorePresets.length > 0 && (
              <div className="mt-2 text-zinc-500">
                <p>Live-checked presets:</p>
                <ul className="mt-1 list-disc pl-5">
                  {result.auditRun.demoStorePresets.map((p) => (
                    <li key={p.url}>
                      <strong className="text-zinc-700 dark:text-zinc-300">{p.label}</strong>:{" "}
                      <a href={p.url} target="_blank" rel="noreferrer" className="underline hover:text-zinc-950 dark:hover:text-zinc-50">
                        {p.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.auditRun.demoStoreUrl && (
              <p className="mt-2 text-zinc-500">
                Live-checked:{" "}
                <a href={result.auditRun.demoStoreUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-950 dark:hover:text-zinc-50">
                  {result.auditRun.demoStoreUrl}
                </a>
              </p>
            )}

            {result.auditRun.liveCheckErrors && result.auditRun.liveCheckErrors.length > 0 && (
              <div className="mt-2 text-amber-700 dark:text-amber-400">
                {result.auditRun.liveCheckErrors.map((e) => (
                  <p key={e.url}>
                    Could not check preset &quot;{e.label}&quot; ({e.url}): {e.error}
                  </p>
                ))}
              </div>
            )}
            {result.auditRun.liveCheckError && (
              <p className="mt-2 text-amber-700 dark:text-amber-400">
                Could not check the live demo store: {result.auditRun.liveCheckError.error}
              </p>
            )}

            {result.auditRun.fileStats && (
              <div className="mt-3">
                <p className="text-zinc-500">Files parsed:</p>
                <ul className="mt-1 list-disc pl-5 text-zinc-700 dark:text-zinc-300">
                  {Object.entries(result.auditRun.fileStats).map(([type, count]) => (
                    <li key={type}>
                      {type}: {count}
                    </li>
                  ))}
                </ul>
                {typeof result.auditRun.skippedFileCount === "number" && (
                  <p className="mt-1 text-zinc-500">{result.auditRun.skippedFileCount} unsupported file(s) skipped.</p>
                )}
                {result.auditRun.fileErrors && result.auditRun.fileErrors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-amber-700 dark:text-amber-400">
                      {result.auditRun.fileErrors.length} file(s) could not be parsed:
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-zinc-700 dark:text-zinc-300">
                      {result.auditRun.fileErrors.map((fe) => (
                        <li key={fe.path}>
                          {fe.path}: {fe.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {result.auditRun.summary && <SummaryBar summary={result.auditRun.summary} />}
          {result.auditRun.diagnostics && <DiagnosticsNote diagnostics={result.auditRun.diagnostics} />}
          {result.findings && <FindingsTable findings={result.findings} />}
        </div>
      )}
    </PageContainer>
  );
}
