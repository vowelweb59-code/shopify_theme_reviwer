import { load } from "@/lib/service/api/http";
import { listSenders } from "@/lib/service/api/review";
import { fmtMinutes } from "@/lib/service/ui/format";
import { SECTION } from "../_components/shared";
import { SenderRow } from "./SenderRow";

export const dynamic = "force-dynamic";

export default async function ServiceSendersPage() {
  const data = await load(listSenders);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Chat senders</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Each person who posts in Chat is matched to a person in the service team directory when the full name is identical. Link the rest by hand. Hours are counted either way; linking only attributes them to that person.
        </p>
      </div>
      {data.senders.length === 0 ? (
        <p className={`${SECTION} text-sm text-zinc-500`}>No Chat messages imported yet.</p>
      ) : (
        <div className={`${SECTION} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-zinc-500">
                <th className="py-2 pr-3 font-medium">Chat name</th>
                <th className="py-2 pr-3 font-medium">Entries</th>
                <th className="py-2 pr-3 font-medium">Hours</th>
                <th className="py-2 font-medium">Linked person</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.senders.map((s) => <SenderRow key={s.id} sender={s} users={data.users} hours={fmtMinutes(s.minutes)} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
