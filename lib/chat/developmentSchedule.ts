// ONE-TIME CLEANUP of the existing time reports (scripts/classify-existing-reports.ts); nothing in the live import reads this.
// Which themes were under new development in which month. A time report is new-development work when its theme is on that
// month's list; anything else done on a theme that month is a theme update (logged on its "<Theme> Update" project).
// An entry with `presets` covers only those presets of the theme (the rest of that theme's work is updates).
// Once the team has a report format that says what kind of work it is, new reports won't need a list like this.
export type DevelopmentEntry = { theme: string; presets?: string[] };

const SEPT_OCT: DevelopmentEntry[] = ["Voltix", "Aspire", "Pretty", "Auto", "Breeze", "Grocery", "Velocity", "Apollo", "Kombat", "Home Décor"].map((theme) => ({ theme }));

export const DEVELOPMENT_SCHEDULE: Record<string, DevelopmentEntry[]> = {
  "2026-10": SEPT_OCT,
  "2026-09": SEPT_OCT,
  // The same list, plus Soft's Twinkle preset.
  "2026-08": [...SEPT_OCT, { theme: "Soft", presets: ["Twinkle"] }],
  // Everything done on Soft counted as theme work, and Voltix was new development from the start of the reports.
  "2026-07": [{ theme: "Soft" }, { theme: "Voltix" }],
  "2026-06": [{ theme: "Soft" }],
};

/** Other names a theme goes by in reports: "Pearl" is Pretty. Keys are lower case. */
export const THEME_ALIASES: Record<string, string> = {
  pearl: "pretty",
  // Free-form names that appeared in the existing reports.
  "bag shopify theme": "legacy",
  "transform theme to beauty": "zeal",
  "nobal theme": "noble",
  nobal: "noble",
  "organic theme": "grocery",
  organic: "grocery",
};

/** The month ("YYYY-MM") of an ISO date, and its development list, or null when that month isn't scheduled. */
export function developmentFor(date: string | undefined): DevelopmentEntry[] | null {
  return (date && DEVELOPMENT_SCHEDULE[date.slice(0, 7)]) || null;
}
