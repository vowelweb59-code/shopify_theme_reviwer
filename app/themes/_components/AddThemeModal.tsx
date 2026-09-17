"use client";

import { useState, type DragEvent } from "react";
import { UploadCloud, FileArchive } from "lucide-react";
import { Modal } from "@/app/_components/ui/Modal";
import { Button } from "@/app/_components/ui/Button";
import { PresetLinksEditor, type DemoStorePreset } from "@/app/_components/PresetLinksEditor";

function Dropzone({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        dragOver ? "border-primary bg-primary-tint" : "border-border-subtle"
      }`}
    >
      {file ? (
        <>
          <FileArchive className="h-6 w-6 text-zinc-400" aria-hidden />
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{file.name}</p>
          <button type="button" onClick={() => onFile(null)} className="text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200">
            Remove
          </button>
        </>
      ) : (
        <>
          <UploadCloud className="h-6 w-6 text-zinc-400" aria-hidden />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Drag &amp; drop a theme .zip here</p>
          <label className="cursor-pointer text-sm font-medium text-primary underline">
            Browse files
            <input
              type="file"
              accept=".zip"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </>
      )}
    </div>
  );
}

export function AddThemeModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [presets, setPresets] = useState<DemoStorePreset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setFile(null);
    setPresets([]);
    setError(null);
  }

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
    reset();
    onOpenChange(false);
    onCreated();
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Add Theme"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Theme name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border-subtle bg-transparent px-3 py-2"
            placeholder="e.g. Adorn"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Theme ZIP</span>
          <Dropzone file={file} onFile={setFile} />
          <p className="text-xs text-zinc-500">
            Version detected from config/settings_schema.json&apos;s theme_info block, or a README &quot;Version: x.y.z&quot;
            line — never entered manually.
          </p>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer select-none text-zinc-600 dark:text-zinc-400">Preset demo store URLs (optional)</summary>
          <div className="mt-2">
            <PresetLinksEditor presets={presets} onChange={setPresets} />
          </div>
        </details>

        {error && (
          <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text dark:border-red-900/50">
            {error}
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting}>
            {submitting ? "Reading theme…" : "Create Theme"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
