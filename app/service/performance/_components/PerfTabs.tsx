"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Internal tabs of the Team performance section (owner, 2026-11-20): Overview (this week's availability and occupancy) and Members (every
// member's whole record). A member's own page sits under Members.
const TABS = [
  { href: "/service/performance", label: "Overview", exact: true },
  { href: "/service/performance/members", label: "Members" },
];

export function PerfTabs() {
  const pathname = usePathname();
  // A member's page (/service/performance/<name>) belongs to Members.
  const onMember = pathname.startsWith("/service/performance/") && pathname !== "/service/performance/members" && !pathname.startsWith("/service/performance/members/");
  return (
    <nav aria-label="Team performance" className="inline-flex gap-1 rounded-xl border border-border-subtle bg-surface-muted p-1">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`) || onMember;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3.5 py-1.5 text-sm transition-colors ${active ? "bg-surface font-semibold text-zinc-900 shadow-sm ring-1 ring-border-subtle dark:text-zinc-100" : "text-zinc-500 hover:bg-surface/60 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
