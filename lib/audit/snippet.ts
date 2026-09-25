// Minified assets put a whole file on one line (one fancybox.css line was
// 25 KB, stored once per finding). Past this, a line is unreadable in the
// code-context panel anyway, so it's cut rather than stored in full.
export const SNIPPET_MAX_LINE_CHARS = 240;

const CAPPED_MARKER = /… \(\+\d+ chars\)$/;

export function capSnippetLine(line: string): string {
  if (line.length <= SNIPPET_MAX_LINE_CHARS) return line;
  // Already capped (its marker pushes it just past the limit): leave it, so
  // re-running the compaction script is a no-op.
  if (CAPPED_MARKER.test(line) && line.replace(CAPPED_MARKER, "").length <= SNIPPET_MAX_LINE_CHARS) return line;
  return `${line.slice(0, SNIPPET_MAX_LINE_CHARS)}… (+${line.length - SNIPPET_MAX_LINE_CHARS} chars)`;
}

/** Caps every line of an already-built snippet (used to compact stored findings). */
export function capSnippet(snippet: string): string {
  return snippet.split("\n").map(capSnippetLine).join("\n");
}
