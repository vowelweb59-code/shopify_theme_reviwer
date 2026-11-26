// Suggests which Chat space belongs to which active Service project, by name (owner, 2026-11-26: "read all the space names and cross-check them
// against the active project names"). A project is named "<Client> – <Upwork profile>" or just "<Client>"; a space is named by the team,
// so a match is a suggestion for a person to confirm, never connected automatically.

const STOP = new Set(["llc", "inc", "ltd", "co", "the", "and", "of", "dm", "project", "space", "team", "group", "chat", "shopify"]);

function words(s: string): string[] {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w));
}

/** The client part of a project name: "Ledty LavishCo – Batul" -> "Ledty LavishCo". */
export const clientOf = (projectName: string) => projectName.split(/\s[–—-]\s/)[0].trim();

/** 0 to 100: how well a space name fits a project's client name. 70 and up is worth showing. */
export function nameScore(spaceName: string, projectName: string): number {
  const c = words(clientOf(projectName));
  const s = words(spaceName);
  if (!c.length || !s.length) return 0;
  if (c.join(" ") === s.join(" ")) return 100;
  const sSet = new Set(s);
  const cSet = new Set(c);
  const clientInSpace = c.every((w) => sSet.has(w));
  const spaceInClient = s.every((w) => cSet.has(w));
  if (clientInSpace && c.length >= 2) return 90;
  if (spaceInClient && s.length >= 2) return 80;
  if (clientInSpace) return 75; // a one-word client name found inside a longer space name
  if (c.length >= 2 && c.filter((w) => sSet.has(w)).length >= 2) return 70;
  return 0;
}

export interface SpaceRef {
  name: string;
  displayName: string;
}
export interface ProjectRef {
  id: string;
  name: string;
}
export interface ProjectMatch {
  project: ProjectRef;
  candidates: Array<SpaceRef & { score: number }>;
}

export function matchSpacesToProjects(spaces: readonly SpaceRef[], projects: readonly ProjectRef[]): ProjectMatch[] {
  return projects.map((project) => ({
    project,
    candidates: spaces
      .map((sp) => ({ ...sp, score: nameScore(sp.displayName, project.name) }))
      .filter((c) => c.score >= 70)
      .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName)),
  }));
}
