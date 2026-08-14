"use client";

import { useEffect, useMemo, useState } from "react";
import { PROJECT_PHASES, overallCompletionPercent, type PhaseStatus } from "@/lib/projectStatus";

type Requirement = { ruleStatus: string };

const STATUS_DOT: Record<PhaseStatus, string> = {
  done: "bg-emerald-500",
  "in-progress": "bg-amber-500",
  "not-started": "bg-zinc-400 dark:bg-zinc-600",
};

const STATUS_LABEL: Record<PhaseStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  "not-started": "Not started",
};

export function ProjectStatusWidget() {
  const [open, setOpen] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[] | null>(null);

  useEffect(() => {
    if (!open || requirements !== null) return;
    let active = true;
    fetch("/api/requirements")
      .then((res) => res.json())
      .then((data) => {
        if (active) setRequirements(data.requirements ?? []);
      })
      .catch(() => {
        if (active) setRequirements([]);
      });
    return () => {
      active = false;
    };
  }, [open, requirements]);

  const coverage = useMemo(() => {
    if (!requirements) return null;
    const total = requirements.length;
    const implemented = requirements.filter((r) => r.ruleStatus === "implemented").length;
    const partial = requirements.filter((r) => r.ruleStatus === "partial").length;
    return { total, implemented, partial };
  }, [requirements]);

  const percent = overallCompletionPercent();

  return (
    <div className="fixed right-4 top-24 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="w-72 rounded-lg border border-black/[.08] bg-zinc-50/95 p-4 text-sm shadow-lg backdrop-blur dark:border-white/[.145] dark:bg-black/95">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-950 dark:text-zinc-50">Project status</span>
            <span className="text-xs text-zinc-500">~{percent}% complete</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Approximate — reflects phase progress, not a precise metric.</p>

          <ul className="mt-3 flex flex-col gap-1.5">
            {PROJECT_PHASES.map((p) => (
              <li key={p.phase} className="group relative flex items-start gap-2">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[p.status]}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-800 dark:text-zinc-200">
                      Phase {p.phase} — {p.name}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">{STATUS_LABEL[p.status]}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-black/[.08] pt-3 text-xs text-zinc-500 dark:border-white/[.145]">
            {coverage ? (
              <p>
                Requirement coverage: {coverage.implemented} implemented, {coverage.partial} partial, of{" "}
                {coverage.total} total.
              </p>
            ) : (
              <p>Loading requirement coverage…</p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Project completion status"
        className="flex items-center gap-2 rounded-full border border-black/[.08] bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 shadow-md hover:text-zinc-950 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
      >
        <span className="relative inline-flex h-6 w-6 items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${(percent / 100) * 62.8} 62.8`}
              strokeLinecap="round"
            />
          </svg>
        </span>
        {percent}%
      </button>
    </div>
  );
}
