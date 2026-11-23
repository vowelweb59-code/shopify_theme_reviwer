"use client";

import { useApi } from "@/app/analytics/_components/useApi";

type Identities = {
  profiles: Array<{ id: string; name: string; email: string; themes: string[] }>;
  rows: Array<{ theme: string; live: boolean; profile: string | null; email: string | null }>;
  unconfigured: string[];
  missing: string[];
};

// Marketing (owner, 2026-11-23): which author profile and Zoho mailbox each theme's marketing has to go out from. Nothing is sent from here.
export function MarketingTab() {
  const { data, loading, error } = useApi<Identities>("/api/marketing/identities");
  if (loading && !data) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (error || !data) return <p className="text-sm text-status-fail-text">{error ?? "Couldn't load the author profiles."}</p>;

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        Marketing for a theme always goes out as the theme&apos;s <strong className="font-medium text-zinc-800 dark:text-zinc-200">author profile</strong>, from
        that profile&apos;s own Zoho mailbox, so a theme can never be marketed from another profile&apos;s address. A theme with no profile is blocked until it
        is given one.
      </p>

      {data.unconfigured.length > 0 && (
        <p role="alert" className="rounded-md bg-status-warning-bg p-3 text-sm text-status-warning-text">
          No author profile yet for: {data.unconfigured.join(", ")}. They cannot be marketed until they are added to{" "}
          <code>lib/marketing/authorProfiles.ts</code>.
        </p>
      )}
      {data.missing.length > 0 && (
        <p role="alert" className="rounded-md bg-status-warning-bg p-3 text-sm text-status-warning-text">
          Configured but not found in the app: {data.missing.join(", ")}. Check the spelling or add the theme.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.profiles.map((p) => (
          <section key={p.id} className="rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
            <h3 className="text-sm font-semibold">{p.name}</h3>
            <p className="mt-1 break-all text-sm text-zinc-600 dark:text-zinc-400">{p.email}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {p.themes.map((t) => (
                <li key={t} className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-medium text-primary-tint-text">
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">Zoho connection: not connected yet</p>
          </section>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Theme</th>
              <th className="px-4 py-2.5 font-medium">Author profile</th>
              <th className="px-4 py-2.5 font-medium">Sends from</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {data.rows.map((r) => (
              <tr key={r.theme}>
                <td className="px-4 py-2.5 font-medium">{r.theme}</td>
                <td className="px-4 py-2.5">{r.profile ?? <span className="text-status-warning-text">No profile</span>}</td>
                <td className="px-4 py-2.5">{r.email ?? <span className="text-zinc-400">blocked</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
