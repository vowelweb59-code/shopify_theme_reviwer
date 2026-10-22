export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

// Suggestions only (a <datalist>); any designation up to MAX_TEXT is accepted.
export const DESIGNATION_SUGGESTIONS = [
  "Project Manager",
  "Team Lead",
  "Shopify Developer",
  "Frontend Developer",
  "UI/UX Designer",
  "QA Engineer",
  "Content Writer",
  "SEO Specialist",
  "Support Executive",
] as const;

export const MAX_NAME = 120;
export const MAX_TEXT = 80;
export const MAX_DESCRIPTION = 2000;
export const MAX_PROJECT_MEMBERS = 50;
