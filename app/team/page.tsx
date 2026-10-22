"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Button } from "@/app/_components/ui/Button";
import { Modal } from "@/app/_components/ui/Modal";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { DESIGNATION_SUGGESTIONS } from "@/lib/projects/constants";
import { successRate } from "@/lib/projects/rounds";

type Member = { _id: string; name: string; email: string | null; designation: string; projectCount: number; rejectionCount: number; approvedCount: number };

// Designations are free text ("Product Manager", "Sr Shopify Developer", ...), so a role is matched by keyword.
const ROLE_TABS = [
  { label: "Manager", match: (m: Member) => /manager/i.test(m.designation) },
  { label: "Shopify Developer", match: (m: Member) => /shopify developer/i.test(m.designation) },
  { label: "UI/UX Designer", match: (m: Member) => /ui\/ux/i.test(m.designation) },
] as const;

const INPUT = "rounded-md border border-border-subtle bg-transparent px-3 py-2";

function MemberModal({ member, open, onOpenChange, onSaved }: { member: Member | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [designation, setDesignation] = useState(member?.designation ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(member ? `/api/team/${member._id}` : "/api/team", {
        method: member ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, designation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save the team member.");
        return;
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Lost connection to the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={member ? "Edit team member" : "Add team member"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Designation</span>
          <input required list="designations" value={designation} onChange={(e) => setDesignation(e.target.value)} className={INPUT} placeholder="e.g. Shopify Developer" />
          <datalist id="designations">
            {DESIGNATION_SUGGESTIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </label>
        {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text dark:border-red-900/50">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {member ? "Save" : "Add member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Member | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/team")
      .then((res) => res.json())
      .then((data) => setMembers(data.members ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openModal(member: Member | null) {
    setEditing(member);
    setModalOpen(true);
  }

  async function handleDelete(member: Member) {
    const note = member.projectCount > 0 ? ` They'll also be removed from ${member.projectCount} project${member.projectCount === 1 ? "" : "s"}.` : "";
    if (!window.confirm(`Delete ${member.name}?${note}`)) return;
    setError(null);
    const res = await fetch(`/api/team/${member._id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to delete the team member.");
      return;
    }
    load();
  }

  const columns: TableColumn<Member>[] = [
    { key: "name", header: "Name", sortValue: (m) => m.name.toLowerCase(), render: (m) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{m.name}</span> },
    { key: "designation", header: "Designation", sortValue: (m) => m.designation.toLowerCase(), render: (m) => m.designation },
    { key: "email", header: "Email", render: (m) => m.email ?? <span className="text-zinc-400">—</span> },
    { key: "projects", header: "Projects", sortValue: (m) => m.projectCount, render: (m) => m.projectCount },
    { key: "rejections", header: "Rejections", sortValue: (m) => m.rejectionCount, render: (m) => m.rejectionCount },
    {
      key: "actions",
      header: "",
      render: (m) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => openModal(m)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleDelete(m)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const [roleTab, setRoleTab] = useState<(typeof ROLE_TABS)[number]["label"]>(ROLE_TABS[0].label);
  const activeTab = ROLE_TABS.find((t) => t.label === roleTab) ?? ROLE_TABS[0];
  const successRows = members.filter((m) => activeTab.match(m) && m.approvedCount + m.rejectionCount > 0);
  const rate = (m: Member) => successRate({ approved: m.approvedCount, rejected: m.rejectionCount });
  const successColumns: TableColumn<Member>[] = [
    { key: "name", header: "Name", sortValue: (m) => m.name.toLowerCase(), render: (m) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{m.name}</span> },
    { key: "designation", header: "Designation", sortValue: (m) => m.designation.toLowerCase(), render: (m) => m.designation },
    { key: "approved", header: "Approved", sortValue: (m) => m.approvedCount, render: (m) => m.approvedCount },
    { key: "rejected", header: "Rejected", sortValue: (m) => m.rejectionCount, render: (m) => m.rejectionCount },
    { key: "rate", header: "Success rate", sortValue: (m) => rate(m) ?? -1, render: (m) => (rate(m) === null ? <span className="text-zinc-400">—</span> : `${rate(m)}%`) },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Team</h1>
          <p className="mt-1 text-sm text-zinc-500">People and their designations. Assign them to theme projects from the Projects page.</p>
        </div>
        <Button onClick={() => openModal(null)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add team member
        </Button>
      </div>

      {!loading && members.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Success rate</h2>
            <p className="mt-1 text-sm text-zinc-500">Approved (Live) rounds out of all decided rounds (Live or Rejected) each member worked on. Rounds still in progress aren't counted.</p>
          </div>
          <div role="tablist" aria-label="Success rate by role" className="flex flex-wrap gap-1 border-b border-border-subtle">
            {ROLE_TABS.map((tab) => {
              const active = roleTab === tab.label;
              return (
                <button
                  key={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRoleTab(tab.label)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
                    active ? "border-primary font-medium text-zinc-950 dark:text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {tab.label} ({members.filter(tab.match).length})
                </button>
              );
            })}
          </div>
          <ResponsiveTable columns={successColumns} rows={successRows} rowKey={(m) => m._id} emptyMessage="No decided rounds yet." />
        </section>
      )}

      {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-sm text-status-fail-text dark:border-red-900/50">{error}</div>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="No team members yet" description="Add the people who work on your themes, with their designation." />
      ) : (
        <ResponsiveTable columns={columns} rows={members} rowKey={(m) => m._id} />
      )}

      {/* key remounts the form so its fields re-seed from the member being edited */}
      <MemberModal key={editing?._id ?? "new"} member={editing} open={modalOpen} onOpenChange={setModalOpen} onSaved={load} />
    </PageContainer>
  );
}
