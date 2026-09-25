"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { formatDateTime as formatDate } from "@/app/_components/formatDate";

type FeatureRow = {
  id: string;
  label: string;
  category: string;
  note: string | null;
  status: "detected" | "not_detected" | "not_checked";
};

type ThemeFeatures = {
  themeId: string;
  themeName: string;
  runId: string;
  startedAt: string;
  detectedCount: number;
  checkedCount: number;
  totalCount: number;
  features: FeatureRow[];
};


const STATUS_LABEL: Record<FeatureRow["status"], string> = {
  detected: "Detected",
  not_detected: "Not detected",
  not_checked: "Not yet checked",
};

const STATUS_CLASS: Record<FeatureRow["status"], string> = {
  detected: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  not_detected: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  not_checked: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

function ThemeChecklist({ theme }: { theme: ThemeFeatures }) {
  const grouped = useMemo(() => {
    const byCategory: Record<string, FeatureRow[]> = {};
    for (const f of theme.features) (byCategory[f.category] ??= []).push(f);
    return byCategory;
  }, [theme.features]);
  const categories = Object.keys(grouped);

  return (
    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {categories.map((category) => (
        <div key={category} className="rounded-lg border border-black/[.08] p-4 text-sm dark:border-white/[.145]">
          <h4 className="font-medium text-zinc-950 dark:text-zinc-50">{category}</h4>
          <ul className="mt-2 flex flex-col gap-1.5">
            {grouped[category].map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3">
                <span className="text-zinc-700 dark:text-zinc-300" title={f.note ?? undefined}>
                  {f.label}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[f.status]}`}>
                  {STATUS_LABEL[f.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AvailableFeaturesPage() {
  const [rows, setRows] = useState<ThemeFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/available-features")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setRows(data.themes ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageContainer>
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Available Features</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Shopify&apos;s optional Theme Store feature checklist, checked against each theme&apos;s latest audit.
          &quot;Not yet checked&quot; means no detector exists for that feature yet — it&apos;s never guessed at.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-zinc-500">No completed audits yet — run one from the Audit page.</p>
        )}
        {rows.map((theme) => {
          const isOpen = expanded === theme.themeId;
          return (
            <div key={theme.themeId} className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : theme.themeId)}
                className="flex w-full items-center justify-between text-left text-sm"
              >
                <span>
                  <span className="font-medium text-zinc-950 dark:text-zinc-50">{theme.themeName}</span>
                  <span className="ml-2 text-zinc-500">Latest audit {formatDate(theme.startedAt)}</span>
                </span>
                <span className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>
                    {theme.detectedCount}/{theme.checkedCount} checked features detected
                    {theme.checkedCount < theme.totalCount && ` (${theme.totalCount - theme.checkedCount} not yet checked)`}
                  </span>
                  <span aria-hidden>{isOpen ? "−" : "+"}</span>
                </span>
              </button>
              {isOpen && <ThemeChecklist theme={theme} />}
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
