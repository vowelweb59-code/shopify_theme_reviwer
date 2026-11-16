import Link from "next/link";
import { connectToDatabase } from "@/lib/db/connect";
import { fmtUsd } from "@/lib/service/ui/format";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";

export const dynamic = "force-dynamic";

// Owner, 2026-11-16: the Service section shows only the total projects and one table (hourly rate, weekly quote, Fixed/Hourly) for
// now; the rest is hidden and will be shown step by step. The former dashboard lives on in app/service/_dashboard/* (unused for now;
// restore it from git, commit before "Service: show only total projects", to bring it back).

type Row = {
  _id: string;
  name: string;
  clientId: string | null;
  contract: { type: "HOURLY" | "FIXED"; hourlyRateCents: number | null; weeklyLimitMinutes: number | null; fixedPriceCents: number | null } | null;
};

const hours = (minutes: number) => (minutes / 60).toLocaleString("en-IN", { maximumFractionDigits: 1 });

// Every contract made in the old app defaulted to HOURLY, so an hourly contract with no rate and no weekly quote has a type nobody
// chose (owner, 2026-11-16: "Aadhar Layouts" showed Hourly but was a $172 fixed project). It shows "Not set", only under All.
type Kind = "hourly" | "fixed" | "unset";
const kindOf = (p: Row): Kind =>
  p.contract?.type === "FIXED" ? "fixed" : p.contract && (p.contract.hourlyRateCents != null || p.contract.weeklyLimitMinutes != null) ? "hourly" : "unset";

// Owner, 2026-11-16: tabs instead of the total card; Timer (hourly contracts) opens by default, then Fixed, then All.
const TABS = [
  { id: "timer", label: "Timer projects", match: (p: Row) => kindOf(p) === "hourly" },
  { id: "fixed", label: "Fixed projects", match: (p: Row) => kindOf(p) === "fixed" },
  { id: "all", label: "All projects", match: () => true },
] as const;

export default async function ServiceOverviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS[0];
  await connectToDatabase();
  const [all, clients] = await Promise.all([
    ServiceProject.find().select("name clientId contract").sort({ name: 1 }).lean<Row[]>(),
    ServiceClient.find().select("name").lean<Array<{ _id: string; name: string }>>(),
  ]);
  const clientName = new Map(clients.map((c) => [c._id, c.name]));
  const projects = all.filter(tab.match);

  return (
    <div className="space-y-5">
      <nav aria-label="Project type" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.id === tab.id;
          return (
            <Link
              key={t.id}
              href={t.id === "timer" ? "/service" : `/service?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg border px-4 py-3 transition-colors ${active ? "border-primary bg-primary-tint" : "border-border-subtle bg-surface hover:bg-surface-muted"}`}
            >
              <div className={`text-sm ${active ? "font-medium text-primary-tint-text" : "text-zinc-500"}`}>{t.label}</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{all.filter(t.match).length.toLocaleString("en-IN")}</div>
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Project type</th>
              <th className="px-3 py-2 text-right font-medium">Hourly rate</th>
              <th className="px-3 py-2 text-right font-medium">Weekly quote</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {projects.map((p) => {
              const c = p.contract;
              return (
                <tr key={p._id}>
                  <td className="px-3 py-2">
                    <Link href={`/service/projects/${p._id}`} className="text-zinc-900 hover:text-primary hover:underline dark:text-zinc-100">{p.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{(p.clientId && clientName.get(p.clientId)) || "—"}</td>
                  <td className="px-3 py-2">
                    {!c ? (
                      <span className="text-zinc-400">No contract</span>
                    ) : kindOf(p) === "fixed" ? (
                      `Fixed${c.fixedPriceCents != null ? ` (${fmtUsd(c.fixedPriceCents)})` : ""}`
                    ) : kindOf(p) === "hourly" ? (
                      "Hourly"
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400" title="No rate or weekly quote entered: open the project to set Fixed or Hourly">Not set</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c?.hourlyRateCents != null ? `${fmtUsd(c.hourlyRateCents)}/h` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c?.weeklyLimitMinutes != null ? `${hours(c.weeklyLimitMinutes)} h/week` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
