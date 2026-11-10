"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";
import { INPUT } from "@/lib/service/ui/format";

const btn = "rounded-md border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60";

type Profile = { designation: string | null; team: string | null; salary: { monthly: number | null; currency: string } };

/** Designation, team and monthly salary of one team member (one shared login: everyone signed in may edit). */
export function ProfileCard({ id, profile }: { id: string; profile: Profile }) {
  const router = useRouter();
  const [designation, setDesignation] = useState(profile.designation ?? "");
  const [team, setTeam] = useState(profile.team ?? "");
  const [salary, setSalary] = useState(profile.salary.monthly != null ? String(profile.salary.monthly) : "");
  const [currency, setCurrency] = useState(profile.salary.currency || "INR");
  const [busy, setBusy] = useState<"profile" | "salary" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function run(kind: "profile" | "salary", path: string, body: unknown) {
    setBusy(kind);
    setError(null);
    setSaved(null);
    const r = await mutate("PUT", path, body);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSaved(kind === "profile" ? "Profile saved" : "Salary saved");
    router.refresh();
  }

  return (
    <section aria-labelledby="profile" className="rounded-lg border border-border-subtle bg-surface p-4">
      <h3 id="profile" className="mb-3 font-medium">Profile</h3>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run("profile", `/team/${id}/profile`, { designation: designation.trim() || null, team: team.trim() || null });
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Designation</span>
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={100} className={`${INPUT} w-56`} placeholder="e.g. Senior Developer" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Team</span>
          <input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={100} className={`${INPUT} w-48`} placeholder="e.g. Front End" />
        </label>
        <button disabled={busy !== null} className={btn}>{busy === "profile" ? "Saving…" : "Save profile"}</button>
      </form>

      <form
        className="mt-4 flex flex-wrap items-end gap-3 border-t border-border-subtle pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const monthly = salary === "" ? null : Number(salary);
          if (monthly !== null && !(monthly >= 0)) return setError("Enter the monthly salary as a number.");
          void run("salary", `/team/${id}/salary`, { monthly, currency });
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Monthly salary</span>
          <input inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value.replace(/[^\d.]/g, ""))} className={`${INPUT} w-40`} placeholder="0" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={INPUT}>
            <option value="INR">INR</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <button disabled={busy !== null} className={btn}>{busy === "salary" ? "Saving…" : "Save salary"}</button>
        <p className="basis-full text-xs text-zinc-500">Visible to everyone signed in to this app. It is never written to the audit log.</p>
      </form>
      {saved && <p role="status" className="mt-2 text-sm text-status-pass-text">{saved}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-status-fail-text">{error}</p>}
    </section>
  );
}
