// Per-live pay (owner, 2026-11-13): some people are not paid a monthly salary but a fixed amount for each Theme Design & Development
// project and each Preset Design & Development project that goes Live and that they are on (assigned to it, or reported time on it).
// That amount is what the project cost for them; their reported hours are not priced by the hour.
//
// When it was earned: there is no "went live" date, so it is dated to the month of the project's last report (the same stand-in the
// Deadlines page uses for a finished project). A live project with no report at all has no month.

export type PerLivePerson = { id: string; perLiveTheme: number | null; perLivePreset: number | null };
export type LiveProject = {
  id: string;
  themeId: string;
  kind: "theme" | "preset";
  /** Assigned members and people who reported on it. */
  people: Set<string>;
  /** Month of its last report, "YYYY-MM", or null. */
  month: string | null;
};
export type Payment = { projectId: string; themeId: string; memberId: string; line: "build" | "presets"; amount: number; month: string | null };

export function perLivePayments(projects: LiveProject[], people: PerLivePerson[]): Payment[] {
  const out: Payment[] = [];
  for (const project of projects) {
    for (const person of people) {
      if (!project.people.has(person.id)) continue;
      const amount = project.kind === "theme" ? person.perLiveTheme : person.perLivePreset;
      if (!amount || amount <= 0) continue;
      out.push({ projectId: project.id, themeId: project.themeId, memberId: person.id, line: project.kind === "theme" ? "build" : "presets", amount, month: project.month });
    }
  }
  return out;
}
