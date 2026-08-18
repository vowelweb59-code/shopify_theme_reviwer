import { parseChecklistRow } from "./sheetRows";

/**
 * Carries forward rows from the sheet's own previous export that this
 * round's one-hop diff (baseline = immediately preceding complete run) no
 * longer sees. A finding can only be absent from both sides of that diff
 * if it was already resolved as of a prior export — anything still open
 * must reappear as still_present/changed/new/resolved by construction —
 * so only previously-resolved, untouched rows are ever carried forward.
 * Without this, a finding fixed several audits ago would silently vanish
 * from the sheet the next time something unrelated changed, contradicting
 * the whole point of a persistent checklist. Operates purely on row
 * arrays (via parseChecklistRow) rather than DiffFinding objects so it
 * needs no knowledge of how a row was produced — the sheet's own existing
 * rows are trusted as-is.
 */
export function mergeChecklistRows(existingRows: string[][], freshRows: string[][], category: string): string[][] {
  const freshSignatures = new Set(freshRows.map((row) => parseChecklistRow(row, category).signature));
  const carriedForward = existingRows.filter((row) => {
    const parsed = parseChecklistRow(row, category);
    return parsed.isResolved && !freshSignatures.has(parsed.signature);
  });
  return [...freshRows, ...carriedForward];
}
