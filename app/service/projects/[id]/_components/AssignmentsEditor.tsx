"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";

type Role = "MANAGER" | "EMPLOYEE";
interface Person {
  id: string;
  displayName: string;
}

/** Full-replace editor: who manages the project (decides its department) and who is on its team. */
export function AssignmentsEditor({ projectId, users, current }: { projectId: string; users: Person[]; current: Array<{ userId: string; role: Role }> }) {
  const router = useRouter();
  const [picked, setPicked] = useState(() => new Set(current.map((c) => `${c.userId}:${c.role}`)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(userId: string, role: Role) {
    const key = `${userId}:${role}`;
    setSaved(false);
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const assignments = [...picked].map((k) => {
      const [userId, assignmentRole] = k.split(":");
      return { userId, assignmentRole };
    });
    const r = await mutate("PUT", `/projects/${projectId}/assignments`, { assignments });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSaved(true);
    router.refresh();
  }

  if (users.length === 0) return <p className="text-sm text-zinc-500">No active management users to assign.</p>;

  return (
    <div className="space-y-3">
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-1 font-medium">Person</th>
            <th className="py-1 font-medium">Manager</th>
            <th className="py-1 font-medium">Team</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="py-1.5">{u.displayName}</td>
              {(["MANAGER", "EMPLOYEE"] as const).map((role) => (
                <td key={role} className="py-1.5">
                  <input type="checkbox" checked={picked.has(`${u.id}:${role}`)} onChange={() => toggle(u.id, role)} aria-label={`${u.displayName} as ${role === "MANAGER" ? "manager" : "team member"}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60">
          {busy ? "Saving…" : "Save assignments"}
        </button>
        {saved && <span role="status" className="text-sm text-status-pass-text">Saved</span>}
        {error && <span role="alert" className="text-sm text-status-fail-text">{error}</span>}
      </div>
    </div>
  );
}
