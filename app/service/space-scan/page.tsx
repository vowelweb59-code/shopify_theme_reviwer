import Link from "next/link";
import { listLiveProjects } from "@/lib/service/api/live-projects";
import { SPACE_SCAN_SPACE, loadProjectSpaces, loadSpaceReviews } from "@/lib/service/chat/space-scan";
import { ServiceProject } from "@/models/service-project";
import { SpaceScan } from "./_components/SpaceScan";

export const dynamic = "force-dynamic";

// Live Project Chat Summary (owner, 2026-11-26): one tab per project on the Service overview's Active tab (active projects only). A project's
// tab shows the pending tasks and pitch opportunities of the Chat space(s) connected to it. A connection (service_project_spaces, set by
// scripts/set-space-project.ts or link-matched-spaces.ts) can exist before the space's first reviewed list does. A reviewed space not
// connected to any project sits under "Not connected". ?project=<project id> | unlinked picks the tab.
export default async function SpaceScanPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const sp = await searchParams;
  const [live, stored, links] = await Promise.all([listLiveProjects(), loadSpaceReviews(), loadProjectSpaces()]);

  // project id -> its connected spaces. The first link was stored on the review itself; it counts until a link row replaces it.
  const spacesOf = new Map<string, Array<{ space: string; name: string | null }>>();
  const add = (projectId: string, space: string, name: string | null) => {
    const list = spacesOf.get(projectId) ?? [];
    if (!list.some((x) => x.space === space)) spacesOf.set(projectId, [...list, { space, name }]);
  };
  for (const l of links) add(l.projectId, l.space, l.displayName);
  const linked = new Set(links.map((l) => l.space));
  for (const s of stored) if (s.projectId && !linked.has(s.review.space)) add(s.projectId, s.review.space, s.review.client);
  const connected = new Set([...spacesOf.values()].flatMap((l) => l.map((x) => x.space)));
  const reviewOf = new Map(stored.map((s) => [s.review.space, s.review]));
  const unlinked = stored.filter((s) => !connected.has(s.review.space));

  // A project with a connected space stays a tab even if it has since left the Active list.
  const known = new Set(live.map((p) => p.id));
  const extra = [...spacesOf.keys()].filter((id) => !known.has(id));
  const names = new Map<string, string>();
  if (extra.length) {
    for (const p of await ServiceProject.find({ _id: { $in: extra } })
      .select("name")
      .lean<Array<{ _id: string; name: string }>>())
      names.set(p._id, p.name);
  }
  const tabs = [...live, ...extra.map((id) => ({ id, name: names.get(id) ?? "Project" }))].sort(
    (a, b) => Number(spacesOf.has(b.id)) - Number(spacesOf.has(a.id)) || a.name.localeCompare(b.name)
  );
  const allTabs = [
    ...tabs.map((t) => ({ id: t.id, name: t.name, has: spacesOf.has(t.id) })),
    ...(unlinked.length ? [{ id: "unlinked", name: "Not connected", has: true }] : []),
  ];
  const selected = allTabs.find((t) => t.id === sp.project) ?? allTabs.find((t) => t.has) ?? allTabs[0];
  const shown =
    selected?.id === "unlinked"
      ? unlinked.map((s) => ({ space: s.review.space, name: s.review.client, review: s.review as typeof s.review | undefined }))
      : (spacesOf.get(selected?.id ?? "") ?? []).map((x) => ({ space: x.space, name: x.name, review: reviewOf.get(x.space) }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        One tab for each active project ({live.length}, the same list as the Projects tab&apos;s Active view). A project&apos;s tab shows the pending tasks and
        the opportunities to pitch from its Chat space. A dot marks the tabs that have a space connected ({spacesOf.size} so far).
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
      {selected && shown.length === 0 && (
        <p className="rounded-lg border border-border-subtle bg-surface p-4 text-sm text-zinc-600 dark:text-zinc-400">
          No Chat space is connected to {selected.name} yet. Once you give me its space, it is connected with <code>scripts/set-space-project.ts</code> and its
          pending tasks and opportunities appear here.
        </p>
      )}
      {shown.map((s) => (
        <section key={s.space} className="space-y-3">
          {(shown.length > 1 || !s.review) && <h2 className="text-sm font-medium">{s.name ?? s.space}</h2>}
          {selected?.id === "unlinked" && (
            <p className="text-xs text-zinc-500">
              This space ({s.name ?? s.space}) is not connected to a project yet: <code>set-space-project.ts --space={s.space} --project=&quot;…&quot;</code>
            </p>
          )}
          {s.review ? (
            <SpaceScan review={s.review} showScan={s.space === SPACE_SCAN_SPACE} />
          ) : (
            <p className="rounded-lg border border-border-subtle bg-surface p-4 text-sm text-zinc-600 dark:text-zinc-400">
              Connected to the Chat space <strong>{s.name ?? s.space}</strong>. Its pending tasks and opportunities have not been read yet; they appear here
              after the first review.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
