import type { ParsedReport } from "./parseReport";

// Turns a parsed report into "which theme, and is it theme, preset or update work".
// The Theme Name line reads "<Theme> | <Preset or category> | <more>", but people
// write it loosely ("Aspire Preset | Beauty", "Clothing Theme (Voltix Preset)",
// "Zeal Theme - Zeal"), so the theme is found by its first part when that is a
// theme's name, and otherwise by a known theme name appearing as a whole word
// anywhere in the line (only when exactly one does).
export type ThemeRef = {
  id: string;
  name: string;
  presets: string[];
  /** The theme still has a Theme Design & Development project that isn't Live, i.e. it is being built or reworked. */
  building?: boolean;
};
export type Resolved =
  | { ok: true; themeId: string; themeName: string; kind: "theme" | "preset" | "update"; preset: string | null }
  | { ok: false; reason: string };

const lower = (s: string) => s.trim().toLowerCase();
/** "Noble Theme" is the theme "Noble": a trailing "theme" is dropped when comparing names. */
const nameKey = (s: string) => lower(s).replace(/\s+theme$/, "");
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, word: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}($|[^\\p{L}\\p{N}])`, "iu").test(text);

/** A memo about updating the theme means the hours belong to its Theme Update project, not to design or development. */
export function isUpdateMemo(memo: string): boolean {
  return /\bupdat(e|es|ed|ing)\b/i.test(memo);
}

/**
 * `updatesAndPresetsOnly`: the poster never works on a new theme, so a report that
 * isn't preset work is Theme Update work. A second part that isn't a known
 * preset ("Gravity | Pearl | ...") is not guessed at: it may be a preset the
 * app doesn't list yet, so it is flagged for review.
 */
/** Which theme a Theme Name line is about, and what is left of the line once the theme's own name is set aside. */
export type FoundTheme =
  | { ok: true; theme: ThemeRef; others: string[]; known: string | undefined; saysPreset: boolean }
  | { ok: false; reason: string };

/** Other names a theme goes by in reports (lower case): "Pearl" is Pretty. */
const THEME_NAME_ALIASES: Record<string, string> = { pearl: "pretty" };

export function findTheme(rawParts: string[], themes: ThemeRef[]): FoundTheme {
  const alias = THEME_NAME_ALIASES[nameKey(rawParts[0] ?? "")];
  const parts = alias ? [alias, ...rawParts.slice(1)] : rawParts;
  const [name] = parts;
  const line = parts.join(" | ");

  const exact = themes.filter((t) => lower(t.name) === lower(name));
  let matches = exact.length > 0 ? exact : themes.filter((t) => nameKey(t.name) === nameKey(name));
  let fuzzy = false;
  if (matches.length === 0) {
    matches = themes.filter((t) => hasWord(line, t.name));
    fuzzy = matches.length > 0;
  }
  if (matches.length === 0) return { ok: false, reason: `No theme named "${name}".` };
  if (matches.length > 1) return { ok: false, reason: `More than one theme matches "${name}": ${matches.map((t) => t.name).join(", ")}.` };
  const theme = matches[0];

  // The other parts, once the one naming the theme is set aside, are where a preset name would be.
  const others = parts.filter((p, i) => !(fuzzy ? hasWord(p, theme.name) : i === 0));
  const known = others.map((p) => theme.presets.find((preset) => lower(preset) === lower(p))).find(Boolean);
  return { ok: true, theme, others, known, saysPreset: /\bpreset\b/i.test(line) };
}

function resolveThemeUnmerged(parsed: Pick<ParsedReport, "themeParts"> & { memo?: string }, themes: ThemeRef[], options: { updatesAndPresetsOnly?: boolean } = {}): Resolved {
  const found = findTheme(parsed.themeParts, themes);
  if (!found.ok) return found;
  const { theme, others, known, saysPreset } = found;
  const second = others[0];

  if (known || saysPreset) return { ok: true, themeId: theme.id, themeName: theme.name, kind: "preset", preset: known ?? (saysPreset ? (others.find((p) => !/\bpreset\b/i.test(p)) ?? null) : null) };

  // A second part that isn't a known preset: on a theme still being built it is a category ("Kombat | Gaming Theme"), so
  // new-theme work. On a Live theme it is probably a preset the app doesn't list yet, which would wrongly count as
  // new-theme hours, so it is flagged: add the preset on the theme and re-check. People who never build themes are always flagged.
  if (!isUpdateMemo(parsed.memo ?? "") && second && !(theme.building && !options.updatesAndPresetsOnly)) {
    return {
      ok: false,
      reason: options.updatesAndPresetsOnly
        ? `"${second}" isn't a known preset of ${theme.name}, and this person only does preset or update work.`
        : `"${second}" isn't a known preset of ${theme.name}: is it a preset (add it on the theme) or new-theme work?`,
    };
  }
  const kind = isUpdateMemo(parsed.memo ?? "") || options.updatesAndPresetsOnly ? "update" : "theme";
  return { ok: true, themeId: theme.id, themeName: theme.name, kind, preset: null };
}

/**
 * Themes whose reports now belong to another theme (owner, 2026-11-12: Aspire's reports are Rare's), and the preset each of the
 * old theme's presets became. Keys are lower case. The old theme row stays in the database; reports that still name it are
 * resolved to the new theme here, so a re-check or a late report lands on the right theme.
 */
export const MERGED_THEMES: Record<string, { into: string; presets: Record<string, string> }> = {
  aspire: { into: "Rare", presets: { beauty: "Touch", wellness: "Synergy", clothing: "Charisma", arts: "Presence", art: "Presence" } },
};

/** The new preset name for an old one ("Beauty", "Art theme", "clothing preset" -> its replacement), or undefined when it has none. */
export function mergedPresetName(merge: { presets: Record<string, string> }, preset: string): string | undefined {
  return merge.presets[lower(preset).replace(/\s+(theme|preset)$/, "")];
}

/** Applies MERGED_THEMES to a resolved report; unchanged when its theme wasn't merged or the target theme isn't in `themes`. */
export function applyThemeMerge(resolved: Resolved, themes: ThemeRef[]): Resolved {
  if (!resolved.ok) return resolved;
  const merge = MERGED_THEMES[lower(resolved.themeName)];
  const target = merge && themes.find((t) => lower(t.name) === lower(merge.into));
  if (!merge || !target) return resolved;
  const preset = resolved.preset ? (mergedPresetName(merge, resolved.preset) ?? resolved.preset) : null;
  return { ...resolved, themeId: target.id, themeName: target.name, preset };
}

export function resolveTheme(parsed: Pick<ParsedReport, "themeParts"> & { memo?: string }, themes: ThemeRef[], options: { updatesAndPresetsOnly?: boolean } = {}): Resolved {
  // A merged theme's old preset names (Beauty, Wellness, ...) must still read as presets of it, so they resolve before being renamed.
  const withOldPresets = themes.map((t) => {
    const merge = MERGED_THEMES[lower(t.name)];
    return merge ? { ...t, presets: [...t.presets, ...Object.keys(merge.presets).map((p) => p[0].toUpperCase() + p.slice(1))] } : t;
  });
  return applyThemeMerge(resolveThemeUnmerged(parsed, withOldPresets, options), themes);
}

/** Matches the poster to a team member by name or alias (exact, ignoring case and extra spaces). */
export function resolveMember(sender: string, members: { id: string; name: string; aliases?: string[] }[]): string | null {
  const norm = (s: string) => lower(s).replace(/\s+/g, " ");
  const key = norm(sender);
  const found = members.filter((m) => norm(m.name) === key || (m.aliases ?? []).some((a) => norm(a) === key));
  return found.length === 1 ? found[0].id : null;
}
