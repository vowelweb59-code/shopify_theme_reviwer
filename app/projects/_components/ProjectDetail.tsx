"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Breadcrumbs } from "@/app/_components/shell/Breadcrumbs";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { EmptyState, ErrorState } from "@/app/_components/ui/EmptyState";
import { PORTALS, PROJECT_STATUSES, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS, REJECTION_STAGES, REJECTION_STAGE_LABELS, typeHasStatus, type Portal, type ProjectStatus, type ProjectType, type RejectionStage } from "@/lib/projects/constants";
import { ProjectStatusPill } from "./ProjectStatusPill";
import { TimeLog } from "./TimeLog";

type ProjectMember = { memberId: string; name: string; designation: string; role: string | null };
type TeamEntry = { _id: string; name: string; designation: string; email: string | null };
type RoundView = { status: ProjectStatus; rejectionStage: RejectionStage | null; designDays: number | null; developmentDays: number | null; note: string; members: ProjectMember[] };
type Loaded = {
  project: { _id: string; portal: Portal | null; name: string; description: string; type: ProjectType; status: ProjectStatus | null; rejectionStage: RejectionStage | null; designDays: number | null; developmentDays: number | null; members: ProjectMember[]; rounds: RoundView[]; rejections: number };
  theme: { _id: string; name: string } | null;
  team: TeamEntry[];
};

const INPUT = "rounded-md border border-border-subtle bg-transparent px-3 py-2";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [portal, setPortal] = useState<Portal | "">("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [rejectionStage, setRejectionStage] = useState<RejectionStage | "">("");
  const [designDays, setDesignDays] = useState("");
  const [developmentDays, setDevelopmentDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [pickId, setPickId] = useState("");
  const [days, setDays] = useState<{ memberId: string; name: string; designation: string; theme: number; preset: number; update: number; total: number }[]>([]);
  const [suggestion, setSuggestion] = useState<{ designDays: number | null; developmentDays: number | null; reportCount: number; from: string | null; to: string | null } | null>(null);

  function apply(loaded: Loaded) {
    setData(loaded);
    setName(loaded.project.name);
    setDescription(loaded.project.description ?? "");
    setPortal(loaded.project.portal ?? "");
    setStatus(loaded.project.status ?? "planning");
    setRejectionStage(loaded.project.rejectionStage ?? "");
    setDesignDays(loaded.project.designDays?.toString() ?? "");
    setDevelopmentDays(loaded.project.developmentDays?.toString() ?? "");
  }

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Failed to load the project.");
        apply(body);
      })
      .catch((err: Error) => setLoadError(err.message));
    fetch(`/api/projects/${projectId}/duration-suggestion`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setSuggestion)
      .catch(() => setSuggestion(null));
    fetch(`/api/projects/${projectId}/days-worked`)
      .then((res) => (res.ok ? res.json() : { rows: [] }))
      .then((body) => setDays(body.rows ?? []))
      .catch(() => setDays([]));
  }, [projectId]);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "error", text: result.error ?? "Failed to save." });
        return false;
      }
      return true;
    } catch {
      setMessage({ tone: "error", text: "Lost connection to the server. Try again." });
      return false;
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const hasStatus = data ? typeHasStatus(data.project.type) : true;
    if (await patch(hasStatus ? { name, portal, description, status, rejectionStage: status === "rejected" ? rejectionStage : "", designDays, developmentDays } : { name, portal, description })) {
      setData((d) => (d ? { ...d, project: { ...d.project, name, portal: portal || null, description, ...(hasStatus ? { status, rejectionStage: status === "rejected" && rejectionStage ? rejectionStage : null, designDays: designDays === "" ? null : Number(designDays), developmentDays: developmentDays === "" ? null : Number(developmentDays) } : {}) } } : d));
      setMessage({ tone: "ok", text: "Saved." });
    }
    setSaving(false);
  }

  async function saveMembers(members: ProjectMember[]) {
    if (!data) return;
    if (await patch({ members: members.map((m) => ({ memberId: m.memberId, role: m.role })) })) {
      setData({ ...data, project: { ...data.project, members } });
    }
  }

  async function resubmit() {
    if (!data) return;
    const note = window.prompt("Why was it rejected? (optional, kept with this round)") ;
    if (note === null) return;
    if (!(await patch({ startNewRound: true, rejectionNote: note }))) return;
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) apply(await res.json());
  }

  async function saveRounds(rounds: RoundView[]) {
    if (!data) return;
    const body = rounds.map((r) => ({ status: r.status, rejectionStage: r.rejectionStage, designDays: r.designDays, developmentDays: r.developmentDays, note: r.note, members: r.members.map((m) => ({ memberId: m.memberId, role: m.role })) }));
    if (await patch({ rounds: body })) {
      const rejections = rounds.filter((r) => r.status === "rejected").length + (data.project.status === "rejected" ? 1 : 0);
      setData({ ...data, project: { ...data.project, rounds, rejections } });
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this project? Its team assignments are removed too; the team members themselves are kept.")) return;
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) router.push("/projects");
    else setMessage({ tone: "error", text: (await res.json().catch(() => ({}))).error ?? "Failed to delete the project." });
  }

  if (loadError) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load this project" description={loadError} action={<Link href="/projects" className="text-sm text-primary underline">Back to projects</Link>} />
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <PageContainer>
        <p className="text-sm text-zinc-500">Loading…</p>
      </PageContainer>
    );
  }

  const { project, theme, team } = data;
  const assigned = new Set(project.members.map((m) => m.memberId));
  const hasStatus = typeHasStatus(project.type);
  const available = team.filter((m) => !assigned.has(m._id));

  return (
    <PageContainer>
      <div>
        <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: project.name }]} />
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{project.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {PROJECT_TYPE_LABELS[project.type]} · Theme:{" "}
          {theme ? (
            <Link href={`/themes/${theme._id}`} className="text-primary underline">
              {theme.name}
            </Link>
          ) : (
            "deleted"
          )}
        </p>
      </div>

      <Card>
        <CardHeader title="Details" />
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Project name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
            <span className="text-zinc-700 dark:text-zinc-300">Portal</span>
            <select value={portal} onChange={(e) => setPortal(e.target.value as Portal | "")} className={INPUT}>
              <option value="">No portal</option>
              {PORTALS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Description</span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
          </label>
          {hasStatus && suggestion && suggestion.reportCount > 0 && (suggestion.designDays !== null || suggestion.developmentDays !== null) && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle px-3 py-2 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Suggested from {suggestion.reportCount} time report{suggestion.reportCount === 1 ? "" : "s"} ({suggestion.from} to {suggestion.to}):
                {suggestion.designDays !== null && <strong className="ml-2 font-medium text-zinc-900 dark:text-zinc-100">design {suggestion.designDays} d</strong>}
                {suggestion.developmentDays !== null && <strong className="ml-2 font-medium text-zinc-900 dark:text-zinc-100">development {suggestion.developmentDays} d</strong>}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (suggestion.designDays !== null) setDesignDays(String(suggestion.designDays));
                  if (suggestion.developmentDays !== null) setDevelopmentDays(String(suggestion.developmentDays));
                }}
              >
                Use these
              </Button>
              <span className="text-xs text-zinc-500">Fills the boxes below; nothing is saved until you press Save changes.</span>
            </div>
          )}
          {hasStatus && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={INPUT}>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              {status === "rejected" && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">Rejected at</span>
                  <StageSelect value={rejectionStage} onChange={setRejectionStage} />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">Design duration (days)</span>
                <input type="number" min={0} step={0.5} value={designDays} onChange={(e) => setDesignDays(e.target.value)} className={INPUT} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">Development duration (days)</span>
                <input type="number" min={0} step={0.5} value={developmentDays} onChange={(e) => setDevelopmentDays(e.target.value)} className={INPUT} />
              </label>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete project
            </Button>
            <div className="flex gap-2">
              {hasStatus && data.project.status === "rejected" && status === "rejected" && (
                <Button type="button" variant="secondary" onClick={resubmit}>
                  Resubmit (start a new round)
                </Button>
              )}
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        </form>
        {message && (
          <p role="status" className={`mt-3 text-sm ${message.tone === "ok" ? "text-status-pass-text" : "text-status-fail-text"}`}>
            {message.text}
          </p>
        )}
      </Card>

      {days.length > 0 && (
        <Card>
          <CardHeader title="Days worked" description="Days each team member has reported on this theme in the Theme Status Group (8.5 hours = 1 day). Product Managers are not listed." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Team member</th>
                  <th className="py-2 pr-4 font-medium">New theme</th>
                  <th className="py-2 pr-4 font-medium">Presets</th>
                  <th className="py-2 pr-4 font-medium">Updates</th>
                  <th className="py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {days.map((d) => (
                  <tr key={d.memberId}>
                    <td className="py-2 pr-4">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{d.name}</span> <span className="text-xs text-zinc-500">{d.designation}</span>
                    </td>
                    <td className="py-2 pr-4">{d.theme || "—"}</td>
                    <td className="py-2 pr-4">{d.preset || "—"}</td>
                    <td className="py-2 pr-4">{d.update || "—"}</td>
                    <td className="py-2 font-medium text-zinc-900 dark:text-zinc-100">{d.total} d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {hasStatus && project.rounds.length > 0 && (
        <Card>
          <CardHeader
            title="Earlier rounds"
            description={`Earlier submissions of this theme, kept so rejections stay on record. Rejected ${project.rejections} time${project.rejections === 1 ? "" : "s"} in total.`}
          />
          <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {project.rounds.map((round, i) => (
              <RoundRow
                key={`${i}-${round.note}`}
                index={i}
                round={round}
                team={team}
                onNoteSave={(note) => saveRounds(project.rounds.map((r, j) => (j === i ? { ...r, note } : r)))}
                onMembersSave={(members) => saveRounds(project.rounds.map((r, j) => (j === i ? { ...r, members } : r)))}
                onStageSave={(rejectionStage) => saveRounds(project.rounds.map((r, j) => (j === i ? { ...r, rejectionStage } : r)))}
                onDelete={() => {
                  if (window.confirm(`Delete round ${i + 1}? Its rejection is no longer counted against its team.`)) saveRounds(project.rounds.filter((_, j) => j !== i));
                }}
              />
            ))}
          </ul>
        </Card>
      )}

      {!hasStatus && <TimeLog projectId={project._id} members={project.members} />}

      <Card>
        <CardHeader
          title="Team"
          description="Each member's role on this project defaults to their designation; edit it if they do something different here."
        />
        {team.length === 0 ? (
          <EmptyState
            title="No team members in the system yet"
            description="Add people on the Team page first."
            action={
              <Link href="/team" className="text-sm text-primary underline">
                Go to Team
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {project.members.length === 0 ? (
              <p className="text-sm text-zinc-500">No one is assigned yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
                {project.members.map((m) => (
                  <MemberRow
                    key={m.memberId}
                    member={m}
                    onRoleSave={(role) => saveMembers(project.members.map((x) => (x.memberId === m.memberId ? { ...x, role } : x)))}
                    onRemove={() => saveMembers(project.members.filter((x) => x.memberId !== m.memberId))}
                  />
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select value={pickId} onChange={(e) => setPickId(e.target.value)} className={`${INPUT} min-w-56`} aria-label="Team member to add">
                <option value="">{available.length === 0 ? "Everyone is already assigned" : "Choose a team member…"}</option>
                {available.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} — {m.designation}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                disabled={!pickId}
                onClick={() => {
                  const picked = available.find((m) => m._id === pickId);
                  if (!picked) return;
                  setPickId("");
                  saveMembers([...project.members, { memberId: picked._id, name: picked.name, designation: picked.designation, role: null }]);
                }}
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Add to project
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

function MemberRow({ member, onRoleSave, onRemove }: { member: ProjectMember; onRoleSave: (role: string | null) => void; onRemove: () => void }) {
  const current = member.role ?? member.designation;
  const [role, setRole] = useState(current);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{member.name}</p>
        <p className="text-xs text-zinc-500">{member.designation}</p>
      </div>
      <input
        aria-label={`Role of ${member.name} on this project`}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onBlur={() => {
          const next = role.trim();
          // Blank falls back to the designation; only save a real change.
          if (!next) setRole(member.designation);
          if ((next || member.designation) !== current) onRoleSave(next && next !== member.designation ? next : null);
        }}
        className={`${INPUT} w-56 text-sm`}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${member.name} from this project`}
        className="rounded-md p-1.5 text-zinc-400 hover:bg-black/[.04] hover:text-zinc-700 dark:hover:bg-white/[.06] dark:hover:text-zinc-200"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

// A design-stage rejection is left out of the developers' success rate.
function StageSelect({ value, onChange }: { value: RejectionStage | ""; onChange: (stage: RejectionStage | "") => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as RejectionStage | "")} className="rounded-md border border-border-subtle bg-transparent px-2 py-1 text-sm">
      <option value="">Not recorded</option>
      {REJECTION_STAGES.map((s) => (
        <option key={s} value={s}>
          {REJECTION_STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function RoundRow({
  index,
  round,
  team,
  onNoteSave,
  onMembersSave,
  onStageSave,
  onDelete,
}: {
  index: number;
  round: RoundView;
  team: TeamEntry[];
  onNoteSave: (note: string) => void;
  onMembersSave: (members: ProjectMember[]) => void;
  onStageSave: (stage: RejectionStage | null) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(round.note);
  const [pickId, setPickId] = useState("");
  const onRound = new Set(round.members.map((m) => m.memberId));
  const available = team.filter((m) => !onRound.has(m._id));
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Round {index + 1}</span>
        <ProjectStatusPill status={round.status} />
        {round.status === "rejected" && (
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            Rejected at
            <StageSelect value={round.rejectionStage ?? ""} onChange={(stage) => onStageSave(stage || null)} />
          </label>
        )}
        <span className="text-xs text-zinc-500">
          Design {round.designDays ?? "—"} d · Development {round.developmentDays ?? "—"} d
        </span>
        <button type="button" onClick={onDelete} className="ml-auto text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200">
          Delete round
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {round.members.length === 0 && <span className="text-xs text-zinc-500">No team recorded</span>}
        {round.members.map((m) => (
          <span key={m.memberId} className="inline-flex items-center gap-1 rounded-full border border-border-subtle px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300">
            {m.name} <span className="text-zinc-400">· {m.designation}</span>
            <button type="button" aria-label={`Remove ${m.name} from round ${index + 1}`} onClick={() => onMembersSave(round.members.filter((x) => x.memberId !== m.memberId))} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <select
          aria-label={`Add a team member to round ${index + 1}`}
          value={pickId}
          onChange={(e) => {
            const picked = available.find((m) => m._id === e.target.value);
            setPickId("");
            if (picked) onMembersSave([...round.members, { memberId: picked._id, name: picked.name, designation: picked.designation, role: null }]);
          }}
          className="rounded-md border border-border-subtle bg-transparent px-2 py-1 text-xs"
        >
          <option value="">+ Add member…</option>
          {available.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} — {m.designation}
            </option>
          ))}
        </select>
      </div>
      <input
        aria-label={`Note for round ${index + 1}`}
        placeholder="Rejection reason or notes"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== round.note && onNoteSave(note)}
        className={`${INPUT} text-sm`}
      />
    </li>
  );
}
