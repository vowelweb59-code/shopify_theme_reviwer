"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectDetails } from "@/lib/service/api/projects";
import { mutate } from "@/lib/service/ui/client";

const input = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm";
const btn = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60";
const split = (v: string) => v.split(",").map((a) => a.trim()).filter(Boolean);

function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function save(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await mutate("PUT", path, body);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }
  return { busy, error, saved, save };
}

function Outcome({ saved, error }: { saved: boolean; error: string | null }) {
  return (
    <>
      {saved && <span role="status" className="text-sm text-status-pass-text">Saved</span>}
      {error && <p role="alert" className="basis-full text-sm text-status-fail-text">{error}</p>}
    </>
  );
}

/** Business analysts, developers and executives: names separated by commas; known Chat senders are suggested while typing. */
export function PeopleEditor({ projectId, details }: { projectId: string; details: ProjectDetails }) {
  const { busy, error, saved, save } = useSave();
  const [ba, setBa] = useState(details.businessAnalysts.map((p) => p.name).join(", "));
  const [ex, setEx] = useState(details.executives.map((p) => p.name).join(", "));
  const [bd, setBd] = useState(details.businessDevelopers.map((p) => p.name).join(", "));
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(`/projects/${projectId}/people`, { businessAnalysts: split(ba), executives: split(ex), businessDevelopers: split(bd) });
      }}
    >
      <datalist id="team-names">{details.suggestions.map((n) => <option key={n} value={n} />)}</datalist>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Business analyst (BA)</span>
        <input list="team-names" value={ba} onChange={(e) => setBa(e.target.value)} className={`${input} w-64`} placeholder="Name" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Business developer (BD)</span>
        <input list="team-names" value={bd} onChange={(e) => setBd(e.target.value)} className={`${input} w-56`} placeholder="Name" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Executives (comma separated)</span>
        <input list="team-names" value={ex} onChange={(e) => setEx(e.target.value)} className={`${input} w-96 max-w-full`} placeholder="Name, Name" />
      </label>
      <button disabled={busy} className={btn}>{busy ? "Saving…" : "Save people"}</button>
      <Outcome saved={saved} error={error} />
    </form>
  );
}

/** The client's rating of the project, 1 to 5, with an optional comment. */
export function ReviewEditor({ projectId, details }: { projectId: string; details: ProjectDetails }) {
  const { busy, error, saved, save } = useSave();
  const [rating, setRating] = useState(details.review.rating ? String(details.review.rating) : "");
  const [comment, setComment] = useState(details.review.comment ?? "");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(`/projects/${projectId}/review`, { rating: rating ? Number(rating) : null, comment: rating ? comment : null });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Client review</span>
        <input value={rating} onChange={(e) => setRating(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="1 to 5, e.g. 4.7" aria-label="Client rating" className={`${input} w-36`} />
      </label>
      {rating && (
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Comment</span>
          <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} className={`${input} w-96 max-w-full`} />
        </label>
      )}
      <button disabled={busy} className={btn}>{busy ? "Saving…" : "Save review"}</button>
      <Outcome saved={saved} error={error} />
    </form>
  );
}

export function ProfileEditor({ projectId, details }: { projectId: string; details: ProjectDetails }) {
  const { busy, error, saved, save } = useSave();
  const [profileId, setProfileId] = useState(details.upworkProfile?.id ?? "");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Upwork profile</span>
        <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={input}>
          <option value="">Not set</option>
          {details.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <button disabled={busy} onClick={() => void save(`/projects/${projectId}/upwork-profile`, { profileId: profileId || null })} className={btn}>{busy ? "Saving…" : "Save profile"}</button>
      <Outcome saved={saved} error={error} />
    </div>
  );
}

/** The words that, written in Chat, put an entry on this project. Only matters when the client has several projects. */
export function KeywordsEditor({ projectId, details }: { projectId: string; details: ProjectDetails }) {
  const { busy, error, saved, save } = useSave();
  const [words, setWords] = useState(details.chatKeywords.join(", "));
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(`/projects/${projectId}/keywords`, { keywords: split(words) });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Written in Chat as (comma separated)</span>
        <input value={words} onChange={(e) => setWords(e.target.value)} className={`${input} w-96 max-w-full`} placeholder="e.g. Stacy King" />
      </label>
      <button disabled={busy} className={btn}>{busy ? "Saving…" : "Save words"}</button>
      <Outcome saved={saved} error={error} />
      <p className="basis-full text-xs text-zinc-500">
        For a client with several projects: a report goes to the project whose word is written first. Nothing matching waits on the Review page, or is shared across active projects if the client is set to do that.
      </p>
    </form>
  );
}

export function InHouseEditor({ projectId, details }: { projectId: string; details: ProjectDetails }) {
  const { busy, error, saved, save } = useSave();
  const [on, setOn] = useState(details.inHouse);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        In-house project (our own work, not paid client work)
      </label>
      <button disabled={busy || on === details.inHouse} onClick={() => void save(`/projects/${projectId}/in-house`, { inHouse: on })} className={btn}>{busy ? "Saving…" : "Save"}</button>
      <Outcome saved={saved} error={error} />
    </div>
  );
}
