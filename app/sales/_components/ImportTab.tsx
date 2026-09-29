"use client";

import { CheckCircle2, MinusCircle, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/app/_components/ui/Button";
import { useApi } from "@/app/analytics/_components/useApi";
import { SectionTitle } from "./shared";

type TabResult = {
  tab: string;
  themeName: string | null;
  inserted: number;
  duplicates: number;
  newStores: number;
  rowsRead: number;
  skipped: number;
  error?: string;
};

const ALL_TABS = "";

export function ImportTab({ onImported }: { onImported: () => void }) {
  const themes = useApi<{ themes: { id: string; name: string; presets: string[] }[] }>("/api/sales/themes");
  const [themeId, setThemeId] = useState(ALL_TABS);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<TabResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = themes.data?.themes.find((t) => t.id === themeId);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose the sheet file.");
      return;
    }
    setPending(true);
    setError(null);
    setResults(null);
    try {
      const body = new FormData();
      if (themeId) body.set("themeId", themeId);
      body.set("file", file);
      const res = await fetch("/api/sales/import", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { tabs?: TabResult[]; error?: string } | null;
      if (data?.tabs) setResults(data.tabs);
      if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
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
      setResults(null);
      setError(null);
      onImported();
    }
  }

  const imported = results?.filter((r) => !r.error) ?? [];
  const newStores = imported.reduce((n, r) => n + r.newStores, 0);

  return (
    <section className="flex max-w-2xl flex-col gap-5">
      <SectionTitle
        title="Import sales"
        description="Upload your sales workbook as .xlsx (in Google Sheets: File → Download → Microsoft Excel). Each tab is imported for the theme it's named after, e.g. a tab called “Adorn” goes to Adorn. Rows already imported are skipped, so re-upload the updated workbook anytime."
      />
      <form onSubmit={upload} className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-5">
        <div>
          <label htmlFor="sales-theme" className="mb-1.5 block text-sm font-medium">Import for</label>
          <select
            id="sales-theme"
            value={themeId}
            onChange={(e) => {
              setThemeId(e.target.value);
              setConfirmDelete(false);
            }}
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value={ALL_TABS}>Every tab, matched to themes by tab name (.xlsx)</option>
            {themes.data?.themes.map((t) => (
              <option key={t.id} value={t.id}>
                Only {t.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            {selected
              ? `Uses the "${selected.name}" tab of a workbook (or a .csv of just that theme). Presets: ${selected.presets.join(", ")}.`
              : `Tab names must match a theme: ${themes.data?.themes.map((t) => t.name).join(", ") ?? "…"}.`}
          </p>
        </div>
        <div>
          <label htmlFor="sales-file" className="mb-1.5 block text-sm font-medium">Sales workbook</label>
          <input
            ref={fileInput}
            id="sales-file"
            type="file"
            accept={selected ? ".xlsx,.csv,.tsv,.txt" : ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary-tint file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-primary-tint-text"
          />
        </div>
        {error && <p role="alert" className="text-sm text-status-fail-text">{error}</p>}
        {results && (
          <div role="status" className="flex flex-col gap-2 rounded-lg border border-border-subtle p-3 text-sm">
            {results.map((r) => (
              <div key={r.tab} className="flex items-start gap-2">
                {r.error ? (
                  <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-pass-icon" aria-hidden />
                )}
                <p>
                  <span className="font-medium">{r.tab}</span>
                  {r.error ? (
                    <span className="text-zinc-500"> — skipped: {r.error}</span>
                  ) : (
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {r.themeName && r.themeName !== r.tab ? ` → ${r.themeName}` : ""}: {r.inserted} new sale{r.inserted === 1 ? "" : "s"}
                      {r.duplicates > 0 && `, ${r.duplicates} already imported`}
                      {r.skipped > 0 && `, ${r.skipped} row${r.skipped === 1 ? "" : "s"} without a date or domain ignored`}
                    </span>
                  )}
                </p>
              </div>
            ))}
            {newStores > 0 && <p className="text-xs text-zinc-500">Checking {newStores} new store{newStores === 1 ? "" : "s"} for their preset in the background.</p>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            {!pending && <Upload className="h-4 w-4" aria-hidden />}
            {pending ? "Importing…" : "Import"}
          </Button>
          {selected && (
            <Button type="button" variant="destructive" size="sm" onClick={deleteThemeSales}>
              {confirmDelete ? `Click again to delete all ${selected.name} sales` : `Delete ${selected.name}'s sales`}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
