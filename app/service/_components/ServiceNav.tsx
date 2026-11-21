"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The Service Team section's own tab strip: every page under /service sits behind it, apart from the theme team's pages.
// Owner, 2026-11-16: only the projects overview is shown for now; the other tabs are hidden (their pages still exist and open by
// URL) and will be brought back one at a time by moving them into VISIBLE.
const VISIBLE = new Set(["/service", "/service/revenue", "/service/performance", "/service/analytics"]);
const ALL_TABS = [
  { href: "/service", label: "Projects", exact: true },
  { href: "/service/revenue", label: "Revenue" },
  { href: "/service/performance", label: "Team performance" },
  { href: "/service/analytics", label: "Analytics" },
  { href: "/service/projects", label: "Projects" },
  { href: "/service/team", label: "Team" },
  { href: "/service/departments", label: "Departments" },
  { href: "/service/review", label: "Review hours", exact: true },
  { href: "/service/review/clients", label: "Clients" },
  { href: "/service/review/profiles", label: "Upwork profiles" },
  { href: "/service/review/senders", label: "Chat senders" },
  { href: "/service/chat", label: "Chat sync" },
];
const TABS = ALL_TABS.filter((t) => VISIBLE.has(t.href));

export function ServiceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Service team" className="flex flex-wrap gap-1 border-b border-border-subtle">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${active ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
