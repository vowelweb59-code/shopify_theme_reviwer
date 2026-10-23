import { THEME_ALIASES, developmentFor } from "./developmentSchedule";
import type { ParsedReport } from "./parseReport";
import { findTheme, type ThemeRef } from "./resolve";

// One-time classification of the existing time reports by the monthly development lists
// (lib/chat/developmentSchedule.ts), used only by scripts/classify-existing-reports.ts.
//   - the theme is on that month's list  -> new development: "theme", or "preset" for a preset of it
//   - any other theme                    -> "update" (logged on its "<Theme> Update" project)
export type Historical =
  | { ok: true; themeId: string; themeName: string; kind: "theme" | "preset" | "update"; preset: string | null }
  | { ok: false; reason: string };

const lower = (s: string) => s.trim().toLowerCase();
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, word: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}($|[^\\p{L}\\p{N}])`, "iu").test(text);

export function classifyHistorical(parsed: Pick<ParsedReport, "themeParts" | "date">, themes: ThemeRef[], options: { updatesAndPresetsOnly?: boolean } = {}): Historical {
  const schedule = developmentFor(parsed.date);
  if (!schedule) return { ok: false, reason: `There is no development list for ${parsed.date.slice(0, 7)}.` };

  // "Pearl" is Pretty.
  const parts = [...parsed.themeParts];
  const alias = THEME_ALIASES[lower(parts[0])];
  if (alias) parts[0] = alias;

  const found = findTheme(parts, themes);
  if (!found.ok) return found;
  const { theme, others, known, saysPreset } = found;
  const preset = known ?? (saysPreset ? (others.find((p) => !/\bpreset\b/i.test(p)) ?? null) : null);

  const entry = schedule.find((e) => lower(e.theme) === lower(theme.name));
  const presetOnly = entry?.presets !== undefined;
  const line = parts.join(" | ");
  const inDevelopment = !!entry && (!presetOnly || entry.presets!.some((p) => hasWord(line, p)));
  if (!inDevelopment) return { ok: true, themeId: theme.id, themeName: theme.name, kind: "update", preset };

  const isPreset = presetOnly || !!known || saysPreset || options.updatesAndPresetsOnly;
  return { ok: true, themeId: theme.id, themeName: theme.name, kind: isPreset ? "preset" : "theme", preset };
}
