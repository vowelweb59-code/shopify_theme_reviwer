"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";
import { INPUT } from "@/lib/service/ui/format";
import type { SenderList } from "@/lib/service/api/review";

export function SenderRow({ sender: s, users, hours }: { sender: SenderList["senders"][number]; users: SenderList["users"]; hours: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(userId: string) {
    setBusy(true);
    setError(null);
    const r = await mutate("PUT", `/review/senders/${s.id}`, { userId: userId || null });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <tr>
      <td className="py-2 pr-3 font-medium">{s.displayName}</td>
      <td className="py-2 pr-3">{s.entries}</td>
      <td className="py-2 pr-3">{hours}</td>
      <td className="py-2">
        <select aria-label={`Person for ${s.displayName}`} disabled={busy} value={s.user?.id ?? ""} onChange={(e) => void change(e.target.value)} className={INPUT}>
          <option value="">Not linked</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
        </select>
        {s.matchedBy && <span className="ml-2 text-xs text-zinc-500">{s.matchedBy === "NAME" ? "matched by name" : "linked by hand"}</span>}
        {error && <p role="alert" className="text-xs text-status-fail-text">{error}</p>}
      </td>
    </tr>
  );
}
