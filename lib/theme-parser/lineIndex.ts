// Converts a character offset into a 1-based line number. Used to translate
// htmlparser2's/regex's character-offset positions into the line numbers
// the ParsedFile shape reports.
export function buildLineIndex(text: string): (offset: number) => number {
  const newlineOffsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) newlineOffsets.push(i);
  }

  return (offset: number): number => {
    // Binary search for the number of newlines before `offset`.
    let lo = 0;
    let hi = newlineOffsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (newlineOffsets[mid] < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
}
