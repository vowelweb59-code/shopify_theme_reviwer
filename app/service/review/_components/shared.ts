// Shared bits for the Service > Review pages.

/** Plain-language meaning of each flag the importer can raise. */
export const FLAG_LABELS: Record<string, string> = {
  OPEN_INTERVAL: "Timer switched on, never switched off",
  ORPHAN_OFF: "Timer switched off, no matching ON",
  DUPLICATE_ON: "Switched on twice in a row",
  UNKNOWN_CLIENT: "Client not recognised",
  AMBIGUOUS_CLIENT: "Client could match several names",
  MULTIPLE_REPORTS_SAME_DAY: "Several reports for this client on one day",
  DATE_FAR_FROM_POST: "Report date is far from the day it was posted",
  ON_TIMER_MISMATCH: "ON hours in the report differ from the timer",
  ON_TIMER_NOT_FOUND: "Report mentions ON hours but no timer was found",
  SUSPICIOUS_DURATION: "Unusually long or short duration",
  INVALID_DURATION: "Duration could not be read",
  CROSSES_MIDNIGHT: "Timer ran past midnight",
  NO_TIMER_DATA: "No timer found to compare with",
  LATE_REPORT: "Posted after the Monday 17:30 cut-off",
};

export const flagLabel = (f: string) => FLAG_LABELS[f] ?? f.replaceAll("_", " ").toLowerCase();

export const BTN = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60";
export const SECTION = "rounded-lg border border-border-subtle bg-surface p-4";
export const LINK = "text-primary hover:underline";
export const splitList = (v: string) => v.split(",").map((a) => a.trim()).filter(Boolean);
