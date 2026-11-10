"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Contract } from "@/lib/service/api/hours";
import { mutate } from "@/lib/service/ui/client";

/**
 * Contract type, weekly hours allotted, hourly rate / fixed price and how time is tracked. Weekly hours are typed by hand
 * (there is no Upwork connection); on a fixed project they are the weekly budget divided by the standard rate.
 */
export function ContractEditor({ projectId, contract }: { projectId: string; contract: Contract | null }) {
  const router = useRouter();
  const [type, setType] = useState<"HOURLY" | "FIXED">(contract?.type ?? "HOURLY");
  const limit = contract?.weeklyLimitMinutes ?? null;
  const [hours, setHours] = useState(limit === null ? "" : String(Math.floor(limit / 60)));
  const [mins, setMins] = useState(limit === null ? "" : String(limit % 60));
  const [rate, setRate] = useState(contract?.hourlyRateCents != null ? (contract.hourlyRateCents / 100).toFixed(2) : "");
  const [fixedPrice, setFixedPrice] = useState(contract?.fixedPriceCents != null ? (contract.fixedPriceCents / 100).toFixed(2) : "");
  const [tracking, setTracking] = useState<"" | "TIMER" | "MANUAL">(contract?.trackingMode ?? "");
  const [ref, setRef] = useState(contract?.externalRef ?? "");
  const [status, setStatus] = useState<Contract["status"]>(contract?.status ?? "ACTIVE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const total = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    const blank = hours === "" && mins === "";
    if (!blank && (total <= 0 || total > 168 * 60 || Number(mins) > 59)) return setError("Enter weekly hours between 1 minute and 168 hours (minutes 0–59).");
    if (rate !== "" && !(Number(rate) >= 0 && Number(rate) <= 10000)) return setError("Enter the hourly rate in dollars, for example 15 or 12.50.");
    if (type === "FIXED" && fixedPrice !== "" && !(Number(fixedPrice) >= 0 && Number(fixedPrice) <= 1000000)) return setError("Enter the fixed price in dollars, for example 900.");
    setBusy(true);
    const r = await mutate("PUT", `/projects/${projectId}/contract`, {
      type,
      status,
      externalRef: ref.trim() || null,
      trackingMode: tracking || null,
      weeklyLimitMinutes: total > 0 ? total : null,
      hourlyRateCents: rate === "" ? null : Math.round(Number(rate) * 100),
      ...(type === "FIXED" ? { fixedPriceCents: fixedPrice === "" ? null : Math.round(Number(fixedPrice) * 100) } : {}),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSaved(true);
    router.refresh();
  }

  const input = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Project type</span>
        <select value={type} onChange={(e) => setType(e.target.value as "HOURLY" | "FIXED")} className={input}>
          <option value="HOURLY">Hourly</option>
          <option value="FIXED">Fixed price</option>
        </select>
      </label>
      <fieldset className="text-sm">
        <legend className="mb-1 text-zinc-500">Weekly hours allotted</legend>
        <div className="flex items-center gap-1">
          <input aria-label="Weekly hours allotted, hours" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ""))} className={`${input} w-16`} placeholder="e.g. 40" />
          <span>h</span>
          <input aria-label="Weekly hours allotted, minutes" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, ""))} className={`${input} w-16`} placeholder="e.g. 0" />
          <span>m</span>
        </div>
      </fieldset>
      {type === "FIXED" && (
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Fixed price (USD)</span>
          <input inputMode="decimal" value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value.replace(/[^\d.]/g, ""))} className={`${input} w-28`} placeholder="e.g. 900" />
        </label>
      )}
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Hourly rate (USD)</span>
        <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className={`${input} w-24`} placeholder="e.g. 15.00" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Time tracking</span>
        <select value={tracking} onChange={(e) => setTracking(e.target.value as "" | "TIMER" | "MANUAL")} className={input}>
          <option value="">Not set</option>
          <option value="TIMER">Timer</option>
          <option value="MANUAL">Manual</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Upwork contract id (optional)</span>
        <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={200} className={`${input} w-48`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Contract status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as Contract["status"])} className={input}>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="ENDED">Ended</option>
        </select>
      </label>
      <button disabled={busy} className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60">
        {busy ? "Saving…" : contract ? "Save contract" : "Create contract"}
      </button>
      {saved && <span role="status" className="text-sm text-status-pass-text">Saved</span>}
      {error && <p role="alert" className="basis-full text-sm text-status-fail-text">{error}</p>}
    </form>
  );
}
