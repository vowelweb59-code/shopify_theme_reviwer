import Link from "next/link";
import { connectToDatabase } from "@/lib/db/connect";
import { loadPerformance } from "@/lib/service/performance/load";
import { fmtLongDay, fmtMinutes, fmtUsd } from "@/lib/service/ui/format";
import { Stat, stars } from "../_components/PerfBits";

export const dynamic = "force-dynamic";

// Team performance > Members (owner, 2026-11-20): every member's whole record, biggest earner first. Click a name for the member's page.
export default async function MembersPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const showAll = all === "1";
  await connectToDatabase();
  const data = await loadPerformance(null);
  const everyone = data.members;
  const people = (showAll ? everyone : everyone.filter((m) => m.active)).sort((a, b) => b.valueCents - a.valueCents || a.name.localeCompare(b.name));
  const inactive = everyone.length - everyone.filter((m) => m.active).length;
  const total = { minutes: people.reduce((n, m) => n + m.totalMinutes, 0), value: people.reduce((n, m) => n + m.valueCents, 0) };
  const rated = people.flatMap((m) => m.projects).filter((p) => p.rating !== null);
  const th = "px-4 py-2.5 font-medium";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Members" value={String(people.length)} note={showAll ? "including inactive" : inactive ? `${inactive} inactive hidden` : undefined} />
        <Stat label="Hours reported" value={fmtMinutes(total.minutes)} />
        <Stat label="Value earned" value={fmtUsd(total.value)} note="hours × each project's rate" />
        <Stat label="Reviewed project-shares" value={String(rated.length)} note="projects with a closing review, per member" />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">Sorted by value earned, highest first.</span>
        <Link href={showAll ? "/service/performance/members" : "/service/performance/members?all=1"} className="text-primary hover:underline">
          {showAll ? "Hide inactive members" : "Show inactive members"}
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className={th}>Member</th>
              <th className={`${th} text-right`}>Projects handled</th>
              <th className={`${th} text-right`}>Hours</th>
              <th className={`${th} text-right`}>Value earned</th>
              <th className={`${th} text-right`}>Average review</th>
              <th className={`${th} text-right`}>Last report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {people.map((m) => (
              <tr key={m.key} className="hover:bg-surface-muted/50">
                <td className="px-4 py-2.5">
                  <Link href={`/service/performance/${m.slug}`} className="font-medium text-zinc-900 hover:text-primary hover:underline dark:text-zinc-100">
                    {m.name}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {m.left ? "Left the company" : !m.active ? "Inactive (no report in 2 months)" : (m.designation ?? "")}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {m.projectsHandled}
                  <div className="text-xs text-zinc-500">{m.projectsNow} running</div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtMinutes(m.totalMinutes)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {fmtUsd(m.valueCents)}
                  {m.unpricedMinutes > 0 && <div className="text-xs font-normal text-zinc-500">+ {fmtMinutes(m.unpricedMinutes)} unpriced</div>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {stars(m.weightedRating)}
                  <div className="text-xs text-zinc-500">{m.ratedProjects ? `${m.ratedProjects} reviewed` : "no reviews"}</div>
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-500">{m.lastReport ? fmtLongDay(m.lastReport) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Average review = each reviewed project&apos;s closing rating weighted by the member&apos;s hours on it. Value earned = hours × the project&apos;s hourly
        rate (fixed work with no rate at $15/h; hourly work with no rate is left unpriced). Reported hours, not Upwork-verified.
      </p>
    </div>
  );
}
