"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderKanban, Plus } from "lucide-react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Button } from "@/app/_components/ui/Button";
import { Modal } from "@/app/_components/ui/Modal";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { formatDateOnly } from "@/app/_components/formatDate";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/projects/constants";
import { ProjectStatusPill } from "./_components/ProjectStatusPill";

type ProjectRow = {
  _id: string;
  name: string;
  themeId: string;
  themeName: string | null;
  status: ProjectStatus;
  description?: string;
  dueDate: string | null;
  members: { memberId: string; name: string; designation: string; role: string | null }[];
};

const INPUT = "rounded-md border border-border-subtle bg-transparent px-3 py-2";

function NewProjectModal({ themes, open, onOpenChange, onCreated }: { themes: { _id: string; name: string }[]; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [themeId, setThemeId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId, name, status, startDate, dueDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create the project.");
        return;
      }
      onCreated(data.project._id);
    } catch {
      setError("Lost connection to the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New project" description="Team members are added on the project page.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Theme</span>
          <select
            required
            value={themeId}
            onChange={(e) => {
              setThemeId(e.target.value);
              // Suggest "<theme> project" until the user types their own name.
              if (!name) setName(`${themes.find((t) => t._id === e.target.value)?.name ?? ""} project`.trim());
            }}
            className={INPUT}
          >
            <option value="" disabled>
              Choose a theme…
            </option>
            {themes.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Project name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="e.g. Adorn 5.0 update" />
        </label>
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
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Due date</span>
            <input type="date" value={dueDate} min={startDate || undefined} onChange={(e) => setDueDate(e.target.value)} className={INPUT} />
          </label>
        </div>
        {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text dark:border-red-900/50">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [themes, setThemes] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        setThemes(data.themes ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Copies the theme, description and team; the status goes back to Planning
  // and the dates are cleared, since a copy is a fresh run of the work.
  async function handleDuplicate(p: ProjectRow) {
    setError(null);
    setDuplicating(p._id);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeId: p.themeId,
          name: `${p.name} (copy)`,
          description: p.description ?? "",
          status: "planning",
          members: p.members.map((m) => ({ memberId: m.memberId, role: m.role })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to duplicate the project.");
        return;
      }
      router.push(`/projects/${data.project._id}`);
    } catch {
      setError("Lost connection to the server. Try again.");
    } finally {
      setDuplicating(null);
    }
  }

  const columns: TableColumn<ProjectRow>[] = [
    { key: "name", header: "Project", sortValue: (p) => p.name.toLowerCase(), render: (p) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span> },
    { key: "theme", header: "Theme", sortValue: (p) => (p.themeName ?? "").toLowerCase(), render: (p) => p.themeName ?? <span className="text-zinc-400">Deleted theme</span> },
    { key: "status", header: "Status", sortValue: (p) => PROJECT_STATUSES.indexOf(p.status), render: (p) => <ProjectStatusPill status={p.status} /> },
    {
      key: "team",
      header: "Team",
      sortValue: (p) => p.members.length,
      render: (p) =>
        p.members.length === 0 ? (
          <span className="text-zinc-400">No one yet</span>
        ) : (
          <span title={p.members.map((m) => `${m.name} (${m.designation})`).join("\n")}>
            {p.members.length} member{p.members.length === 1 ? "" : "s"}
          </span>
        ),
    },
    { key: "due", header: "Due", sortValue: (p) => p.dueDate ?? "9999", render: (p) => (p.dueDate ? formatDateOnly(p.dueDate) : <span className="text-zinc-400">—</span>) },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            loading={duplicating === p._id}
            disabled={duplicating !== null || !p.themeName}
            onClick={(e) => {
              e.stopPropagation(); // the row itself navigates to the project
              handleDuplicate(p);
            }}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Duplicate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">One or more projects per theme, each with its own team.</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={themes.length === 0}>
          <Plus className="h-4 w-4" aria-hidden />
          New project
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-sm text-status-fail-text dark:border-red-900/50">{error}</div>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={themes.length === 0 ? "Add a theme on the Themes page first, then start a project for it." : "Start a project for one of your themes, then assign team members to it."}
        />
      ) : (
        <ResponsiveTable columns={columns} rows={projects} rowKey={(p) => p._id} onRowClick={(p) => router.push(`/projects/${p._id}`)} />
      )}

      {modalOpen && <NewProjectModal themes={themes} open={modalOpen} onOpenChange={setModalOpen} onCreated={(id) => router.push(`/projects/${id}`)} />}
    </PageContainer>
  );
}
