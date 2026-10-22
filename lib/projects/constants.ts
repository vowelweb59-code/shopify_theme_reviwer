// Theme Design & Development and Preset Development are one-off pieces of work
// that move through PROJECT_STATUSES. Theme Update is continuous: it has no
// status or due date, and is tracked by the hours logged against it instead.
export const PROJECT_TYPES = ["theme_development", "theme_update", "preset_development"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  theme_development: "Theme Design & Development",
  theme_update: "Theme Update",
  preset_development: "Preset Development",
};

/** Whether a project of this type moves through statuses and has a due date (false: it tracks hours instead). */
export function typeHasStatus(type: ProjectType): boolean {
  return type !== "theme_update";
}

export const PROJECT_STATUSES = [
  "planning",
  "under_designing",
  "design_completed",
  "under_development",
  "theme_uploaded",
  "under_review",
  "error_given",
  "live",
  "rejected",
  "active",
  "on_hold",
  "completed",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  under_designing: "Under Designing",
  design_completed: "Design Completed",
  under_development: "Under Development",
  theme_uploaded: "Theme Uploaded",
  under_review: "Under Review",
  error_given: "Error Given",
  live: "Live",
  rejected: "Rejected",
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
export const MAX_NOTE = 300;
export const MAX_DURATION_DAYS = 3650;
export const MAX_HOURS_PER_ENTRY = 24;
