"use client";

import { useState } from "react";
import { fmtMinutes, INPUT } from "@/lib/service/ui/format";
import type { ProfileList } from "@/lib/service/api/review";
import { BTN, splitList } from "../_components/shared";
import { useSave } from "../_components/useSave";

type Profile = ProfileList["profiles"][number];

export function ProfileRow({ profile: p, accounts }: { profile: Profile; accounts: ProfileList["accounts"] }) {
  const { busy, error, save } = useSave();
  const [aliases, setAliases] = useState(p.aliases.join(", "));
  return (
    <tr>
      <td className="py-2 pr-3 font-medium">{p.name}</td>
      <td className="py-2 pr-3">
        <input
          aria-label={`Aliases for ${p.name}`}
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          onBlur={() => aliases !== p.aliases.join(", ") && void save("PUT", `/review/profiles/${p.id}`, { aliases: splitList(aliases) })}
          className={`${INPUT} w-full`}
        />
      </td>
      <td className="py-2 pr-3">
        <select
          aria-label={`Upwork account for ${p.name}`}
          disabled={busy}
          value={p.account?.id ?? ""}
          onChange={(e) => void save("PUT", `/review/profiles/${p.id}`, { accountId: e.target.value || null })}
          className={`${INPUT} max-w-56`}
        >
          <option value="">Not set</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.login}</option>)}
        </select>
        {error && <p role="alert" className="text-xs text-status-fail-text">{error}</p>}
      </td>
      <td className="py-2">{p.entries} · {fmtMinutes(p.minutes)}</td>
    </tr>
  );
}

/** The unmatched written names; the profile list is passed once and shared by every row. */
export function UnmatchedProfiles({ items, profiles }: { items: ProfileList["unmatched"]; profiles: Profile[] }) {
  return <>{items.map((u) => <UnmatchedRow key={u.name} item={u} profiles={profiles} />)}</>;
}

function UnmatchedRow({ item, profiles }: { item: ProfileList["unmatched"][number]; profiles: Profile[] }) {
  const { busy, error, save } = useSave();
  const [target, setTarget] = useState("");
  const chosen = profiles.find((p) => p.id === target);
  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <span className="font-medium">{item.name}</span>
      <span className="text-sm text-zinc-500">{item.entries} entries · {fmtMinutes(item.minutes)}</span>
      <select aria-label={`Profile for ${item.name}`} value={target} onChange={(e) => setTarget(e.target.value)} className={INPUT}>
        <option value="">Same person as…</option>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button disabled={busy || !chosen} onClick={() => chosen && void save("PUT", `/review/profiles/${chosen.id}`, { aliases: [...chosen.aliases, item.name] })} className={BTN}>Add as alias</button>
      <button disabled={busy} onClick={() => void save("POST", "/review/profiles", { name: item.name })} className={BTN}>New profile</button>
      {error && <p role="alert" className="basis-full text-xs text-status-fail-text">{error}</p>}
    </li>
  );
}

export function NewProfile({ accounts }: { accounts: ProfileList["accounts"] }) {
  const { busy, error, save } = useSave();
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save("POST", "/review/profiles", { name, ...(accountId ? { accountId } : {}) })) setName("");
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">New profile</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={`${INPUT} w-56`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Upwork account (optional)</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${INPUT} max-w-56`}>
          <option value="">Not set</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.login}</option>)}
        </select>
      </label>
      <button disabled={busy || !name.trim()} className={BTN}>Add profile</button>
      {error && <p role="alert" className="basis-full text-sm text-status-fail-text">{error}</p>}
    </form>
  );
}
