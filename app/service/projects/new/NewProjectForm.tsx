"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";

const input = "w-full rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm";

export function NewProjectForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim() || null;
    setBusy(true);
    setError(null);
    const r = await mutate<{ id: string }>("POST", "/projects", {
      name: String(f.get("name") ?? "").trim(),
      contractRef: text("contractRef"),
      projectType: text("projectType"),
      description: text("description"),
      startDate: text("startDate"),
      targetDate: text("targetDate"),
    });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    router.push(`/service/projects/${r.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 rounded-lg border border-border-subtle bg-surface p-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <input name="name" required maxLength={200} className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Contract ref</span>
          <input name="contractRef" maxLength={200} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Type</span>
          <input name="projectType" maxLength={100} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Start date</span>
          <input name="startDate" type="date" className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Target date</span>
          <input name="targetDate" type="date" className={input} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-500">Description</span>
        <textarea name="description" rows={3} maxLength={5000} className={input} />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
          {busy ? "Creating…" : "Create project"}
        </button>
        {error && <p role="alert" className="text-sm text-status-fail-text">{error}</p>}
      </div>
    </form>
  );
}
