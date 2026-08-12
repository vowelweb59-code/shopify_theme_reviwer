import { buildLineIndex } from "./lineIndex";
import type { ParsedJsImport } from "./types";

// Static `import`/`require` extraction — a regex scan, not a real JS
// parser, matching this project's general approach elsewhere (e.g. Liquid
// tag extraction). Good enough to catch broken relative import paths
// without needing a JS toolchain dependency.
const STATIC_IMPORT_RE = /\bimport\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

export function extractJsImports(rawText: string): ParsedJsImport[] {
  const toLine = buildLineIndex(rawText);
  const imports: ParsedJsImport[] = [];
  for (const re of [STATIC_IMPORT_RE, DYNAMIC_IMPORT_RE, REQUIRE_RE]) {
    for (const match of rawText.matchAll(re)) {
      imports.push({ line: toLine(match.index ?? 0), specifier: match[1] });
    }
  }
  return imports;
}
