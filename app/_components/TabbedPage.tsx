"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode };

// Shared shell for a page split into sections via a tab strip rather than
// separate routes — the active tab is reflected in ?tab= (read once on
// mount, updated via router.replace) so a link to a specific tab is still
// shareable/bookmarkable even though the page itself is one route.
export function TabbedPageClient({
  title,
  description,
  tabs,
  defaultTabId,
  orientation = "horizontal",
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = tabs.some((t) => t.id === requestedTab) ? requestedTab! : defaultTabId;
  const [activeTab, setActiveTab] = useState(initialTab);

  function selectTab(id: string) {
    setActiveTab(id);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
      </div>

      {orientation === "vertical" ? (
        <div className="flex flex-col gap-2">
          {tabs.map((t) => {
            const isOpen = activeTab === t.id;
            return (
              <div key={t.id} className="rounded-lg border border-black/[.08] dark:border-white/[.145]">
                <button
                  type="button"
                  onClick={() => selectTab(isOpen ? "" : t.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-950 dark:text-zinc-50"
                >
                  {t.label}
                  <span aria-hidden className="text-zinc-400">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && <div className="border-t border-black/[.08] p-4 dark:border-white/[.145]">{t.content}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-black/[.08] dark:border-white/[.145]">
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
