"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectListRow } from "@/lib/service/api/projects";
import { mutate } from "@/lib/service/ui/client";
import { fmtHours, fmtUsd, ServiceStatusBadge, STATUS_OPTIONS } from "@/lib/service/ui/format";

const CLOSED = new Set(["COMPLETED", "CANCELLED", "ARCHIVED"]);
const field = "rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-sm";

export interface BulkOptions {
  canBulkEdit: boolean;
  profiles: Array<{ id: string; name: string }>;
  users: Array<{ id: string; displayName: string }>;
  businessAnalysts: string[];
  businessDevelopers: string[];
}

// What a bulk edit can change. Each scope shows only the inputs it needs.
const SCOPES = [
  { id: "status", label: "Status" },
  { id: "profile", label: "Upwork profile" },
  { id: "type", label: "Project type" },
  { id: "BUSINESS_ANALYST", label: "BA" },
  { id: "BUSINESS_DEVELOPER", label: "BD" },
  { id: "EXECUTIVE", label: "Executives" },
  { id: "manager", label: "Project manager" },
  { id: "inHouse", label: "In-house" },
  { id: "weekly", label: "Weekly hours allotted" },
  { id: "tracking", label: "Time tracking" },
] as const;
type Scope = (typeof SCOPES)[number]["id"];

/** A column header that sorts by that column when clicked, with an arrow on the sorted one. */
function SortLink({ k, label, sort, dir, hrefs }: { k: string; label: string; sort: string; dir: string; hrefs: Record<string, string> }) {
  const on = sort === k;
  return (
    <Link
      href={hrefs[k]}
      className={`inline-flex items-center gap-1 uppercase hover:text-zinc-900 dark:hover:text-zinc-100 ${on ? "text-zinc-900 dark:text-zinc-100" : ""}`}
      title={on ? (dir === "asc" ? "Sorted ascending, click for descending" : "Sorted descending, click to clear") : `Sort by ${label}`}
    >
      {label}
      <span aria-hidden="true" className={on ? "" : "opacity-30"}>{on ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </Link>
  );
}

const muted = <span className="text-zinc-400">—</span>;

/** The projects table, with checkboxes and a bulk edit bar. */
export function ProjectsTable({ rows, showKind, options, sort, dir, sortHrefs }: { rows: ProjectListRow[]; showKind: boolean; options: BulkOptions; sort: string; dir: string; sortHrefs: Record<string, string> }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<Scope>("status");
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"replace" | "add" | "remove">("add");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const bulk = options.canBulkEdit;
  const allOnPage = rows.length > 0 && rows.every((r) => picked.has(r.id));

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pickPage = () =>
    setPicked((s) => {
      const n = new Set(s);
      for (const r of rows) if (allOnPage) n.delete(r.id);
      else n.add(r.id);
      return n;
    });

  function action(): object | string {
    switch (scope) {
      case "status":
        return value ? { kind: "status", to: value, ...(reason.trim() ? { reason: reason.trim() } : {}) } : "Choose the new status.";
      case "profile":
        return { kind: "profile", profileId: value || null };
      case "type":
        return value ? { kind: "contract", type: value } : "Choose hourly or fixed.";
      case "BUSINESS_ANALYST":
      case "BUSINESS_DEVELOPER":
      case "EXECUTIVE": {
        const names = value.split(",").map((x) => x.trim()).filter(Boolean);
        if (!names.length && mode !== "replace") return "Type at least one name.";
        return { kind: "people", role: scope, mode, names };
      }
      case "manager":
        return value ? { kind: "manager", mode: mode === "remove" ? "remove" : "add", userId: value } : "Choose a person.";
      case "inHouse":
        return { kind: "inHouse", value: value === "yes" };
      case "weekly": {
        if (value.trim() === "") return { kind: "contract", weeklyLimitMinutes: null };
        const h = Number(value);
        return Number.isFinite(h) && h >= 0 && h <= 168 ? { kind: "contract", weeklyLimitMinutes: Math.round(h * 60) } : "Weekly hours must be 0 to 168.";
      }
      case "tracking":
        return { kind: "contract", trackingMode: value || null };
    }
  }

  async function apply() {
    const a = action();
    if (typeof a === "string") return setResult({ ok: false, text: a });
    setBusy(true);
    setResult(null);
    const r = await mutate<{ changed: number; skipped: Array<{ name: string; reason: string }> }>("POST", "/projects/bulk", { projectIds: [...picked], action: a });
    setBusy(false);
    if (!r.ok) return setResult({ ok: false, text: r.error });
    const s = r.data.skipped;
    setResult({ ok: s.length === 0, text: `Changed ${r.data.changed}.${s.length ? ` Skipped ${s.length}: ${s.slice(0, 5).map((x) => `${x.name} (${x.reason})`).join("; ")}${s.length > 5 ? "…" : ""}` : ""}` });
    setPicked(new Set());
    router.refresh();
  }

  const people = scope === "BUSINESS_ANALYST" ? options.businessAnalysts : scope === "BUSINESS_DEVELOPER" ? options.businessDevelopers : [];
  const th = (k: string, label: string, extra = "", title?: string) => (
    <th aria-sort={sort === k ? (dir === "desc" ? "descending" : "ascending") : undefined} className={`px-4 py-2.5 font-medium ${extra}`} title={title}>
      <SortLink k={k} label={label} sort={sort} dir={dir} hrefs={sortHrefs} />
    </th>
  );

  return (
    <div className="space-y-3">
      {bulk && picked.size > 0 && (
        <div role="region" aria-label="Bulk edit" className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-surface p-3 shadow-sm">
          <span className="text-sm font-medium">{picked.size} selected</span>
          <label className="text-sm text-zinc-500" htmlFor="bulk-scope">Change</label>
          <select id="bulk-scope" value={scope} onChange={(e) => { setScope(e.target.value as Scope); setValue(""); setResult(null); }} className={field}>
            {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          {scope === "status" && (
            <>
              <select aria-label="New status" value={value} onChange={(e) => setValue(e.target.value)} className={field}>
                <option value="">to…</option>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (needed to reopen)" className={`${field} w-56`} />
            </>
          )}
          {scope === "profile" && (
            <select aria-label="Upwork profile" value={value} onChange={(e) => setValue(e.target.value)} className={field}>
              <option value="">No profile</option>
              {/* Direct = paid outside Upwork */}
              {options.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {scope === "type" && (
            <select aria-label="Project type" value={value} onChange={(e) => setValue(e.target.value)} className={field}>
              <option value="">to…</option>
              <option value="HOURLY">Hourly</option>
              <option value="FIXED">Fixed price</option>
            </select>
          )}
          {(scope === "BUSINESS_ANALYST" || scope === "BUSINESS_DEVELOPER" || scope === "EXECUTIVE") && (
            <>
              <select aria-label="How" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={field}>
                <option value="add">Add</option>
                <option value="remove">Remove</option>
                <option value="replace">Replace with</option>
              </select>
              <input aria-label="Names" list="bulk-people" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Names, comma separated" className={`${field} w-64`} />
              <datalist id="bulk-people">{people.map((n) => <option key={n} value={n} />)}</datalist>
            </>
          )}
          {scope === "manager" && (
            <>
              <select aria-label="How" value={mode === "remove" ? "remove" : "add"} onChange={(e) => setMode(e.target.value as typeof mode)} className={field}>
                <option value="add">Add</option>
                <option value="remove">Remove</option>
              </select>
              <select aria-label="Person" value={value} onChange={(e) => setValue(e.target.value)} className={field}>
                <option value="">Choose…</option>
                {options.users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
              </select>
            </>
          )}
          {scope === "inHouse" && (
            <select aria-label="In-house" value={value} onChange={(e) => setValue(e.target.value)} className={field}>
              <option value="">Not in-house</option>
              <option value="yes">In-house (our own work)</option>
            </select>
          )}
          {scope === "weekly" && <input aria-label="Weekly hours" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Hours, blank = no limit" className={`${field} w-44`} />}
          {scope === "tracking" && (
            <select aria-label="Time tracking" value={value} onChange={(e) => setValue(e.target.value)} className={field}>
              <option value="">Not set</option>
              <option value="TIMER">Timer</option>
              <option value="MANUAL">Manual</option>
            </select>
          )}

          <button disabled={busy} onClick={() => void apply()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
            {busy ? "Applying…" : `Apply to ${picked.size}`}
          </button>
          <button onClick={() => setPicked(new Set())} className="px-2 py-1.5 text-sm text-primary hover:underline">Clear selection</button>
        </div>
      )}
      {result && <p role="status" className={`text-sm ${result.ok ? "text-status-pass-text" : "text-status-warning-text"}`}>{result.text}</p>}

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-muted text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {bulk && (
                <th className="w-10 px-4 py-2.5">
                  <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={pickPage} />
                </th>
              )}
              {th("name", "Project")}
              {th("status", "Status")}
              {th("hours", "Hours", "text-right", "All hours reported in Chat")}
              {th("rate", "Rate", "text-right", "Hourly rate in US dollars")}
              {th("quota", "Weekly quota", "text-right", "Weekly hours allotted")}
              {th("pm", "PM")}
              {th("ba", "BA")}
              {th("bd", "BD")}
              {th("review", "Review")}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((p) => (
              <tr key={p.id} className={picked.has(p.id) ? "bg-primary-tint" : "hover:bg-surface-muted"}>
                {bulk && (
                  <td className="px-4 py-2.5">
                    <input type="checkbox" aria-label={`Select ${p.name}`} checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <Link href={`/service/projects/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link>
                  {showKind && p.kind === "inhouse" && <span className="ml-2 rounded-full bg-status-warning-bg px-1.5 py-0.5 text-xs text-status-warning-text">In-house</span>}
                  {showKind && (p.kind === "fixed" || p.kind === "direct") && <span className="ml-2 text-xs text-zinc-500">{p.kind === "fixed" ? "Fixed" : "Direct"}</span>}
                </td>
                <td className="px-4 py-2.5"><ServiceStatusBadge status={p.status} /></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{p.minutes ? fmtHours(p.minutes) : muted}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {p.kind === "fixed" ? (p.fixedPriceCents ? <>{fmtUsd(p.fixedPriceCents)}<span className="text-xs text-zinc-500"> fixed</span></> : muted) : p.hourlyRateCents ? fmtUsd(p.hourlyRateCents) : muted}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{p.weeklyLimitMinutes ? fmtHours(p.weeklyLimitMinutes) : muted}</td>
                <td className="px-4 py-2.5">{p.projectManagers.length ? p.projectManagers.join(", ") : muted}</td>
                <td className="px-4 py-2.5">{p.businessAnalysts.length ? p.businessAnalysts.join(", ") : muted}</td>
                <td className="px-4 py-2.5">{p.businessDevelopers.length ? p.businessDevelopers.join(", ") : muted}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {!CLOSED.has(p.status) ? (
                    <span className="text-status-warning-text">Pending</span>
                  ) : p.reviewRating != null ? (
                    <span title={`${p.reviewRating.toFixed(1)} out of 5`}><span className="text-status-warning-icon">★</span> {p.reviewRating.toFixed(1)}</span>
                  ) : (
                    <span className="text-zinc-500">No rating</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
