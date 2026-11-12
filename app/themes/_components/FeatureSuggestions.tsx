"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { portfolioSuggestions, suggestionsByTheme, type ThemeFeatureInput } from "@/lib/themes/featureSuggestions";

type View = "features" | "themes";

/**
 * "What to build next", above the Feature Availability table: the features the live themes still lack, either ranked across the
 * whole portfolio (the gaps most themes share) or per theme (what it lacks that its sibling themes already ship). A feature
 * counts as present when the theme's code, its live demo store or its Theme Store listing shows it.
 */
export function FeatureSuggestions({ themes }: { themes: ThemeFeatureInput[] }) {
  const [view, setView] = useState<View>("features");
  const portfolio = useMemo(() => portfolioSuggestions(themes, 10), [themes]);
  const perTheme = useMemo(() => suggestionsByTheme(themes, 8), [themes]);
  if (themes.length === 0) return null;

  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Lightbulb className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Suggested feature updates</h3>
            <p className="mt-0.5 max-w-2xl text-sm text-zinc-500">
              Features the themes still lack, from the catalog below. Feature updates keep a theme competitive on the Theme Store, so these are the next ones to build.
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-border-subtle bg-surface-muted p-0.5 text-xs font-medium" role="tablist" aria-label="Suggestion view">
          {(
            [
              ["features", "Across themes"],
              ["themes", "Per theme"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`rounded-md px-3 py-1.5 transition-colors ${view === id ? "bg-surface text-zinc-900 shadow-sm dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "features" ? (
        portfolio.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Every theme already has every feature in the catalog.</p>
        ) : (
          <ol className="mt-4 grid gap-2.5 md:grid-cols-2">
            {portfolio.map((g, i) => (
              <li key={g.feature.id} className="rounded-lg border border-border-subtle bg-surface-muted/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] font-semibold text-primary-tint-text">{i + 1}</span>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{g.feature.label}</div>
                      <div className="text-[11px] text-zinc-500">{g.feature.category}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-status-warning-text">
                      {g.missing.length}/{themes.length}
                    </div>
                    <div className="text-[11px] text-zinc-500">missing</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" title={`${g.have.length} of ${themes.length} themes have it`}>
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round((g.missing.length / themes.length) * 100)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {g.missing.slice(0, 6).map((name) => (
                    <span key={name} className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                      {name}
                    </span>
                  ))}
                  {g.missing.length > 6 && <span className="px-1 py-0.5 text-[11px] text-zinc-500">+{g.missing.length - 6} more</span>}
                </div>
              </li>
            ))}
          </ol>
        )
      ) : (
        <ul className="mt-4 grid gap-2.5 md:grid-cols-2">
          {perTheme.map((t) => (
            <li key={t.theme} className="rounded-lg border border-border-subtle bg-surface-muted/50 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.theme}</span>
                <span className={`text-[11px] tabular-nums ${t.total === 0 ? "text-status-pass-text" : "text-zinc-500"}`}>
                  {t.total === 0 ? "Has every feature" : `${t.total} feature${t.total === 1 ? "" : "s"} to add`}
                </span>
              </div>
              {t.gaps.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.gaps.map((g) => (
                    <span
                      key={g.feature.id}
                      className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-300"
                      title={`${g.feature.category}. ${g.haveCount} of ${themes.length} themes already have it`}
                    >
                      {g.feature.label}
                      <span className="ml-1 text-amber-700/70 dark:text-amber-300/70">{g.haveCount}/{themes.length}</span>
                    </span>
                  ))}
                  {t.total > t.gaps.length && <span className="px-1 py-0.5 text-[11px] text-zinc-500">+{t.total - t.gaps.length} more</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-zinc-500">Per-theme chips show how many of the {themes.length} themes already have that feature: the higher, the more proven it is.</p>
    </section>
  );
}
