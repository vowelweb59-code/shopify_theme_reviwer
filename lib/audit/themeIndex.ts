import type { ParsedFile } from "@/lib/theme-parser";

// Theme-wide facts that no single-file rule can answer alone — built once
// per audit run (see runRules.ts) and reused by every rule via
// RuleContext.index, per phase-4's "parse once, index once" requirement.
export type ThemeIndex = {
  filesByPath: Map<string, ParsedFile>;
  sectionsByName: Map<string, ParsedFile>; // sections/<name>.liquid
  sectionGroupsByName: Map<string, ParsedFile>; // sections/<name>.json (rendered by {% sections %}, not {% section %})
  snippetsByName: Map<string, ParsedFile>; // snippets/<name>.liquid
  assetBasenames: Set<string>; // filenames present under assets/ (Shopify's assets/ is always flat)
  // Raw JSON trees for the storefront's default locale file(s) — usually a
  // single locales/xx.default.json. Used for translation-key existence
  // checks: a key "resolves" if the path exists in the tree at all, whether
  // it's a leaf string or a group object (Shopify pluralization keys like
  // `cart.item_count.one` / `.other` are groups, not leaves).
  defaultLocaleTrees: unknown[];
};

function basenameNoExt(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot === -1 ? base : base.slice(0, dot);
}

const EXTERNAL_REF_RE = /^(https?:)?\/\//i;

/** True for absolute/protocol-relative URLs — never "missing local assets" even when quoted with a recognized file extension. */
export function isExternalReference(reference: string): boolean {
  return EXTERNAL_REF_RE.test(reference) || reference.includes("://");
}

export function buildThemeIndex(files: ParsedFile[]): ThemeIndex {
  const filesByPath = new Map(files.map((f) => [f.path, f]));
  const sectionsByName = new Map<string, ParsedFile>();
  const sectionGroupsByName = new Map<string, ParsedFile>();
  const snippetsByName = new Map<string, ParsedFile>();
  const assetBasenames = new Set<string>();
  const defaultLocaleTrees: unknown[] = [];

  for (const f of files) {
    if (f.path.startsWith("sections/") && f.fileType === "liquid") {
      sectionsByName.set(basenameNoExt(f.path), f);
    } else if (f.path.startsWith("sections/") && f.fileType === "json") {
      sectionGroupsByName.set(basenameNoExt(f.path), f);
    } else if (f.path.startsWith("snippets/") && f.fileType === "liquid") {
      snippetsByName.set(basenameNoExt(f.path), f);
    } else if (f.path.startsWith("assets/")) {
      assetBasenames.add(f.path.slice("assets/".length));
    } else if (f.path.startsWith("locales/") && /\.default\.json$/i.test(f.path) && f.jsonInfo?.json) {
      defaultLocaleTrees.push(f.jsonInfo.json);
    }
  }

  return { filesByPath, sectionsByName, sectionGroupsByName, snippetsByName, assetBasenames, defaultLocaleTrees };
}

function getPath(obj: unknown, parts: string[]): unknown {
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** A translation key "exists" if the dotted path resolves to anything (string leaf or a pluralization group) in any default-locale tree. */
export function localeKeyExists(index: ThemeIndex, key: string): boolean {
  const parts = key.split(".");
  return index.defaultLocaleTrees.some((tree) => getPath(tree, parts) !== undefined);
}
