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

export default async function ServiceOverviewPage() {
  await connectToDatabase();
  const [projects, clients] = await Promise.all([
    ServiceProject.find().select("name clientId contract").sort({ name: 1 }).lean<Row[]>(),
    ServiceClient.find().select("name").lean<Array<{ _id: string; name: string }>>(),
  ]);
  const clientName = new Map(clients.map((c) => [c._id, c.name]));
  const hourly = projects.filter((p) => p.contract?.type === "HOURLY").length;
  const fixed = projects.filter((p) => p.contract?.type === "FIXED").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-border-subtle bg-surface px-5 py-4">
          <div className="text-sm text-zinc-500">Total projects</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{projects.length.toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {hourly.toLocaleString("en-IN")} hourly · {fixed.toLocaleString("en-IN")} fixed
            {projects.length - hourly - fixed > 0 ? ` · ${(projects.length - hourly - fixed).toLocaleString("en-IN")} no contract` : ""}
          </div>
        </div>
      </div>

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
                  <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">{p.name}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{(p.clientId && clientName.get(p.clientId)) || "—"}</td>
                  <td className="px-3 py-2">
                    {!c ? <span className="text-zinc-400">No contract</span> : c.type === "FIXED" ? `Fixed${c.fixedPriceCents != null ? ` (${fmtUsd(c.fixedPriceCents)})` : ""}` : "Hourly"}
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
