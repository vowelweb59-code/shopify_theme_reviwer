// Matches a client name written in the sales sheet to a client in the app. The sheet writes "William P", "Julica O (Dressed To Inspire SL)",
// "Brandy"; the app has "William Poon", "Julica Ortlinghaus", "Brandy Fortjin". Pure.
export const normName = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export interface ClientNames { id: string; names: readonly string[] }
export type MatchResult = { clientId: string; how: "exact" | "fuzzy" } | { clientId: null; how: "none" | "ambiguous" };

export function matchClient(sheetName: string, clients: readonly ClientNames[]): MatchResult {
  const n = normName(sheetName);
  if (!n) return { clientId: null, how: "none" };
  const normed = clients.map((c) => ({ id: c.id, names: c.names.map(normName).filter(Boolean) }));
  const exact = normed.filter((c) => c.names.includes(n));
  if (exact.length === 1) return { clientId: exact[0].id, how: "exact" };
  if (exact.length > 1) return { clientId: null, how: "ambiguous" };
  const toks = n.split(" ");
  const found = new Set<string>();
  for (const c of normed) {
    for (const an of c.names) {
      const at = an.split(" ");
      if (an.startsWith(n) || n.startsWith(an)) { found.add(c.id); break; }
      // "William P" = "William Poon": same first name, the sheet's last word is an initial.
      if (toks.length >= 2 && at.length >= 2 && toks[0] === at[0] && toks[toks.length - 1].length === 1 && at[at.length - 1].startsWith(toks[toks.length - 1])) { found.add(c.id); break; }
      // "M Rabi" = "Mohammed Rabi": same last name, one first name is an initial.
      if (toks.length >= 2 && at.length >= 2 && toks[toks.length - 1] === at[at.length - 1] && toks[0][0] === at[0][0] && (toks[0].length === 1 || at[0].length === 1)) { found.add(c.id); break; }
      // "Saleem Joya" = "Sal Joya": same last name, one first name starts with the other (at least 3 letters).
      if (toks.length >= 2 && at.length >= 2 && toks[toks.length - 1] === at[at.length - 1] && Math.min(toks[0].length, at[0].length) >= 3 && (toks[0].startsWith(at[0]) || at[0].startsWith(toks[0]))) { found.add(c.id); break; }
    }
  }
  if (found.size === 1) return { clientId: [...found][0], how: "fuzzy" };
  return { clientId: null, how: found.size > 1 ? "ambiguous" : "none" };
}
