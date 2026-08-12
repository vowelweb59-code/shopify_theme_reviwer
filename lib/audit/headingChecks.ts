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
