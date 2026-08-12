"use client";

import { useState } from "react";

type AuditRunResult = {
  theme: { name: string };
  auditRun: { _id: string; status: string; error?: string | null };
};

export default function AuditPage() {
  const [themeName, setThemeName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AuditRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/audit/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeName }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to start audit run.");
      return;
    }
    setResult(data);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Audit</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Theme ZIP upload and full audit execution land in Phases 2-3. For now this just proves the
          theme/audit-run lifecycle is wired up end to end.
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
        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {submitting ? "Starting…" : "Start audit run"}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p>
            Audit run created for <strong>{result.theme.name}</strong> — status:{" "}
            <strong>{result.auditRun.status}</strong>
          </p>
          {result.auditRun.error && <p className="mt-1">{result.auditRun.error}</p>}
        </div>
      )}
    </div>
  );
}
