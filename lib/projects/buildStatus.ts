import type { ProjectStatus } from "./constants";

// The early stage of a Theme / Preset Design & Development project follows who is reporting on it (owner, 2026-11-14): while only
// designers report, it is Under Designing; once a developer's reports appear, it is Under Development. It only moves forward, and only
// out of Planning or Under Designing: a project the owner has taken further (Design Completed, Theme Uploaded, Under Review, Live,
// Rejected, ...) is never touched, and Under Development never goes back. Product Managers' reports say nothing about the stage.

const DESIGNER_RE = /designer|ui\/ux/i;
const DEVELOPER_RE = /developer/i;
const MANAGER_RE = /manager/i;

/** The status the project should move to given the designations of the people who reported on it, or null when it should stay as it is. */
export function detectBuildStatus(current: string | null, designations: (string | null | undefined)[]): ProjectStatus | null {
  if (current !== "planning" && current !== "under_designing") return null;
  const people = designations.filter((d) => !MANAGER_RE.test(d ?? ""));
  if (people.some((d) => DEVELOPER_RE.test(d ?? ""))) return "under_development";
  if (current === "planning" && people.some((d) => DESIGNER_RE.test(d ?? ""))) return "under_designing";
  return null;
}
