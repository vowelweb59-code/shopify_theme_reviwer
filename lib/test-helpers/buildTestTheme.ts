import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseThemeDirectory, type ThemeParseResult } from "@/lib/theme-parser";
import { buildThemeIndex, type ThemeIndex } from "@/lib/audit/themeIndex";

/**
 * Writes a small theme (given as { relativePath: content }) to a temp
 * directory and runs it through the real parser + index pipeline — the
 * same path a real theme ZIP takes, just skipping the ZIP layer. Callers
 * are responsible for cleanup() once done.
 */
export function buildTestTheme(files: Record<string, string>): {
  root: string;
  parsed: ThemeParseResult;
  index: ThemeIndex;
  cleanup: () => void;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "theme-auditor-test-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf-8");
  }

  const parsed = parseThemeDirectory(root);
  const index = buildThemeIndex(parsed.files);

  return {
    root,
    parsed,
    index,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
