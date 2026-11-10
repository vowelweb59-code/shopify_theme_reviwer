import { load } from "@/lib/service/api/http";
import { listProfiles } from "@/lib/service/api/review";
import { SECTION } from "../_components/shared";
import { NewProfile, ProfileRow, UnmatchedProfiles } from "./ProfileEditors";

export const dynamic = "force-dynamic";

export default async function ServiceProfilesPage() {
  const data = await load(listProfiles);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Upwork profiles</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The name written after the client in Chat (Client | Profile). Add spelling variants as aliases and say which Upwork account each profile belongs to. Hours count either way.
        </p>
      </div>

      {data.unmatched.length > 0 && (
        <section aria-labelledby="unmatched" className={SECTION}>
          <h3 id="unmatched" className="font-medium">Names not matched to a profile</h3>
          <ul className="mt-2 divide-y divide-border-subtle">
            <UnmatchedProfiles items={data.unmatched} profiles={data.profiles} />
          </ul>
        </section>
      )}

      <section aria-labelledby="profiles" className={SECTION}>
        <h3 id="profiles" className="font-medium">Profiles</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-zinc-500">
                <th className="py-2 pr-3 font-medium">Profile</th>
                <th className="py-2 pr-3 font-medium">Also written as (comma separated)</th>
                <th className="py-2 pr-3 font-medium">Upwork account</th>
                <th className="py-2 font-medium">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.profiles.map((p) => <ProfileRow key={p.id} profile={p} accounts={data.accounts} />)}
            </tbody>
          </table>
        </div>
        <NewProfile accounts={data.accounts} />
      </section>
    </div>
  );
}
