// "Back" on a project page returns to the list exactly as it was left (owner, 2026-11-23: the same week or month, tab and filters). The list
// puts its own address in `?back=`; the project page keeps it on its own links and uses it for "← Projects".

/** The address to go back to, or null unless it is a path inside /service (never an outside address). */
export function safeBack(raw: string | undefined | null): string | null {
  if (!raw || !raw.startsWith("/service") || raw.startsWith("//") || /[\r\n\\]/.test(raw)) return null;
  const rest = raw.slice("/service".length);
  return rest === "" || rest[0] === "/" || rest[0] === "?" ? raw : null;
}

/** The project link that remembers where the list was. */
export function projectHref(id: string, back: string): string {
  return `/service/projects/${id}?back=${encodeURIComponent(back)}`;
}

/** The name of the page "back" returns to. */
export function backLabel(back: string | null): string {
  if (back?.startsWith("/service/revenue")) return "Revenue";
  if (back?.startsWith("/service/performance")) return "Team performance";
  if (back?.startsWith("/service/analytics")) return "Analytics";
  return "Projects";
}
