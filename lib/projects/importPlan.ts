import type { ProjectStatus } from "./constants";

// Turns the project sheet (data/project-import.json) plus what's already in the
// database into a list of creates and updates. Pure — no database access — so
// it can be dry-run and unit-tested; scripts/import-projects.ts applies it.
//
// How the sheet becomes projects:
//  - One project per version. A theme's versions are the numbered ones named
//    anywhere in the Designers / Developers / Managers tables, plus any
//    "<Theme> Version N" project already in the database. A theme with no
//    numbered version is a single project named after the theme.
//  - A name without a number ("Aspire", "Zeal") means every version of it.
//  - A newer version only exists because the one before it was rejected, so
//    every version but the latest is Rejected; the latest takes the status
//    from the main table, and the table's design/development days.
//  - Matching is by name, case-insensitive, so re-running never duplicates.
//    An existing project is only filled in (blank days/description, missing
//    team members) — its status, days and team are never overwritten or removed.
//  - Team comes from the summary tables. The latest version also takes the main
//    table's designers/developers for any role the summary tables leave empty
//    for it (they often only name the earlier versions).

export type ImportTheme = {
  portal: string;
  theme: string;
  rejections: number | null;
  status: string;
  developmentDays: number | null;
  designDays: number | null;
  note?: string;
  designers: string[];
  developers: string[];
};
export type ImportAssignment = { role: "designer" | "developer" | "manager"; person: string; projects: string[] };
export type ImportData = {
  people: Record<string, string>;
  newMembers: { name: string; designation: string }[];
  themeAliases: Record<string, string>;
  statusMap: Record<string, ProjectStatus>;
  themes: ImportTheme[];
  assignments: ImportAssignment[];
};

export type ExistingProject = {
  name: string;
  themeName: string | null;
  status: string | null;
  designDays: number | null;
  developmentDays: number | null;
  description: string;
  memberNames: string[];
};
export type ExistingState = { themes: string[]; members: string[]; projects: ExistingProject[] };

export type PlannedProject = {
  name: string;
  themeName: string;
  status: ProjectStatus;
  designDays: number | null;
  developmentDays: number | null;
  description: string;
  memberNames: string[];
};
export type PlannedUpdate = {
  name: string;
  set: { designDays?: number; developmentDays?: number; description?: string };
  addMembers: string[];
  notes: string[];
};
export type Plan = {
  newThemes: string[];
  newMembers: { name: string; designation: string }[];
  creates: PlannedProject[];
  updates: PlannedUpdate[];
  /** Sheet entries that can't become a project (no main-table row, so no status). */
  skipped: string[];
  /** Places where the sheet's tables disagree with each other or with the database. */
  conflicts: string[];
};

const LABEL_RE = /^(.+?)(?:\s+(?:version|vesion|v))?\s*(\d+)?$/i;
const lower = (s: string) => s.trim().toLowerCase();

/** "Voltix version 1" / "Velocity 1" / "Apollo Vesion 2" -> { theme: "Voltix", version: 1 }; "Aspire" -> version null. */
export function parseProjectLabel(label: string): { theme: string; version: number | null } {
  const m = LABEL_RE.exec(label.trim());
  return m ? { theme: m[1].trim(), version: m[2] ? Number(m[2]) : null } : { theme: label.trim(), version: null };
}

export function buildPlan(data: ImportData, existing: ExistingState): Plan {
  const plan: Plan = { newThemes: [], newMembers: [], creates: [], updates: [], skipped: [], conflicts: [] };
  const fullName = (first: string) => data.people[first] ?? first;
  const sheetThemes = new Map(data.themes.map((t) => [lower(t.theme), t]));
  const resolveTheme = (raw: string) => sheetThemes.get(lower(data.themeAliases[lower(raw)] ?? raw));

  const existingThemes = new Set(existing.themes.map(lower));
  const existingMembers = new Set(existing.members.map(lower));
  const existingByName = new Map(existing.projects.map((p) => [lower(p.name), p]));

  for (const m of data.newMembers) if (!existingMembers.has(lower(m.name))) plan.newMembers.push(m);
  for (const t of data.themes) if (!existingThemes.has(lower(t.theme))) plan.newThemes.push(t.theme);

  // Every assignment, resolved to (theme row, version | null, role, person).
  type Resolved = { theme: ImportTheme; version: number | null; role: ImportAssignment["role"]; person: string };
  const resolved: Resolved[] = [];
  const skippedThemes = new Set<string>();
  for (const a of data.assignments) {
    for (const label of a.projects) {
      const { theme, version } = parseProjectLabel(label);
      const row = resolveTheme(theme);
      if (!row) skippedThemes.add(theme.replace(/^./, (c) => c.toUpperCase()));
      else resolved.push({ theme: row, version, role: a.role, person: fullName(a.person) });
    }
  }
  for (const name of [...skippedThemes].sort()) plan.skipped.push(`${name}: named in the Designers/Developers/Managers tables but has no row in the main table, so no status or days to import.`);

  for (const row of data.themes) {
    const mine = resolved.filter((r) => r.theme === row);
    const versions = new Set<number>();
    for (const r of mine) if (r.version !== null) versions.add(r.version);
    const versionName = (n: number) => `${row.theme} Version ${n}`;
    // Versions that already exist as projects count too (e.g. Adorn Version 1-3).
    const own = new RegExp(`^${row.theme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} version (\\d+)$`, "i");
    for (const p of existing.projects) {
      const m = own.exec(p.name);
      if (m) versions.add(Number(m[1]));
    }

    const sorted = [...versions].sort((a, b) => a - b);
    const names = sorted.length > 0 ? sorted.map(versionName) : [row.theme];
    const status = data.statusMap[row.status];
    if (!status) {
      plan.conflicts.push(`${row.theme}: status "${row.status}" has no mapping.`);
      continue;
    }

    const earlier = Math.max(names.length - 1, 0);
    // The table's count may or may not include a rejection that is the current status.
    if (row.rejections !== null && row.rejections !== earlier && row.rejections !== earlier + (status === "rejected" ? 1 : 0)) {
      plan.conflicts.push(`${row.theme}: the table says ${row.rejections} rejection(s) but ${earlier} earlier version(s) are marked Rejected (versions found: ${names.length}).`);
    }

    const tableFirsts = { designer: row.designers, developer: row.developers } as const;
    const listedPeople = (role: Resolved["role"]) => new Set(mine.filter((r) => r.role === role).map((r) => r.person));
    for (const role of ["designer", "developer"] as const) {
      for (const first of tableFirsts[role]) {
        const person = fullName(first);
        if (!listedPeople(role).has(person)) {
          plan.conflicts.push(`${row.theme}: the main table names ${first} as a ${role}, but the ${role} list doesn't include them for this theme.`);
        }
      }
    }

    names.forEach((name, i) => {
      const latest = i === names.length - 1;
      const version = sorted.length > 0 ? sorted[i] : null;
      const members: string[] = [];
      const roles = new Set<string>();
      for (const r of mine) {
        if (r.version !== null && r.version !== version) continue;
        roles.add(r.role);
        if (!members.includes(r.person)) members.push(r.person);
      }
      if (latest) {
        for (const role of ["designer", "developer"] as const) {
          if (roles.has(role)) continue;
          for (const first of tableFirsts[role]) if (!members.includes(fullName(first))) members.push(fullName(first));
        }
      }

      const description = [
        `Portal: ${row.portal}.`,
        latest && row.rejections !== null ? `Rejections on this theme: ${row.rejections}.` : "",
        latest && row.note ? row.note : "",
      ]
        .filter(Boolean)
        .join(" ");
      const wanted = {
        status: latest ? status : ("rejected" as ProjectStatus),
        designDays: latest ? row.designDays : null,
        developmentDays: latest ? row.developmentDays : null,
      };

      const found = existingByName.get(lower(name));
      if (!found) {
        plan.creates.push({ name, themeName: row.theme, description, memberNames: members, ...wanted });
        return;
      }
      const update: PlannedUpdate = { name: found.name, set: {}, addMembers: [], notes: [] };
      if (found.status && found.status !== wanted.status) update.notes.push(`status stays ${found.status} (sheet says ${wanted.status})`);
      for (const key of ["designDays", "developmentDays"] as const) {
        const value = wanted[key];
        if (value === null) continue;
        if (found[key] === null) update.set[key] = value;
        else if (found[key] !== value) update.notes.push(`${key} stays ${found[key]} (sheet says ${value})`);
      }
      if (!found.description && description) update.set.description = description;
      const have = new Set(found.memberNames.map(lower));
      update.addMembers = members.filter((m) => !have.has(lower(m)));
      if (found.themeName && lower(found.themeName) !== lower(row.theme)) update.notes.push(`stays under theme ${found.themeName}`);
      plan.updates.push(update);
    });
  }

  return plan;
}
