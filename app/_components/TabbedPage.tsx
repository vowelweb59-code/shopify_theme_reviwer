"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode };

// Shared shell for a page split into sections via a tab strip rather than
// separate routes — the active tab is reflected in ?tab= (read once on
// mount, updated via router.replace) so a link to a specific tab is still
// shareable/bookmarkable even though the page itself is one route. Does
// NOT own its own outer page container/padding — the caller wraps this in
// PageContainer (and renders its own Breadcrumbs above it, if any), so
// every page's spacing traces to one place.
export function TabbedPageClient({
  title,
  description,
  tabs,
  defaultTabId,
  orientation = "horizontal",
  activeTabId: controlledActiveTabId,
  onTabChange,
}: {
  title: string;
  description?: ReactNode;
  tabs: Tab[];
  defaultTabId: string;
  // "horizontal" (default, unchanged — /settings uses this): an underline
  // tab strip above a single content area. "vertical": a stacked,
  // collapsible list of section headers — clicking one expands its content
  // inline and collapses whichever else was open (single-open accordion,
  // same idiom as the PointCard/CheckRow lists elsewhere in this app).
  orientation?: "horizontal" | "vertical";
  // Optional controlled mode — when given, the parent owns which tab is
  // active (e.g. Theme Detail switching to "Report" when a previous audit
  // is picked from another section) instead of this component tracking it
  // internally. Omit both for the normal uncontrolled behavior.
  activeTabId?: string;
  onTabChange?: (id: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = tabs.some((t) => t.id === requestedTab) ? requestedTab! : defaultTabId;
  const [internalActiveTab, setInternalActiveTab] = useState(initialTab);
  const activeTab = controlledActiveTabId ?? internalActiveTab;

  function selectTab(id: string) {
    if (onTabChange) onTabChange(id);
    else setInternalActiveTab(id);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-zinc-500">{description}</p>}
      </div>

      {orientation === "vertical" ? (
        <div className="flex flex-col gap-2">
          {tabs.map((t) => {
            const isOpen = activeTab === t.id;
            return (
              <div key={t.id} className="rounded-lg border border-border-subtle">
                <button
                  type="button"
                  onClick={() => selectTab(isOpen ? "" : t.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-950 dark:text-zinc-50"
                >
                  {t.label}
                  {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-400" aria-hidden /> : <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />}
                </button>
                {isOpen && <div className="border-t border-border-subtle p-4">{t.content}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-border-subtle">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === t.id
                    ? "border-zinc-950 text-zinc-950 dark:border-zinc-50 dark:text-zinc-50"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {(tabs.find((t) => t.id === activeTab) ?? tabs[0]).content}
        </>
      )}
    </div>
  );
}
