import Link from "next/link";
import { load } from "@/lib/service/api/http";
import { listReview } from "@/lib/service/api/review";
import { AssignRow } from "./_components/AssignRow";
import { ReviewEntries } from "./_components/ReviewRow";
import { SECTION } from "./_components/shared";

export const dynamic = "force-dynamic";

export default async function ServiceReviewPage({ searchParams }: { searchParams: Promise<{ view?: string; flag?: string }> }) {
  const { view, flag } = await searchParams;
  const assigning = view === "unassigned";
  const data = await load(() => listReview({ view: assigning ? "unassigned" : null, flag: assigning ? null : flag ?? null }));
  const tab = (on: boolean) => `rounded-md border border-border-subtle px-2 py-1 ${on ? "bg-surface-muted font-medium" : "hover:bg-surface-muted"}`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Review hours</h2>
        <nav aria-label="Review views" className="mt-2 flex gap-2 text-sm">
          <Link href="/service/review" aria-current={assigning ? undefined : "page"} className={tab(!assigning)}>To check</Link>
          <Link href="/service/review?view=unassigned" aria-current={assigning ? "page" : undefined} className={tab(assigning)}>To assign to a project</Link>
        </nav>
        <p className="mt-2 text-sm text-zinc-500">
          {assigning
            ? "Entries for a client with several projects. Say which project each belongs to; until then they count for no project."
            : "Only entries the importer flagged wait here. Everything else goes straight to Live reports on the dashboard. Flagged entries already count toward weekly hours; approving or correcting them here only fixes the numbers."}
          {data.total > data.entries.length && ` Showing the newest ${data.entries.length} of ${data.total}.`}
        </p>
      </div>
      {data.entries.length === 0 ? (
        <p className={`${SECTION} text-sm text-zinc-500`}>{assigning ? "Nothing to assign." : "Nothing to review."}</p>
      ) : (
        <ul className="space-y-3">
          {assigning
            ? data.entries.map((e) => <AssignRow key={e.id} entry={e} projects={data.projects.filter((p) => p.clientId === e.clientId)} />)
            : <ReviewEntries entries={data.entries} clients={data.clients} projects={data.projects} />}
        </ul>
      )}
    </div>
  );
}
