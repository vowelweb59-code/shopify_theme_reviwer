import { load } from "@/lib/service/api/http";
import { listClients } from "@/lib/service/api/review";
import { SECTION } from "../_components/shared";
import { BulkCreate, ClientRow, UnmatchedList } from "./ClientEditors";

export const dynamic = "force-dynamic";

export default async function ServiceClientsPage() {
  const data = await load(listClients);
  const suggestions = [...new Set(data.unmatched.flatMap((u) => (u.suggested ? [u.suggested] : [])))];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Clients</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Names that appear in Chat but match no client. Create each as a client, or add it as another spelling of a client you already have. Entries are fixed straight away, and later imports remember the choice.
        </p>
      </div>

      {data.unmatched.length > 0 && (
        <section aria-labelledby="unmatched" className={SECTION}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="unmatched" className="font-medium">Not matched to a client ({data.unmatched.length})</h3>
            {suggestions.length > 0 && <BulkCreate names={suggestions} />}
          </div>
          <ul className="mt-2 divide-y divide-border-subtle">
            <UnmatchedList items={data.unmatched} clients={data.clients} />
          </ul>
        </section>
      )}

      <section aria-labelledby="clients" className={SECTION}>
        <h3 id="clients" className="font-medium">Clients ({data.clients.length})</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-zinc-500">
                <th className="py-2 pr-3 font-medium">Client</th>
                <th className="py-2 pr-3 font-medium">Also written as (comma separated)</th>
                <th className="py-2 pr-3 font-medium">In-house</th>
                <th className="py-2 pr-3 font-medium" title="For a client with several projects: an entry that names no project is shared across the projects that worked in the last two weeks">Share unclear entries</th>
                <th className="py-2 font-medium">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.clients.map((c) => <ClientRow key={c.id} client={c} />)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
