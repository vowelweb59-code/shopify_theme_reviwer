import Link from "next/link";
import { listLiveProjects } from "@/lib/service/api/live-projects";
import { SPACE_SCAN_SPACE, loadSpaceReviews } from "@/lib/service/chat/space-scan";
import { ServiceProject } from "@/models/service-project";
import { SpaceScan } from "./_components/SpaceScan";

export const dynamic = "force-dynamic";

// Live Project Chat Summary (owner, 2026-11-26): one tab per project on the Service overview's Active tab; a project's tab shows the pending
// tasks and pitch opportunities of the Chat space(s) connected to it (scripts/set-space-project.ts). A project with no space says so. A
// reviewed space not connected to any project yet sits under "Not connected". ?project=<project id> | unlinked picks the tab.
export default async function SpaceScanPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const sp = await searchParams;
  const [live, stored] = await Promise.all([listLiveProjects(), loadSpaceReviews()]);
  const byProject = new Map<string, typeof stored>();
  for (const s of stored) if (s.projectId) byProject.set(s.projectId, [...(byProject.get(s.projectId) ?? []), s]);
  const unlinked = stored.filter((s) => !s.projectId);

  // A project with a connected space stays a tab even if it has since left the Active list.
  const known = new Set(live.map((p) => p.id));
  const extra = [...byProject.keys()].filter((id) => !known.has(id));
  const names = new Map<string, string>();
  if (extra.length) {
    for (const p of await ServiceProject.find({ _id: { $in: extra } })
      .select("name")
      .lean<Array<{ _id: string; name: string }>>())
      names.set(p._id, p.name);
  }
  const tabs = [...live, ...extra.map((id) => ({ id, name: names.get(id) ?? "Project" }))].sort(
    (a, b) => Number(byProject.has(b.id)) - Number(byProject.has(a.id)) || a.name.localeCompare(b.name)
  );
  const allTabs = [
    ...tabs.map((t) => ({ id: t.id, name: t.name, has: byProject.has(t.id) })),
    ...(unlinked.length ? [{ id: "unlinked", name: "Not connected", has: true }] : []),
  ];
  const selected = allTabs.find((t) => t.id === sp.project) ?? allTabs.find((t) => t.has) ?? allTabs[0];
  const reviews = selected ? (selected.id === "unlinked" ? unlinked : (byProject.get(selected.id) ?? [])) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        One tab for each active project ({tabs.length}, the same list as the Projects tab&apos;s Active view). A project&apos;s tab shows the pending tasks and
        the opportunities to pitch from its Chat space. A dot marks the tabs that have a space connected.
      </p>
      <nav aria-label="Active projects" className="flex flex-wrap gap-1.5">
        {allTabs.map((t) => {
          const on = t.id === selected?.id;
          return (
            <Link
              key={t.id}
              href={`/service/space-scan?project=${encodeURIComponent(t.id)}`}
              aria-current={on ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary-tint text-primary-tint-text font-medium" : "border-border-subtle text-zinc-600 hover:bg-surface-muted dark:text-zinc-400"}`}
            >
              {t.has && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-status-pass-icon align-middle" aria-hidden />}
              {t.name}
            </Link>
          );
        })}
      </nav>
      {selected && reviews.length === 0 && (
        <p className="rounded-lg border border-border-subtle bg-surface p-4 text-sm text-zinc-600 dark:text-zinc-400">
          No Chat space is connected to {selected.name} yet. Once you give me its space, it is connected with <code>scripts/set-space-project.ts</code> and its
          pending tasks and opportunities appear here.
        </p>
      )}
      {reviews.map((s) => (
        <section key={s.review.space} className="space-y-3">
          {reviews.length > 1 && <h2 className="text-sm font-medium">{s.review.client ?? s.review.space}</h2>}
          {selected?.id === "unlinked" && (
            <p className="text-xs text-zinc-500">
              This space ({s.review.client ?? s.review.space}) is not connected to a project yet:{" "}
              <code>set-space-project.ts --space={s.review.space} --project=&quot;…&quot;</code>
            </p>
          )}
          <SpaceScan review={s.review} showScan={s.review.space === SPACE_SCAN_SPACE} />
        </section>
      ))}
    </div>
  );
}
