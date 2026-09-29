"use client";

import { Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/app/_components/ui/Button";
import { useApi } from "@/app/analytics/_components/useApi";
import { SectionTitle } from "./shared";

type ImportResult = { inserted: number; duplicates: number; newStores: number; rowsRead: number; skipped: number };

export function ImportTab({ onImported }: { onImported: () => void }) {
  const themes = useApi<{ themes: { id: string; name: string; presets: string[] }[] }>("/api/sales/themes");
  const [themeId, setThemeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = themes.data?.themes.find((t) => t.id === themeId);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!themeId || !file) {
      setError("Choose the theme and the sheet file.");
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.set("themeId", themeId);
      body.set("file", file);
      const res = await fetch("/api/sales/import", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
      setResult(data as ImportResult);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  async function deleteThemeSales() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    const res = await fetch(`/api/sales/summary?themeId=${themeId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) setError(data?.error ?? "Couldn't delete.");
    else {
      setResult(null);
      setError(null);
      onImported();
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-5">
      <SectionTitle
        title="Import sales"
        description="Upload one theme's sales sheet (the Partner export with Date, Shop Name, Shop Domain, Preset, Country, Charge Type, Sale, Fee, Share). Download it from Google Sheets as .xlsx or .csv. Rows already imported are skipped, so re-upload the updated sheet anytime."
      />
      <form onSubmit={upload} className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-5">
        <div>
          <label htmlFor="sales-theme" className="mb-1.5 block text-sm font-medium">Theme</label>
          <select
            id="sales-theme"
            value={themeId}
            onChange={(e) => {
              setThemeId(e.target.value);
              setConfirmDelete(false);
            }}
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="">Choose the theme these sales are for…</option>
            {themes.data?.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selected && <p className="mt-1 text-xs text-zinc-500">Presets: {selected.presets.join(", ")}</p>}
        </div>
        <div>
          <label htmlFor="sales-file" className="mb-1.5 block text-sm font-medium">Sales sheet</label>
          <input
            ref={fileInput}
            id="sales-file"
            type="file"
            accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary-tint file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-primary-tint-text"
          />
        </div>
        {error && <p role="alert" className="text-sm text-status-fail-text">{error}</p>}
        {result && (
          <p role="status" className="rounded-lg bg-status-pass-bg px-3 py-2 text-sm text-status-pass-text">
            Added {result.inserted} new sale{result.inserted === 1 ? "" : "s"}
            {result.duplicates > 0 && `, skipped ${result.duplicates} already imported`}
            {result.skipped > 0 && `, ignored ${result.skipped} row${result.skipped === 1 ? "" : "s"} without a date or domain`}.{" "}
            {result.newStores > 0 ? `Checking ${result.newStores} new store${result.newStores === 1 ? "" : "s"} for their preset in the background.` : ""}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            {!pending && <Upload className="h-4 w-4" aria-hidden />}
            {pending ? "Importing…" : "Import"}
          </Button>
          {themeId && (
            <Button type="button" variant="destructive" size="sm" onClick={deleteThemeSales}>
              {confirmDelete ? `Click again to delete all ${selected?.name ?? ""} sales` : "Delete this theme's sales"}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
