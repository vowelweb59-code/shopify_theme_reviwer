import Link from "next/link";
import { load } from "@/lib/service/api/http";
import { filterOptions, listProjects, type ProjectListRow } from "@/lib/service/api/projects";
import { STATUS_OPTIONS } from "@/lib/service/ui/format";
import { ProjectsTable } from "./_components/ProjectsTable";

export const dynamic = "force-dynamic";

const CLOSED = new Set(["COMPLETED", "CANCELLED", "ARCHIVED"]);
const PAGE_SIZE = 100;
// Direct = paid outside Upwork (the Direct profile), Fixed = fixed-price contract, Timer = the rest.
const TYPES = [
  { id: "", label: "All" },
  { id: "timer", label: "Timer" },
  { id: "fixed", label: "Fixed" },
  { id: "direct", label: "Direct (outside Upwork)" },
  { id: "inhouse", label: "In-house" },
] as const;

type Search = { q?: string; status?: string; department?: string; ba?: string; bd?: string; type?: string; page?: string; sort?: string; dir?: string };

// Columns that can be sorted by clicking their header. A project with no value always sorts last, in either direction.
const SORTS: Record<string, (p: ProjectListRow) => string | number | null> = {
  name: (p) => p.name.toLowerCase(),
  status: (p) => p.status,
  hours: (p) => p.minutes ?? 0,
  rate: (p) => p.hourlyRateCents ?? null,
  quota: (p) => p.weeklyLimitMinutes ?? null,
  pm: (p) => p.projectManagers.join(", ").toLowerCase() || null,
  ba: (p) => p.businessAnalysts.join(", ").toLowerCase() || null,
  bd: (p) => p.businessDevelopers.join(", ").toLowerCase() || null,
  // Pending (still running) first, then no rating, then the ratings
  review: (p) => (!CLOSED.has(p.status) ? -2 : p.reviewRating ?? -1),
};

const fmt = (n: number) => n.toLocaleString("en-IN");
const field = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm";

export default async function ServiceProjectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { q = "", status = "", department = "", ba = "", bd = "" } = sp;
  const type = TYPES.find((t) => t.id === sp.type)?.id ?? "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ q, status, department, ba, bd })) if (v) params.set(k, v);
  const [all, options] = await load(() => Promise.all([listProjects({ q, status, department, ba, bd, hours: true }), filterOptions()]));

  const counts: Record<string, number> = { "": all.length, timer: 0, fixed: 0, direct: 0, inhouse: 0 };
  for (const p of all) counts[p.kind]++;
  // Running projects first, then closed ones; alphabetical within each.
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : "";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const key = sort ? SORTS[sort] : null;
  const projects = (type ? all.filter((p) => p.kind === type) : all).sort((a, b) => {
    if (!key) return Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status)) || a.name.localeCompare(b.name);
    const x = key(a);
    const y = key(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // empty last, whatever the direction
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return (dir === "desc" ? -c : c) || a.name.localeCompare(b.name);
  });
  const pages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const shown = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = params.size > 0;
  const open = projects.filter((p) => !CLOSED.has(p.status)).length;

  // Links keep every filter; only the changed key moves.
  const href = (change: Partial<Search>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ type, sort, dir: sort ? dir : "", ...change })) {
      if (v) next.set(k, String(v));
      else next.delete(k);
    }
    if (!("page" in change)) next.delete("page");
    return `/service/projects${next.size ? `?${next}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Projects</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {fmt(projects.length)} {filtered ? "matching" : "in total"} · <span className="text-status-pass-text">{fmt(open)} running</span> · {fmt(projects.length - open)} closed
          </p>
        </div>
        <Link href="/service/projects/new" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          New project
        </Link>
      </div>

      <nav aria-label="Project type" className="flex flex-wrap gap-1 border-b border-border-subtle">
        {TYPES.map((t) => (
          <Link
            key={t.id || "all"}
            href={href({ type: t.id })}
            aria-current={type === t.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${type === t.id ? "border-primary font-medium text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            {t.label} <span className="text-zinc-500">{fmt(counts[t.id] ?? 0)}</span>
          </Link>
        ))}
      </nav>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface p-3">
        {type && <input type="hidden" name="type" value={type} />}
        <input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search by name" className={`${field} w-48`} />
        <select name="status" defaultValue={status} aria-label="Status" className={field}>
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select name="department" defaultValue={department} aria-label="Department" className={field}>
          <option value="">Any department</option>
          {options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select name="ba" defaultValue={ba} aria-label="Business analyst" className={field}>
          <option value="">Any BA</option>
          {options.businessAnalysts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select name="bd" defaultValue={bd} aria-label="Business developer" className={field}>
          <option value="">Any BD</option>
          {options.businessDevelopers.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">Apply</button>
        {filtered && <Link href={href({ q: "", status: "", department: "", ba: "", bd: "" })} className="px-2 py-1.5 text-sm text-primary hover:underline">Clear filters</Link>}
      </form>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface p-6 text-sm text-zinc-500">{filtered || type ? "No projects match these filters." : "No projects yet."}</p>
      ) : (
        <ProjectsTable
          rows={shown}
          showKind={!type}
          options={options}
          sort={sort}
          dir={dir}
          // click: ascending, again: descending, again: back to the default order
          sortHrefs={Object.fromEntries(Object.keys(SORTS).map((k) => [k, k !== sort ? href({ sort: k, dir: "asc", page: "" }) : dir === "asc" ? href({ sort: k, dir: "desc", page: "" }) : href({ sort: "", dir: "", page: "" })]))}
        />
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Showing {fmt((page - 1) * PAGE_SIZE + 1)}–{fmt((page - 1) * PAGE_SIZE + shown.length)} of {fmt(projects.length)}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 hover:bg-surface-muted">← Previous</Link>}
            <span className="px-2 py-1.5 text-zinc-500">Page {page} of {pages}</span>
            {page < pages && <Link href={href({ page: String(page + 1) })} className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 hover:bg-surface-muted">Next →</Link>}
          </span>
        </nav>
      )}
    </div>
  );
}
