"use client";

import { useState } from "react";
import { fmtMinutes, INPUT } from "@/lib/service/ui/format";
import type { ClientList } from "@/lib/service/api/review";
import { BTN, splitList } from "../_components/shared";
import { useSave } from "../_components/useSave";

type Client = ClientList["clients"][number];

/** The unmatched names, with one shared list of existing clients for the "same as" field (not one per row). */
export function UnmatchedList({ items, clients }: { items: ClientList["unmatched"]; clients: Client[] }) {
  return (
    <>
      <datalist id="service-existing-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      {items.map((u) => <UnmatchedRow key={u.raw} item={u} clients={clients} />)}
    </>
  );
}

function UnmatchedRow({ item, clients }: { item: ClientList["unmatched"][number]; clients: Client[] }) {
  const { busy, error, save } = useSave();
  const [name, setName] = useState(item.suggested ?? "");
  const [inHouse, setInHouse] = useState(false);
  const [target, setTarget] = useState("");
  const chosen = clients.find((c) => c.name.toLowerCase() === target.trim().toLowerCase());
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-medium">{item.raw || "(blank)"}</span>
        <span className="text-sm text-zinc-500">{item.entries} entries · {fmtMinutes(item.minutes)}</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Create as client</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={`${INPUT} w-64`} />
        </label>
        <label className="flex items-center gap-1 pb-1.5 text-sm"><input type="checkbox" checked={inHouse} onChange={(e) => setInHouse(e.target.checked)} /> In-house</label>
        <button disabled={busy || name.trim().length < 2} onClick={() => void save("POST", "/review/clients", { name, inHouse })} className={BTN}>Create</button>
        <span className="pb-1.5 text-sm text-zinc-500">or</span>
        <input list="service-existing-clients" aria-label={`Existing client for ${item.raw}`} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Same as… (type a client)" className={`${INPUT} w-56`} />
        <button
          disabled={busy || !chosen || !item.suggested}
          onClick={() => chosen && item.suggested && void save("PUT", `/review/clients/${chosen.id}`, { aliases: [...chosen.aliases, item.suggested] })}
          className={BTN}
        >
          Add as spelling
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-status-fail-text">{error}</p>}
    </li>
  );
}

export function BulkCreate({ names }: { names: string[] }) {
  const { busy, error, note, save } = useSave();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={busy}
        onClick={() => window.confirm(`Create ${names.length} clients from the suggested names?`) && void save("POST", "/review/clients/bulk", { names })}
        className={BTN}
      >
        Create all {names.length} suggested
      </button>
      {note && <span role="status" className="text-sm text-status-pass-text">{note}</span>}
      {error && <span role="alert" className="text-sm text-status-fail-text">{error}</span>}
    </div>
  );
}

export function ClientRow({ client: c }: { client: Client }) {
  const { busy, error, save } = useSave();
  const [aliases, setAliases] = useState(c.aliases.join(", "));
  return (
    <tr>
      <td className="py-2 pr-3 font-medium">{c.name}</td>
      <td className="py-2 pr-3">
        <input
          aria-label={`Spellings of ${c.name}`}
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          onBlur={() => aliases !== c.aliases.join(", ") && void save("PUT", `/review/clients/${c.id}`, { aliases: splitList(aliases) })}
          className={`${INPUT} w-full`}
        />
        {error && <p role="alert" className="text-xs text-status-fail-text">{error}</p>}
      </td>
      <td className="py-2 pr-3">
        <input type="checkbox" aria-label={`${c.name} is in-house`} disabled={busy} checked={c.inHouse} onChange={(e) => void save("PUT", `/review/clients/${c.id}`, { inHouse: e.target.checked })} />
      </td>
      <td className="py-2 pr-3">
        <input type="checkbox" aria-label={`Share unclear entries of ${c.name} across its active projects`} disabled={busy} checked={c.splitUnclear} onChange={(e) => void save("PUT", `/review/clients/${c.id}`, { splitUnclear: e.target.checked })} />
      </td>
      <td className="py-2">{c.entries} · {fmtMinutes(c.minutes)}</td>
    </tr>
  );
}
