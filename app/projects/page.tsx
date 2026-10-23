"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderKanban, Plus } from "lucide-react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Button } from "@/app/_components/ui/Button";
import { Modal } from "@/app/_components/ui/Modal";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import {
  PORTALS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  typeHasStatus,
  type Portal,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/projects/constants";
import { ImportReportsModal } from "./_components/ImportReportsModal";
import { ProjectStatusPill } from "./_components/ProjectStatusPill";

type ProjectRow = {
  _id: string;
  portal: Portal | null;
  name: string;
  themeId: string;
  themeName: string | null;
  type: ProjectType;
  status: ProjectStatus | null;
  totalHours: number;
  description?: string;
  designDays: number | null;
  developmentDays: number | null;
  rejections: number;
  members: { memberId: string; name: string; designation: string; role: string | null }[];
};

const NEW_THEME = "__new__";
const INPUT = "rounded-md border border-border-subtle bg-transparent px-3 py-2";

function NewProjectModal({
  themes,
  defaultPortal,
  open,
  onOpenChange,
  onCreated,
}: {
  themes: { _id: string; name: string }[];
  defaultPortal: Portal | "";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [portal, setPortal] = useState<Portal | "">(defaultPortal);
  const [type, setType] = useState<ProjectType>("theme_development");
  const [themeId, setThemeId] = useState("");
  const [newThemeName, setNewThemeName] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [designDays, setDesignDays] = useState("");
  const [developmentDays, setDevelopmentDays] = useState("");
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
        body: JSON.stringify({ portal, type, ...(themeId === NEW_THEME ? { newThemeName } : { themeId }), name, status, designDays, developmentDays }),
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
          <span className="text-zinc-700 dark:text-zinc-300">Portal</span>
          <select required value={portal} onChange={(e) => setPortal(e.target.value as Portal)} className={INPUT}>
            <option value="" disabled>
              Choose a portal…
            </option>
            {PORTALS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Project type</span>
          <select value={type} onChange={(e) => setType(e.target.value as ProjectType)} className={INPUT}>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROJECT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {!typeHasStatus(type) && <span className="text-xs text-zinc-500">Ongoing work with no status or due date. You log the hours spent on it instead.</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Theme</span>
          <select
            required
            value={themeId}
            onChange={(e) => {
              setThemeId(e.target.value);
              // Suggest "<theme> project" until the user types their own name.
              if (!name && e.target.value !== NEW_THEME) setName(`${themes.find((t) => t._id === e.target.value)?.name ?? ""} project`.trim());
            }}
            className={INPUT}
          >
            <option value="" disabled>
              Choose a theme…
            </option>
            <option value={NEW_THEME}>+ Create a new theme…</option>
            {themes.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {themeId === NEW_THEME && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">New theme name</span>
            <input
              required
              autoFocus
              value={newThemeName}
              onChange={(e) => {
                setNewThemeName(e.target.value);
                if (!name || name === `${newThemeName} project`.trim()) setName(`${e.target.value} project`.trim());
              }}
              className={INPUT}
              placeholder="e.g. Aurora"
            />
            <span className="text-xs text-zinc-500">Creates the theme without a ZIP; upload one later from the Themes page. A theme with this name is reused if it already exists.</span>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Project name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="e.g. Adorn 5.0 update" />
        </label>
        {typeHasStatus(type) && (
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
        )}
        {typeHasStatus(type) && (
          <div className="grid grid-cols-2 gap-3">
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
  const [importOpen, setImportOpen] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [chatNotice, setChatNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [portalTab, setPortalTab] = useState<Portal | "none">(PORTALS[0]);
  const [typeFilter, setTypeFilter] = useState<ProjectType>(PROJECT_TYPES[0]);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Back from Google's consent screen: reopen the import dialog with the outcome.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("chat");
    if (!outcome) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the OAuth return URL once on mount; it can't be read during render without a hydration mismatch
    setChatNotice(
      outcome === "connected"
        ? { tone: "ok", text: `Google Chat connected as ${params.get("chatAccount") ?? "your account"}.` }
        : outcome === "cancelled"
          ? { tone: "error", text: "Connecting Google Chat was cancelled." }
          : { tone: "error", text: params.get("chatError") ?? "Connecting Google Chat failed." }
    );
    setAutoSync(outcome === "connected"); // freshly connected: import straight away
    setImportOpen(true);
    window.history.replaceState(null, "", "/projects");
  }, []);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        setThemes(data.themes ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Copies the type, theme, description and team; the status goes back to
  // Planning, and the durations and any logged hours are not carried over, since a
  // copy is a fresh run of the work.
  async function handleDuplicate(p: ProjectRow) {
    setError(null);
    setDuplicating(p._id);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal: p.portal,
          type: p.type,
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
    { key: "type", header: "Type", sortValue: (p) => PROJECT_TYPES.indexOf(p.type), render: (p) => PROJECT_TYPE_LABELS[p.type] },
    { key: "status", header: "Status", sortValue: (p) => (p.status ? PROJECT_STATUSES.indexOf(p.status) : -1),
      render: (p) => (p.status ? <ProjectStatusPill status={p.status} /> : <span className="text-zinc-500">Ongoing</span>),
    },
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
    {
      key: "rejections",
      header: "Rejections",
      sortValue: (p) => p.rejections,
      render: (p) => (p.rejections > 0 ? p.rejections : <span className="text-zinc-400">—</span>),
    },
    {
      key: "design",
      header: "Design",
      sortValue: (p) => p.designDays ?? -1,
      render: (p) => (p.designDays == null || !typeHasStatus(p.type) ? <span className="text-zinc-400">—</span> : `${p.designDays} d`),
    },
    {
      key: "development",
      header: "Development",
      sortValue: (p) => p.developmentDays ?? -1,
      render: (p) => (p.developmentDays == null || !typeHasStatus(p.type) ? <span className="text-zinc-400">—</span> : `${p.developmentDays} d`),
    },
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

  // Projects with no portal yet (e.g. made before portals existed) get their own tab, shown only while there are any.
  const unassigned = projects.filter((p) => !p.portal).length;
  const inPortal = projects.filter((p) => (portalTab === "none" ? !p.portal : p.portal === portalTab));
  const visible = inPortal.filter((p) => p.type === typeFilter);
  const countOf = (t: ProjectType) => inPortal.filter((p) => p.type === t).length;
  const portalCount = (p: Portal) => projects.filter((x) => x.portal === p).length;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">Theme builds, theme updates and presets, each with its own team.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setChatNotice(null);
              setAutoSync(true);
              setImportOpen(true);
            }}
          >
            Import from Google Chat
          </Button>
          <Button onClick={() => setModalOpen(true)} disabled={themes.length === 0}>
            <Plus className="h-4 w-4" aria-hidden />
            New project
          </Button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-sm text-status-fail-text dark:border-red-900/50">{error}</div>}

      {projects.length > 0 && (
        <div role="tablist" aria-label="Portal" className="flex flex-wrap gap-1 border-b border-border-subtle">
          {([...PORTALS, ...(unassigned > 0 ? (["none"] as const) : [])] as const).map((p) => {
            const active = portalTab === p;
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPortalTab(p)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
                  active ? "border-primary font-medium text-zinc-950 dark:text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {p === "none" ? "No portal" : p} ({p === "none" ? unassigned : portalCount(p)})
              </button>
            );
          })}
        </div>
      )}

      {projects.length > 0 && (
        <div role="tablist" aria-label="Project type" className="flex flex-wrap gap-2">
          {PROJECT_TYPES.map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  active ? "border-transparent bg-primary-tint font-medium text-primary-tint-text" : "border-border-subtle text-zinc-600 hover:border-border-strong dark:text-zinc-400"
                }`}
              >
                {PROJECT_TYPE_LABELS[t]} ({countOf(t)})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={themes.length === 0 ? "Add a theme on the Themes page first, then start a project for it." : "Start a project for one of your themes, then assign team members to it."}
        />
      ) : (
        <ResponsiveTable columns={columns} rows={visible} emptyMessage="No projects here yet." rowKey={(p) => p._id} onRowClick={(p) => router.push(`/projects/${p._id}`)} />
      )}

      <ImportReportsModal open={importOpen} onOpenChange={setImportOpen} notice={chatNotice} autoSync={autoSync} />
      {modalOpen && <NewProjectModal themes={themes} defaultPortal={portalTab === "none" ? "" : portalTab} open={modalOpen} onOpenChange={setModalOpen} onCreated={(id) => router.push(`/projects/${id}`)} />}
    </PageContainer>
  );
}
