import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/projects/constants";

const TONE: Record<ProjectStatus, string> = {
  planning: "bg-status-not-tested-bg text-status-not-tested-text",
  under_designing: "bg-primary-tint text-primary-tint-text",
  under_development: "bg-status-warning-bg text-status-warning-text",
  live: "bg-status-pass-bg text-status-pass-text",
  rejected: "bg-status-fail-bg text-status-fail-text",
  active: "bg-status-pass-bg text-status-pass-text",
  on_hold: "bg-status-warning-bg text-status-warning-text",
  completed: "bg-primary-tint text-primary-tint-text",
};

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status]}`}>{PROJECT_STATUS_LABELS[status]}</span>;
}
