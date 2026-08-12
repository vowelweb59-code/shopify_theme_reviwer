import type { ParsedFile } from "@/lib/theme-parser";

// Shared between the Accessibility and Technical SEO rule sets — both care
// about the same underlying structural fact for their own reasons, so both
// get a finding rather than picking one category to "own" it.
export type HeadingIssue = { line: number; message: string };

export function findSkippedHeadingLevels(file: ParsedFile): HeadingIssue[] {
  const issues: HeadingIssue[] = [];
  let maxSeen = 0;
  for (const h of file.headings) {
    if (maxSeen > 0 && h.level > maxSeen + 1) {
      issues.push({ line: h.line, message: `Heading level jumps from h${maxSeen} to h${h.level}, skipping an intermediate level.` });
    }
    maxSeen = Math.max(maxSeen, h.level);
  }
  return issues;
}

export function findMultipleH1(file: ParsedFile): HeadingIssue[] {
  const h1s = file.headings.filter((h) => h.level === 1);
  if (h1s.length <= 1) return [];
  return h1s.slice(1).map((h) => ({ line: h.line, message: `Multiple <h1> elements in this file (first at line ${h1s[0].line}).` }));
}

// --- Composed-template variants (Phase 4) -----------------------------
// Same underlying checks, but across a template's statically-composed set
// of files (lib/audit/templateComposition.ts) rather than one file — a
// duplicate H1 or a skipped heading level routinely spans a template and
// the sections it renders, which the single-file functions above can't see.

export type ComposedHeading = { filePath: string; heading: ParsedFile["headings"][number] };
export type ComposedHeadingIssue = HeadingIssue & { filePath: string };

export function findSkippedHeadingLevelsAcross(entries: ComposedHeading[]): ComposedHeadingIssue[] {
  const issues: ComposedHeadingIssue[] = [];
  let maxSeen = 0;
  let maxSeenFile = "";
  for (const { filePath, heading } of entries) {
    // Only flag when the skip crosses a file boundary — a skip fully
    // contained within one file is already findSkippedHeadingLevels's job.
    if (maxSeen > 0 && heading.level > maxSeen + 1 && filePath !== maxSeenFile) {
      issues.push({
        filePath,
        line: heading.line,
        message: `Composed template: heading level jumps from h${maxSeen} (in ${maxSeenFile}) to h${heading.level}, skipping an intermediate level.`,
      });
    }
    if (heading.level > maxSeen) {
      maxSeen = heading.level;
      maxSeenFile = filePath;
    }
  }
  return issues;
}

export function findMultipleH1Across(entries: ComposedHeading[]): ComposedHeadingIssue[] {
  const h1s = entries.filter((e) => e.heading.level === 1);
  const distinctFiles = new Set(h1s.map((e) => e.filePath));
  // All H1s in one file is findMultipleH1's job, not this one's.
  if (h1s.length <= 1 || distinctFiles.size <= 1) return [];
  return h1s.slice(1).map((e) => ({
    filePath: e.filePath,
    line: e.heading.line,
    message: `Composed template has multiple <h1> elements across different files (first in ${h1s[0].filePath}:${h1s[0].heading.line}).`,
  }));
}
