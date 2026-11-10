"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DepartmentList } from "@/lib/service/api/departments";
import { mutate } from "@/lib/service/ui/client";
import { INPUT } from "@/lib/service/ui/format";

type Users = DepartmentList["users"];
const btn = "rounded-md border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60";
const ERR = "text-sm text-status-fail-text";

function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  async function save(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await mutate<{ changed?: number }>(method, path, body);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else {
      if (r.data && typeof r.data.changed === "number") setNote(`${r.data.changed} project${r.data.changed === 1 ? "" : "s"} changed.`);
      router.refresh();
    }
    return r.ok;
  }
  return { busy, error, note, save };
}

export function NewDepartment({ users, hasDefault }: { users: Users; hasDefault: boolean }) {
  const { busy, error, save } = useSave();
  const [name, setName] = useState("");
  const [manager, setManager] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save("POST", "/departments", { name, isDefault, ...(isDefault ? {} : { managerUserId: manager || null }) })) {
          setName("");
          setManager("");
          setIsDefault(false);
        }
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">New department</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Digital Marketing" className={`${INPUT} w-56`} />
      </label>
      {!isDefault && (
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Manager</span>
          <select value={manager} onChange={(e) => setManager(e.target.value)} className={`${INPUT} w-48`}>
            <option value="">Choose…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
        </label>
      )}
      {!hasDefault && (
        <label className="flex items-center gap-1 pb-1.5 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default (all other projects)
        </label>
      )}
      <button disabled={busy || name.trim().length < 2 || (!isDefault && !manager)} className={btn}>Add department</button>
      {error && <p role="alert" className={`basis-full ${ERR}`}>{error}</p>}
    </form>
  );
}

export function DepartmentRow({ department: d, users }: { department: DepartmentList["departments"][number]; users: Users }) {
  const { busy, error, save } = useSave();
  const [name, setName] = useState(d.name);
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label={`Name of ${d.name}`} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== d.name && void save("PUT", `/departments/${d.id}`, { name })} className={`${INPUT} w-56 font-medium`} />
        {d.isDefault ? (
          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs text-zinc-500">Default: every project without a matching manager</span>
        ) : (
          <label className="flex items-center gap-1 text-sm">
            <span className="text-zinc-500">Manager</span>
            <select aria-label={`Manager of ${d.name}`} disabled={busy} value={d.manager?.id ?? ""} onChange={(e) => void save("PUT", `/departments/${d.id}`, { managerUserId: e.target.value || null })} className={INPUT}>
              <option value="">None</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </select>
          </label>
        )}
        <span className="text-sm text-zinc-500">{d.projects.length} project{d.projects.length === 1 ? "" : "s"}</span>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {!d.isDefault && <button disabled={busy} onClick={() => void save("PUT", `/departments/${d.id}/default`)} className={btn}>Make default</button>}
          {!d.isDefault &&
            (confirming ? (
              <>
                Remove? Its projects go to the default.
                <button disabled={busy} onClick={() => void save("DELETE", `/departments/${d.id}`)} className={btn}>Yes, remove</button>
                <button onClick={() => setConfirming(false)} className={btn}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirming(true)} className={btn}>Remove</button>
            ))}
        </span>
      </div>
      {d.projects.length > 0 && (
        <p className="text-xs text-zinc-500">
          {d.projects.slice(0, 12).map((p) => p.name).join(", ")}
          {d.projects.length > 12 && ` +${d.projects.length - 12} more`}
        </p>
      )}
      {error && <p role="alert" className="text-xs text-status-fail-text">{error}</p>}
    </li>
  );
}

export function ProjectManagers({ users, projects, departments }: { users: Users; projects: DepartmentList["projects"]; departments: Array<{ id: string; name: string }> }) {
  const { busy, error, note, save } = useSave();
  const [userId, setUserId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const dept = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const shown = projects.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function apply(action: "add" | "remove") {
    if (await save("POST", "/departments/project-managers", { projectIds: [...picked], userId, action })) setPicked(new Set());
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Person</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={`${INPUT} w-52`}>
            <option value="">Choose…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Find a project</span>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} className={`${INPUT} w-56`} />
        </label>
        <button disabled={busy || !userId || picked.size === 0} onClick={() => void apply("add")} className={btn}>Add as manager ({picked.size})</button>
        <button disabled={busy || !userId || picked.size === 0} onClick={() => void apply("remove")} className={btn}>Remove as manager</button>
        <button onClick={() => setPicked(new Set(shown.slice(0, 300).map((p) => p.id)))} className={btn}>Tick all shown</button>
        <button onClick={() => setPicked(new Set())} className={btn}>Clear</button>
      </div>
      {note && <p role="status" className="text-sm text-status-pass-text">{note}</p>}
      {error && <p role="alert" className={ERR}>{error}</p>}
      <div className="max-h-96 overflow-auto rounded-md border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border-subtle text-left text-zinc-500">
              <th className="w-10 p-2" />
              <th className="p-2 font-medium">Project</th>
              <th className="p-2 font-medium">Managers</th>
              <th className="p-2 font-medium">Department</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {shown.map((p) => (
              <tr key={p.id}>
                <td className="p-2"><input type="checkbox" aria-label={`Select ${p.name}`} checked={picked.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2 text-zinc-500">{p.managers.map((m) => m.displayName).join(", ") || "—"}</td>
                <td className="p-2">{p.departmentId ? dept.get(p.departmentId) : <span className="text-zinc-500">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {picked.size >= 300 && <p className="text-xs text-zinc-500">At most 300 projects at a time.</p>}
    </div>
  );
}

/** The ServiceUser directory: add a person, rename them, or mark them as left (inactive). */
export function PeopleDirectory({ people }: { people: DepartmentList["directory"] }) {
  const { busy, error, save } = useSave();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="mt-3 space-y-3">
      <ul className="divide-y divide-border-subtle">
        {people.map((p) => <PersonRow key={p.id} person={p} />)}
      </ul>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await save("POST", "/users", { displayName: name, email: email || null })) {
            setName("");
            setEmail("");
          }
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${INPUT} w-56`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className={`${INPUT} w-64`} />
        </label>
        <button disabled={busy || !name.trim()} className={btn}>Add person</button>
        {error && <p role="alert" className={`basis-full ${ERR}`}>{error}</p>}
      </form>
    </div>
  );
}

function PersonRow({ person: p }: { person: DepartmentList["directory"][number] }) {
  const { busy, error, save } = useSave();
  const [name, setName] = useState(p.displayName);
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <input aria-label={`Name of ${p.displayName}`} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== p.displayName && void save("PATCH", `/users/${p.id}`, { displayName: name })} className={`${INPUT} w-56 ${p.active ? "" : "text-zinc-500 line-through"}`} />
      <span className="text-sm text-zinc-500">{p.email ?? "no email"}</span>
      {!p.active && <span className="rounded-full bg-status-not-tested-bg px-2 py-0.5 text-xs text-status-not-tested-text">Left</span>}
      <button disabled={busy} onClick={() => void save("PATCH", `/users/${p.id}`, { active: !p.active })} className={`${btn} ml-auto`}>
        {p.active ? "Mark as left" : "Mark as active"}
      </button>
      {error && <p role="alert" className="basis-full text-xs text-status-fail-text">{error}</p>}
    </li>
  );
}
