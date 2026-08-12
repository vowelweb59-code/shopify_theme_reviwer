import fs from "node:fs";
import path from "node:path";

export class InvalidThemeError extends Error {}

const THEME_DIRECTORIES = ["assets", "config", "layout", "locales", "sections", "snippets", "templates"] as const;

// A real theme package rarely has all seven, but should have several.
// One is not enough to distinguish a theme from an arbitrary code ZIP.
const MIN_RECOGNIZED_DIRECTORIES = 2;

function countThemeDirectories(root: string): number {
  let count = 0;
  for (const dir of THEME_DIRECTORIES) {
    if (fs.existsSync(path.join(root, dir)) && fs.statSync(path.join(root, dir)).isDirectory()) {
      count++;
    }
  }
  return count;
}

/**
 * Confirms the extracted archive looks like a Shopify theme, returning the
 * resolved theme root. GitHub-style archive downloads nest everything under
 * a single `<repo>-<branch>/` folder — that layer is transparently unwrapped
 * so `shopify theme pull` exports and GitHub zips both work.
 */
export function resolveThemeRoot(extractedDir: string): string {
  if (countThemeDirectories(extractedDir) >= MIN_RECOGNIZED_DIRECTORIES) {
    return extractedDir;
  }

  const entries = fs.readdirSync(extractedDir, { withFileTypes: true });
  const topLevelDirs = entries.filter((e) => e.isDirectory());
  if (topLevelDirs.length === 1 && entries.length === 1) {
    const nested = path.join(extractedDir, topLevelDirs[0].name);
    if (countThemeDirectories(nested) >= MIN_RECOGNIZED_DIRECTORIES) {
      return nested;
    }
  }

  throw new InvalidThemeError(
    `This doesn't look like a Shopify theme package — expected at least ${MIN_RECOGNIZED_DIRECTORIES} of: ${THEME_DIRECTORIES.join(", ")}.`
  );
}
