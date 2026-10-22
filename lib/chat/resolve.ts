import type { ParsedReport } from "./parseReport";

// Turns a parsed report into "which theme, and is it theme or preset work".
// The Theme Name line reads "<Theme> | <Preset or category> | <more>": it is
// preset work when the second part is one of that theme's own presets,
// otherwise (e.g. "Kombat | Gaming Theme | ...") theme work.
export type ThemeRef = { id: string; name: string; presets: string[] };
export type Resolved =
  | { ok: true; themeId: string; themeName: string; kind: "theme" | "preset" | "update"; preset: string | null }
  | { ok: false; reason: string };

const lower = (s: string) => s.trim().toLowerCase();
/** "Noble Theme" is the theme "Noble": a trailing "theme" is dropped when comparing names. */
const nameKey = (s: string) => lower(s).replace(/\s+theme$/, "");

/** A memo about updating the theme means the hours belong to its Theme Update project, not to design or development. */
export function isUpdateMemo(memo: string): boolean {
  return /\bupdat(e|es|ed|ing)\b/i.test(memo);
}

export function resolveTheme(parsed: Pick<ParsedReport, "themeParts"> & { memo?: string }, themes: ThemeRef[]): Resolved {
  const [name, second] = parsed.themeParts;
  const exact = themes.filter((t) => lower(t.name) === lower(name));
  const matches = exact.length > 0 ? exact : themes.filter((t) => nameKey(t.name) === nameKey(name));
  if (matches.length === 0) return { ok: false, reason: `No theme named "${name}".` };
  if (matches.length > 1) return { ok: false, reason: `More than one theme is named "${name}".` };
  const theme = matches[0];
  const preset = second ? theme.presets.find((p) => lower(p) === lower(second)) : undefined;
  const kind = preset ? "preset" : isUpdateMemo(parsed.memo ?? "") ? "update" : "theme";
  return { ok: true, themeId: theme.id, themeName: theme.name, kind, preset: preset ?? null };
}

/** Matches the poster to a team member by name (exact, ignoring case and extra spaces). */
export function resolveMember(sender: string, members: { id: string; name: string }[]): string | null {
  const key = lower(sender).replace(/\s+/g, " ");
  const found = members.filter((m) => lower(m.name).replace(/\s+/g, " ") === key);
  return found.length === 1 ? found[0].id : null;
}
