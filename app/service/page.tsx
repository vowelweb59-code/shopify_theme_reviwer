import Link from "next/link";
import { resolvePeriod } from "@/lib/service/ui/period";
import { DepartmentsTab } from "./_dashboard/departments-tab";
import { dashHref, PeriodBar, type TabId } from "./_dashboard/period-bar";
import { KIND_TABS, ProjectsTab } from "./_dashboard/projects-tab";
import { TeamsTab } from "./_dashboard/teams-tab";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string; g?: string; d?: string; from?: string; to?: string; all?: string; view?: string; kind?: string };

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "projects", label: "Projects" },
  { id: "teams", label: "Teams" },
  { id: "departments", label: "Department wise report" },
];

// Service Team dashboard (ported from the Upwork app's dashboard): Projects, Teams and Departments for any period.
export default async function ServiceDashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "projects";
  const period = resolvePeriod(sp);
  const showAll = sp.all === "1";
  const flat = sp.view === "all";
  const kind = KIND_TABS.find((k) => k.id === sp.kind)?.id ?? "direct";

  return (
    <div className="space-y-5">
      <nav aria-label="Dashboard sections" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={dashHref(t.id, period)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${tab === t.id ? "bg-primary-tint font-medium text-primary-tint-text" : "text-zinc-500 hover:bg-surface-muted hover:text-zinc-800 dark:hover:text-zinc-300"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <PeriodBar
        tab={tab}
        period={period}
        extra={(tab === "projects" ? `&kind=${kind}` : "") + (showAll && tab === "projects" ? "&all=1" : "") + (flat && tab === "teams" ? "&view=all" : "")}
      />

      {tab === "projects" && <ProjectsTab period={period} showAll={showAll} kind={kind} />}
      {tab === "teams" && <TeamsTab period={period} flat={flat} />}
      {tab === "departments" && <DepartmentsTab period={period} />}
    </div>
  );
}
