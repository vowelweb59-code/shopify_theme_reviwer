"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DiagnosticsNote,
  FindingsTable,
  SummaryBar,
  type AuditDiagnostics,
  type FindingRow,
  type FindingSummary,
} from "@/app/_components/findings";

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
    demoStoreUrl?: string | null;
    liveCheckError?: { url: string; error: string } | null;
  };
  findings?: FindingRow[];
};

export default function AuditPage() {
  const [themeName, setThemeName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [demoStoreUrl, setDemoStoreUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AuditRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (demoStoreUrl.trim()) formData.set("demoStoreUrl", demoStoreUrl.trim());

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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Audit</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Upload a Shopify theme .zip. The parser extracts structural facts (images, headings, schema
          blocks, Liquid references, and more), then the deterministic rule engine evaluates them against
          Shopify Theme Store, accessibility, and technical SEO/AEO requirements. Optionally add a live demo
          store URL (the theme installed with real content) to also check things static theme code can&apos;t —
          real rendered contrast and real rendered JSON-LD.
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Demo store URL (optional)</span>
          <input
            type="url"
            value={demoStoreUrl}
            onChange={(e) => setDemoStoreUrl(e.target.value)}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
            placeholder="https://your-demo-store.myshopify.com"
          />
          <span className="text-xs text-zinc-500">
            A real, running store with this theme and actual content installed — checked live for real contrast and
            rendered JSON-LD alongside the static findings above. Leave blank to skip.
          </span>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {submitting ? (demoStoreUrl.trim() ? "Parsing + checking live store…" : "Parsing…") : "Run audit"}
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
            {result.auditRun.demoStoreUrl && (
              <p className="mt-2 text-zinc-500">
                Live-checked:{" "}
                <a href={result.auditRun.demoStoreUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-950 dark:hover:text-zinc-50">
                  {result.auditRun.demoStoreUrl}
                </a>
              </p>
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
    </div>
  );
}
