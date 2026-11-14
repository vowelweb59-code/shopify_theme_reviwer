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

/** Accents are ignored when comparing names: "Home Décor" and "Home Decor" are the same name. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const lower = (s: string) => fold(s.trim().toLowerCase());
/** "Noble Theme" is the theme "Noble": a trailing "theme" is dropped when comparing names. */
const nameKey = (s: string) => lower(s).replace(/\s+theme$/, "");
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, word: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(fold(word))}($|[^\\p{L}\\p{N}])`, "iu").test(fold(text));

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
const THEME_NAME_ALIASES: Record<string, string> = { pearl: "pretty", space: "home décor", automobile: "auto" };

/** A second part that names the kind of work (update work), not a preset. Extend it as new wordings appear. */
const UPDATE_PART_RE = /^(theme[\s-]*(updates?|support)|featured images?)$/i;

/**
 * Theme lines that are not theme work at all (owner, 2026-11-12: client work, days spread over several themes, Webflow, the portals,
 * one-off tasks). A report with such a line is ignored, not flagged and not counted anywhere.
 */
const IGNORED_THEME_LINES: RegExp[] = [/^clients?\s+work$/i, /^multiple\s+themes?$/i, /\bwebflow\b/i, /\bportal$/i, /^(vowel\s*web|themeshopy|fresco\s+solutions)$/i, /^\(?\s*task\s*\)?\s*[:\-]/i, /supplement and investment/i];
export function isIgnoredThemeLine(themeParts: string[]): boolean {
  const first = (themeParts[0] ?? "").trim();
  return IGNORED_THEME_LINES.some((re) => re.test(first));
}

export function findTheme(rawParts: string[], themes: ThemeRef[]): FoundTheme {
  // "Space I Home Theme I Themeshopy": a capital I is sometimes typed for the pipe, so the theme is what comes before it.
  const alias = THEME_NAME_ALIASES[nameKey(rawParts[0] ?? "").split(/\s+[i|]\s+/)[0]];
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
  if (matches.length === 0) {
    // "Rare - Rare | Jewellery": a dash can join the theme name to a second name.
    const dashed = name.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
    if (dashed.length > 1) {
      const viaDash = findTheme([...dashed, ...parts.slice(1)], themes);
      if (viaDash.ok) return viaDash;
    }
    // "Clear Preset", "Automobile Theme": no theme named, but a preset that only one of our themes has.
    const presetName = lower(name).replace(/\s+(preset|theme)$/, "");
    const owners = themes.filter((t) => t.presets.some((preset) => lower(preset) === presetName && lower(preset) !== lower(t.name)));
    if (owners.length === 1) {
      const known = owners[0].presets.find((preset) => lower(preset) === presetName);
      return { ok: true, theme: owners[0], others: [name], known, saysPreset: true };
    }
    if (owners.length > 1) return { ok: false, reason: `"${name}" is a preset of more than one theme: ${owners.map((t) => t.name).join(", ")}. Say which theme.` };
    return { ok: false, reason: `No theme named "${name}".` };
  }
  // "Dynamic and Voltix": two themes named together, joined by "and", "&" or a comma; the first one named takes the report.
  // Only when the line says the work is update work ("Dynamic and Voltix | Theme Support"); otherwise two themes stay flagged.
  if (matches.length > 1 && fuzzy && /\s(and|&)\s|,/i.test(name) && parts.slice(1).some((p) => UPDATE_PART_RE.test(p.trim()))) {
    const at = (t: ThemeRef) => lower(line).indexOf(lower(t.name));
    matches = [[...matches].sort((a, b) => at(a) - at(b))[0]];
  }
  if (matches.length > 1) return { ok: false, reason: `More than one theme matches "${name}": ${matches.map((t) => t.name).join(", ")}.` };
  const theme = matches[0];

  // The other parts, once the one naming the theme is set aside, are where a preset name would be.
  const others = parts.filter((p, i) => !(fuzzy ? hasWord(p, theme.name) : i === 0));
  // "Jewelry Preset", "Touch theme": a trailing "preset" / "theme" is not part of the preset's name.
  const known = others.map((p) => theme.presets.find((preset) => lower(preset) === lower(p) || lower(preset) === lower(p).replace(/\s+(preset|theme)$/, ""))).find(Boolean);
  return { ok: true, theme, others, known, saysPreset: /\bpreset\b/i.test(line) };
}

function resolveThemeUnmerged(parsed: Pick<ParsedReport, "themeParts"> & { memo?: string }, themes: ThemeRef[], options: { updatesAndPresetsOnly?: boolean } = {}): Resolved {
  const found = findTheme(parsed.themeParts, themes);
  if (!found.ok) return found;
  const { theme, others, known, saysPreset } = found;
  const second = others[0];

  // "Zeal | Theme Update", "Dynamic | Theme Support", "Zeal | Featured Images": the second part says what the work is (update work), it isn't a preset.
  if (second && UPDATE_PART_RE.test(second.trim()) && !known) return { ok: true, themeId: theme.id, themeName: theme.name, kind: "update", preset: null };

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
  // A memo the poster labelled "Theme Development" / "Theme Design" is new-theme work even if it also says "content update".
  const labelledAsBuild = /^\s*theme\s+(design|development)\b/i.test(parsed.memo ?? "");
  const kind = options.updatesAndPresetsOnly || (isUpdateMemo(parsed.memo ?? "") && !labelledAsBuild) ? "update" : "theme";
  return { ok: true, themeId: theme.id, themeName: theme.name, kind, preset: null };
}

/**
 * Themes whose reports now belong to another theme (owner, 2026-11-12: Aspire's reports are Rare's), and the preset each of the
 * old theme's presets became. Keys are lower case. The old theme row stays in the database; reports that still name it are
 * resolved to the new theme here, so a re-check or a late report lands on the right theme.
 */
export const MERGED_THEMES: Record<string, { into: string; presets: Record<string, string> }> = {
  aspire: { into: "Rare", presets: { beauty: "Touch", wellness: "Synergy", clothing: "Charisma", arts: "Presence", art: "Presence", jewellery: "Jewellery", jewelry: "Jewellery" } },
};

/**
 * Second names that mean the theme itself, not a preset (owner, 2026-11-13: all the "Aspire Jewellery" work was Aspire's main
 * theme, now Rare; Ehtesham, Shailesh and Pranay built it). A report naming one is new-theme work on the theme (or update work if it
 * says update), never preset work.
 */
export const MAIN_THEME_PRESETS: Record<string, string[]> = { rare: ["jewellery", "jewelry"] };

const presetKey = (preset: string) => lower(preset).replace(/\s+(theme|preset)$/, "");

/** A resolved report whose "preset" is the theme's own main design becomes work on the theme itself. */
function applyMainThemePreset(resolved: Resolved): Resolved {
  if (!resolved.ok || !resolved.preset) return resolved;
  if (!MAIN_THEME_PRESETS[lower(resolved.themeName)]?.includes(presetKey(resolved.preset))) return resolved;
  return { ...resolved, kind: resolved.kind === "preset" ? "theme" : resolved.kind, preset: null };
}

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
    const main = MAIN_THEME_PRESETS[lower(t.name)] ?? [];
    const extra = [...(merge ? Object.keys(merge.presets) : []), ...main].map((p) => p[0].toUpperCase() + p.slice(1));
    return extra.length ? { ...t, presets: [...t.presets, ...extra] } : t;
  });
  return applyMainThemePreset(applyThemeMerge(resolveThemeUnmerged(parsed, withOldPresets, options), themes));
}

/** Matches the poster to a team member by name or alias (exact, ignoring case and extra spaces). */
export function resolveMember(sender: string, members: { id: string; name: string; aliases?: string[] }[]): string | null {
  const norm = (s: string) => lower(s).replace(/\s+/g, " ");
  const key = norm(sender);
  const found = members.filter((m) => norm(m.name) === key || (m.aliases ?? []).some((a) => norm(a) === key));
  return found.length === 1 ? found[0].id : null;
}
