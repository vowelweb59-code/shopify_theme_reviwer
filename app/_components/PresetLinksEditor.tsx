"use client";

import { MAX_PRESETS } from "@/lib/themes/presets";

export type DemoStorePreset = { label: string; url: string };

/**
 * Label+URL pair list with add/remove — the preset demo-store-URL input
 * pattern used in three places in the Themes module (Add Theme, a theme's
 * saved default presets, and the per-run Run Audit form). A controlled
 * component: the parent owns the array and decides what happens with it
 * (save to the theme, or just use it for one audit run).
 */
export function PresetLinksEditor({
  presets,
  onChange,
  addLabel = "+ Add demo store URL",
}: {
  presets: DemoStorePreset[];
  onChange: (presets: DemoStorePreset[]) => void;
  addLabel?: string;
}) {
  function update(index: number, patch: Partial<DemoStorePreset>) {
    onChange(presets.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function remove(index: number) {
    onChange(presets.filter((_, i) => i !== index));
  }

  const atLimit = presets.length >= MAX_PRESETS;

  return (
    <div className="flex flex-col gap-2">
      {presets.map((preset, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            value={preset.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder={`Preset ${i + 1} name`}
            className="w-36 rounded-md border border-black/[.12] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.15]"
          />
          <input
            type="url"
            value={preset.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://preset-demo-store.myshopify.com"
            className="min-w-56 flex-1 rounded-md border border-black/[.12] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.15]"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded-full border border-black/[.12] px-3 py-1 text-xs text-zinc-600 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Remove
          </button>
        </div>
      ))}
      {atLimit ? (
        <p className="text-xs text-zinc-500">Maximum of {MAX_PRESETS} presets.</p>
      ) : (
        <button
          type="button"
          onClick={() => onChange([...presets, { label: "", url: "" }])}
          className="w-fit rounded-full border border-black/[.12] px-3 py-1 text-xs text-zinc-700 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}
