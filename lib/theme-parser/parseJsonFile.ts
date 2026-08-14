import { buildLineIndex } from "./lineIndex";
import { findDuplicateJsonKeys } from "./duplicateJsonKeys";
import type { ParsedJsonFileInfo, ParsedSectionReference } from "./types";

function isTemplateJsonPath(path: string): boolean {
  return path.startsWith("templates/") || path.includes("/listings/");
}
// Section GROUP files (sections/header-group.json, rendered by {% sections %}
// rather than {% section %}) have the identical { sections: {...}, order }
// shape as a template — same extraction applies.
function isSectionGroupPath(path: string): boolean {
  return path.startsWith("sections/") && path.endsWith(".json");
}
function isSettingsSchemaPath(path: string): boolean {
  return path.endsWith("config/settings_schema.json");
}
function isLocaleFilePath(path: string): boolean {
  return path.startsWith("locales/");
}

// Shopify's own tooling (the admin theme editor, `shopify theme pull`)
// writes an auto-generated block comment — sometimes several, and
// sometimes a line comment — at the very top of JSON files it manages
// (templates, settings_data.json). Strict JSON has no comment syntax, so
// JSON.parse rejects the entire file outright. Found auditing Shopify's
// own Skeleton theme, where this silently broke section-reference/setting
// extraction for the large majority of its JSON files (14 of 17) — not an
// edge case, but the normal shape of any theme that's been through
// Shopify's own tooling. Only strips from the absolute start of the file
// (never mid-content), so it can't misfire on a string value that happens
// to contain a comment-like substring.
function stripLeadingComments(text: string): string {
  let result = text;
  for (;;) {
    const trimmed = result.trimStart();
    if (trimmed.startsWith("/*")) {
      const end = trimmed.indexOf("*/");
      if (end === -1) return result;
      result = trimmed.slice(end + 2);
    } else if (trimmed.startsWith("//")) {
      const nl = trimmed.indexOf("\n");
      result = nl === -1 ? "" : trimmed.slice(nl + 1);
    } else {
      return trimmed;
    }
  }
}

/** Best-effort line lookup: JSON.parse discards source positions, so this searches the raw text for a distinguishing substring. Falls back to line 1 (not a crash) when the text can't be found — e.g. a value that happens to appear more than once. */
function findLine(rawText: string, toLine: (offset: number) => number, ...needles: string[]): number {
  for (const needle of needles) {
    const idx = rawText.indexOf(needle);
    if (idx !== -1) return toLine(idx);
  }
  return 1;
}

function extractTemplateSectionReferences(
  json: Record<string, unknown>,
  rawText: string,
  toLine: (offset: number) => number
): ParsedSectionReference[] {
  const sections = json.sections;
  if (!sections || typeof sections !== "object") return [];

  const refs: ParsedSectionReference[] = [];
  for (const [sectionKey, value] of Object.entries(sections as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const type = (value as Record<string, unknown>).type;
    if (typeof type !== "string") continue;
    const line = findLine(rawText, toLine, `"${sectionKey}"`, `"type": "${type}"`, `"type":"${type}"`);
    refs.push({ line, kind: "section", name: type, dynamic: false });
  }
  return refs;
}

function extractSettingKeys(json: unknown): string[] {
  const groups = Array.isArray(json) ? json : [];
  const keys: string[] = [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const settings = (group as Record<string, unknown>).settings;
    if (!Array.isArray(settings)) continue;
    for (const setting of settings) {
      const id = setting && typeof setting === "object" ? (setting as Record<string, unknown>).id : undefined;
      if (typeof id === "string") keys.push(id);
    }
  }
  return keys;
}

function flattenLocaleKeys(json: unknown, prefix: string, out: string[]): void {
  if (!json || typeof json !== "object" || Array.isArray(json)) return;
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenLocaleKeys(value, path, out);
    } else {
      out.push(path);
    }
  }
}

export function parseJsonFile(path: string, rawText: string): ParsedJsonFileInfo {
  const toLine = buildLineIndex(rawText);

  let json: unknown = null;
  let parseError: string | null = null;
  try {
    json = JSON.parse(stripLeadingComments(rawText));
  } catch (err) {
    parseError = err instanceof Error ? err.message : "Invalid JSON";
  }

  const info: ParsedJsonFileInfo = {
    json,
    parseError,
    sectionReferences: [],
    settingKeys: [],
    localeKeys: [],
    duplicateLocaleKeys: [],
  };

  if (!json || typeof json !== "object" || parseError) return info;

  if (isTemplateJsonPath(path) || isSectionGroupPath(path)) {
    info.sectionReferences = extractTemplateSectionReferences(json as Record<string, unknown>, rawText, toLine);
  }
  if (isSettingsSchemaPath(path)) {
    info.settingKeys = extractSettingKeys(json);
  }
  if (isLocaleFilePath(path)) {
    const keys: string[] = [];
    flattenLocaleKeys(json, "", keys);
    info.localeKeys = keys;
    // JSON.parse silently collapses duplicate keys (last write wins) before
    // there's a parsed value left to inspect, so detecting them requires
    // scanning the raw text instead of the already-deduplicated `json`.
    info.duplicateLocaleKeys = findDuplicateJsonKeys(rawText).map((d) => ({ key: d.path, line: d.line }));
  }

  return info;
}
