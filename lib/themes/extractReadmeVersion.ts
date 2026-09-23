import fs from "node:fs";
import path from "node:path";
import { extractThemeZip } from "@/lib/theme-parser/zip";
import { resolveThemeRoot, InvalidThemeError } from "@/lib/theme-parser/validateThemeStructure";
import { ThemeZipError } from "@/lib/theme-parser/zip";

export type ThemeVersionResult =
  | { ok: true; version: string; source: "settings_schema"; filename: string }
  | { ok: true; version: string; source: "readme"; filename: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_theme_structure"; message: string }
  | { ok: false; reason: "invalid_zip"; message: string };

const README_NAME_RE = /^readme(\.(md|txt))?$/i;

// README-based version detection (a fallback for themes that don't
// populate config/settings_schema.json's theme_version — see below) is
// never invented, never asked for manually. A README isn't a Liquid/JSON/
// CSS/JS file and doesn't live under assets/, so lib/theme-parser/
// walkFiles.ts's walkThemeFiles() silently skips it entirely. This reads
// it directly instead of touching that parser.
export function findReadmeFile(themeRootDir: string): { filename: string; content: string } | null {
  const entries = fs.readdirSync(themeRootDir, { withFileTypes: true }).filter((e) => e.isFile());
  const match = entries.find((e) => README_NAME_RE.test(e.name));
  if (!match) return null;
  const content = fs.readFileSync(path.join(themeRootDir, match.name), "utf-8");
  return { filename: match.name, content };
}

// Shared value shape for both sources below: optional leading "v", dotted
// numeric segments, optional pre-release/build suffix.
const VERSION_VALUE_PATTERN = "v?(\\d+(?:\\.\\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?)";
const VERSION_VALUE_RE = new RegExp(`^${VERSION_VALUE_PATTERN}$`);

// Matches the exact convention the user's own themes use: a line reading
// "Version: 2.4.1". The first match wins — a changelog-style README lists
// the current release first. Only this one, explicit convention is matched
// on purpose: anything looser risks silently picking up an unrelated number
// elsewhere in the file.
const VERSION_LINE_RE = new RegExp(`^[ \\t]*version[ \\t]*:[ \\t]*${VERSION_VALUE_PATTERN}[ \\t]*$`, "im");

export function extractVersionFromReadmeText(text: string): { version: string } | null {
  const match = VERSION_LINE_RE.exec(text);
  if (!match) return null;
  return { version: match[1] };
}

const SETTINGS_SCHEMA_RELATIVE_PATH = path.join("config", "settings_schema.json");

// Real-world theme editors (and hand-edited settings_schema.json files)
// commonly leave a whole `//`-commented-out block in as disabled
// documentation (confirmed against a real Gravity theme ZIP: an entire
// disabled "Gift wrapping" settings section, one `//` per line) — invalid
// strict JSON, but tolerated by Shopify's own admin. Tracks string-literal
// state (respecting \" escapes) so a `//` that happens to appear inside a
// string value — e.g. a "https://..." URL in theme_documentation_url,
// which this same real file also has — is never touched. Doesn't handle
// `/* */` block comments: not seen in a real file yet, so not guessed at.
// Run before stripTrailingCommas below (not combined into one pass): a
// trailing comma followed by a now-removed comment, then the closing
// bracket, still needs to read as "trailing" once the comment is gone.
function stripLineComments(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      result += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      i--; // back up so the loop's i++ lands back on the newline itself, which then falls through and is kept
      continue;
    }
    result += ch;
  }
  return result;
}

// Real-world theme editors (and hand-edited settings_schema.json files) commonly
// leave a trailing comma before a closing `}`/`]` — invalid strict JSON, but
// tolerated by Shopify's own admin. Strips only commas that precede a closing
// bracket, and tracks string-literal state (respecting \" escapes) so a comma
// that happens to appear inside a string value is never touched.
function stripTrailingCommas(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      result += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "}" || text[j] === "]") continue; // drop this trailing comma
    }
    result += ch;
  }
  return result;
}

// The actual Shopify platform convention: every theme built with the
// Shopify CLI (and every theme submitted to the Theme Store) declares its
// version in config/settings_schema.json's first "theme_info" entry's
// `theme_version` field — not in a README. Checked before the README
// convention below, which exists only as a fallback for themes that don't
// populate this field.
export function extractVersionFromSettingsSchema(themeRootDir: string): { version: string } | null {
  const filePath = path.join(themeRootDir, SETTINGS_SCHEMA_RELATIVE_PATH);
  if (!fs.existsSync(filePath)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripTrailingCommas(stripLineComments(fs.readFileSync(filePath, "utf-8"))));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const themeInfo = parsed.find(
    (entry): entry is { theme_version?: unknown } =>
      typeof entry === "object" && entry !== null && (entry as { name?: unknown }).name === "theme_info"
  );
  if (!themeInfo || typeof themeInfo.theme_version !== "string") return null;

  const match = VERSION_VALUE_RE.exec(themeInfo.theme_version.trim());
  return match ? { version: match[1] } : null;
}

/**
 * Full pipeline: theme ZIP buffer -> version string, or a specific reason it
 * couldn't be determined. Reuses the existing, already-hardened extraction
 * (path-traversal-safe, size/count-limited) and theme-root-resolution code
 * directly rather than re-implementing zip/path handling — the same
 * functions lib/theme-parser/index.ts's parseThemeZip() calls internally,
 * just not re-exported through its barrel. Tries config/settings_schema.json
 * (the real Shopify convention) first, then falls back to a README's
 * "Version: x.y.z" line. Never invents a version: neither source found
 * comes back as a specific, non-"ok" result instead of a guess.
 */
export async function extractThemeVersionFromZip(buffer: Buffer): Promise<ThemeVersionResult> {
  let extracted: Awaited<ReturnType<typeof extractThemeZip>>;
  try {
    extracted = await extractThemeZip(buffer);
  } catch (err) {
    if (err instanceof ThemeZipError) return { ok: false, reason: "invalid_zip", message: err.message };
    throw err;
  }

  try {
    const root = resolveThemeRoot(extracted.dir);

    const fromSettingsSchema = extractVersionFromSettingsSchema(root);
    if (fromSettingsSchema) {
      return { ok: true, version: fromSettingsSchema.version, source: "settings_schema", filename: "config/settings_schema.json" };
    }

    const readme = findReadmeFile(root);
    if (readme) {
      const versionMatch = extractVersionFromReadmeText(readme.content);
      if (versionMatch) return { ok: true, version: versionMatch.version, source: "readme", filename: readme.filename };
    }

    return { ok: false, reason: "not_found" };
  } catch (err) {
    if (err instanceof InvalidThemeError) return { ok: false, reason: "invalid_theme_structure", message: err.message };
    throw err;
  } finally {
    await extracted.cleanup();
  }
}
