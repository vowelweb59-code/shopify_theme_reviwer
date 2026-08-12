import type { ParsedFile } from "@/lib/theme-parser";

// Distinguishes "no issue found" from "could not reliably analyze" — phase-4
// §17. These are not findings; they describe the audit's own coverage/limits
// so a clean report can be trusted as actually clean rather than just quiet.
export type AuditDiagnostics = {
  parserWarnings: number; // ParsedFile.parseErrors across every parsed file
  // {% render %}/{% include %}/{% section %} targets that couldn't be
  // statically resolved (a variable, not a literal) — reference-integrity
  // rules correctly skip these rather than guessing, so they're surfaced
  // here instead of silently vanishing.
  unresolvedDynamicReferences: number;
  filesSkipped: number; // unsupported file types encountered in the theme ZIP
  rulesSkippedDueToError: number; // a rule threw and was excluded from this run
};

export function computeAuditDiagnostics(
  files: ParsedFile[],
  opts: { filesSkipped: number; rulesSkippedDueToError: number }
): AuditDiagnostics {
  let parserWarnings = 0;
  let unresolvedDynamicReferences = 0;
  for (const f of files) {
    parserWarnings += f.parseErrors.length;
    for (const ref of f.sectionReferences) {
      if (ref.dynamic) unresolvedDynamicReferences++;
    }
  }
  return {
    parserWarnings,
    unresolvedDynamicReferences,
    filesSkipped: opts.filesSkipped,
    rulesSkippedDueToError: opts.rulesSkippedDueToError,
  };
}
