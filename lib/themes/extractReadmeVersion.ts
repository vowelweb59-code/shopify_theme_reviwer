import fs from "node:fs";
import path from "node:path";
import { extractThemeZip } from "@/lib/theme-parser/zip";
import { resolveThemeRoot, InvalidThemeError } from "@/lib/theme-parser/validateThemeStructure";
import { ThemeZipError } from "@/lib/theme-parser/zip";

export type ReadmeVersionResult =
  | { ok: true; version: string; readmeFilename: string }
  | { ok: false; reason: "readme_not_found" }
  | { ok: false; reason: "version_not_found"; readmeFilename: string }
  | { ok: false; reason: "invalid_theme_structure"; message: string }
  | { ok: false; reason: "invalid_zip"; message: string };

const README_NAME_RE = /^readme(\.(md|txt))?$/i;

// The README is the source of truth for a theme's version (never invented,
// never asked for manually) — but it isn't a Liquid/JSON/CSS/JS file and
// doesn't live under assets/, so lib/theme-parser/walkFiles.ts's
// walkThemeFiles() silently skips it entirely. This reads it directly
// instead of touching that parser.
export function findReadmeFile(themeRootDir: string): { filename: string; content: string } | null {
  const entries = fs.readdirSync(themeRootDir, { withFileTypes: true }).filter((e) => e.isFile());
  const match = entries.find((e) => README_NAME_RE.test(e.name));
  if (!match) return null;
  const content = fs.readFileSync(path.join(themeRootDir, match.name), "utf-8");
  return { filename: match.name, content };
}

// Matches the exact convention the user's own themes use: a line reading
// "Version: 2.4.1" (case-insensitive label, optional leading "v", dotted
// numeric segments, optional pre-release/build suffix). The first match
// wins — a changelog-style README lists the current release first. Only
// this one, explicit convention is matched on purpose: anything looser
// risks silently picking up an unrelated number elsewhere in the file.
const VERSION_LINE_RE = /^[ \t]*version[ \t]*:[ \t]*v?(\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?)[ \t]*$/im;

export function extractVersionFromReadmeText(text: string): { version: string } | null {
  const match = VERSION_LINE_RE.exec(text);
  if (!match) return null;
  return { version: match[1] };
}

/**
 * Full pipeline: theme ZIP buffer -> version string, or a specific reason it
 * couldn't be determined. Reuses the existing, already-hardened extraction
 * (path-traversal-safe, size/count-limited) and theme-root-resolution code
 * directly rather than re-implementing zip/path handling — the same
 * functions lib/theme-parser/index.ts's parseThemeZip() calls internally,
 * just not re-exported through its barrel. Never invents a version: a
 * missing README or missing version line comes back as a specific,
 * non-"ok" result instead of a guess.
 */
export async function extractThemeVersionFromZip(buffer: Buffer): Promise<ReadmeVersionResult> {
  let extracted: Awaited<ReturnType<typeof extractThemeZip>>;
  try {
    extracted = await extractThemeZip(buffer);
  } catch (err) {
    if (err instanceof ThemeZipError) return { ok: false, reason: "invalid_zip", message: err.message };
    throw err;
  }

  try {
    const root = resolveThemeRoot(extracted.dir);
    const readme = findReadmeFile(root);
    if (!readme) return { ok: false, reason: "readme_not_found" };
    const versionMatch = extractVersionFromReadmeText(readme.content);
    if (!versionMatch) return { ok: false, reason: "version_not_found", readmeFilename: readme.filename };
    return { ok: true, version: versionMatch.version, readmeFilename: readme.filename };
  } catch (err) {
    if (err instanceof InvalidThemeError) return { ok: false, reason: "invalid_theme_structure", message: err.message };
    throw err;
  } finally {
    await extracted.cleanup();
  }
}
