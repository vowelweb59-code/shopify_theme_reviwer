// Shared display formatters for timestamps (browser locale). One place
// instead of the identical copies several pages used to carry.

/** "Sep 25, 2026, 1:17 PM" */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "Sep 25, 2026" */
export function formatDateOnly(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
