"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";

/** A write followed by a page refresh, with its busy/error/note state. */
export function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  async function save(method: "POST" | "PUT", path: string, body: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await mutate<{ entriesFixed?: number; created?: number; skipped?: number }>(method, path, body);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    if (r.data && r.data.created !== undefined) setNote(`${r.data.created} created, ${r.data.skipped} skipped, ${r.data.entriesFixed} entries fixed.`);
    router.refresh();
    return true;
  }
  return { busy, error, note, save };
}
