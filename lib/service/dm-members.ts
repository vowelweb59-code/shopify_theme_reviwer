// The Digital Marketing people (owner, 2026-11-14/16): the only people whose hours the live Service section keeps. Used by the
// Postgres migration (--digital-marketing) and by the TIMER STATUS sync, so both pick the same people.
// First names match the first word of a person's name; a two-word entry must match the whole start of the name.
export const DM_MEMBERS = ["Himanshi", "Aman", "Pranjal", "Bhavesh", "Trishul", "Rupali", "Hamza", "Neha", "Priyanka Raut", "Kunal", "Adnan", "Mustufa", "Saloni", "Alefiya", "Batul"];

/** Team members who have left the company (owner): still in DM_MEMBERS so their past hours keep counting, but never shown as a current member. */
export const DM_LEFT = ["Priyanka Raut", "Batul"];

const normName = (s: string | null | undefined) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** The list entry this name matches, or null. */
export function dmMatch(name: string | null | undefined): string | null {
  const n = normName(name);
  if (!n) return null;
  for (const entry of DM_MEMBERS) {
    const e = normName(entry);
    if (e.includes(" ") ? n === e || n.startsWith(`${e} `) : n.split(" ")[0] === e) return entry;
  }
  return null;
}

/** True when this person is on the list of people who left. */
export function dmHasLeft(name: string | null | undefined): boolean {
  const key = dmMatch(name);
  return key !== null && DM_LEFT.includes(key);
}
