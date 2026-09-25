"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { EmptyState, ErrorState } from "@/app/_components/ui/EmptyState";
import type { PublicAnalyticsTheme } from "@/lib/analytics/themes";
import { DashboardControls, type ThemeOption } from "./DashboardControls";
import { FilterBar } from "./FilterBar";
import { useApi } from "./useApi";
import { useDashboardParams } from "./useDashboardParams";

export const ANALYTICS_SECTIONS = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/geography", label: "Geography" },
  { href: "/analytics/acquisition", label: "Acquisition" },
  { href: "/analytics/technology", label: "Technology" },
  { href: "/analytics/pages", label: "Pages" },
  { href: "/analytics/events", label: "Events" },
  { href: "/analytics/journey", label: "Journey" },
] as const;

/**
 * Shared frame for every /analytics page: title, the global controls
 * (theme, date range, comparison), the filter bar, and section links that
 * carry the current selection along. Pages render below it and read the
 * same URL state. With no theme mapped yet, the empty state replaces them.
 */
export function AnalyticsShell({ children }: { children: ReactNode }) {
  const { params, setParams, ready, linkQuery } = useDashboardParams();
  const pathname = usePathname();
  const themesApi = useApi<{ themes: PublicAnalyticsTheme[] }>("/api/analytics/themes");

  const themeOptions: ThemeOption[] = (themesApi.data?.themes ?? [])
    .filter((t) => t.isActive)
    .map((t) => ({ slug: t.slug, name: t.name, mapped: Boolean(t.ga4PropertyId) }));
  const noThemesConnected = themesApi.data !== null && !themeOptions.some((t) => t.mapped);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Theme interest → Try Theme → Theme Installation, from each theme&apos;s GA4 property. Figures are read from the synced copy in this app, not
          live from GA4.
        </p>
      </div>

      {themesApi.error && <ErrorState title="Couldn't load the theme list" description={themesApi.error} />}

      {noThemesConnected ? (
        <EmptyState
          icon={BarChart3}
          title="No themes are connected to GA4 yet"
          description="Connect a Google account and map each theme to its GA4 property. Its full history syncs automatically."
          action={
            <Link href="/settings?tab=analytics" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Go to Settings → GA4 Analytics
            </Link>
          }
        />
      ) : (
        <>
          <DashboardControls params={params} onChange={setParams} themes={themeOptions} />
          <FilterBar params={params} onChange={setParams} />

          <nav aria-label="Analytics sections" className="-mb-2 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border-subtle [scrollbar-width:none]">
            {ANALYTICS_SECTIONS.map((s) => {
              const active = pathname === s.href;
              return (
                <Link
                  key={s.href}
                  href={linkQuery ? `${s.href}?${linkQuery}` : s.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors ${
                    active ? "border-primary font-medium text-primary" : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>

          {ready ? children : <p className="text-sm text-zinc-500">Choose a start and end date, then Apply.</p>}
        </>
      )}
    </div>
  );
}
