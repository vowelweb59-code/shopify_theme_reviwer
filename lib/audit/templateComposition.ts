import type { ParsedFile } from "@/lib/theme-parser";
import type { ThemeIndex } from "./themeIndex";

export type ComposedTemplate = {
  templateFile: ParsedFile;
  // template file + its resolved sections (in the template's own render
  // order) + any snippets those sections render, recursively. Deduped.
  files: ParsedFile[];
};

function orderedSectionTypes(templateFile: ParsedFile): string[] {
  const json = templateFile.jsonInfo?.json;
  if (!json || typeof json !== "object") return [];
  const sections = (json as Record<string, unknown>).sections;
  if (!sections || typeof sections !== "object") return [];

  const orderRaw = (json as Record<string, unknown>).order;
  const order = Array.isArray(orderRaw)
    ? orderRaw.filter((k): k is string => typeof k === "string")
    : Object.keys(sections as Record<string, unknown>);

  const types: string[] = [];
  for (const key of order) {
    const entry = (sections as Record<string, unknown>)[key];
    const type = entry && typeof entry === "object" ? (entry as Record<string, unknown>).type : undefined;
    if (typeof type === "string") types.push(type);
  }
  return types;
}

function collectRenderedSnippets(file: ParsedFile, index: ThemeIndex, out: ParsedFile[], seen: Set<string>, depth: number) {
  if (depth <= 0) return;
  for (const ref of file.sectionReferences) {
    if (ref.kind !== "snippet" || ref.dynamic) continue;
    const snippet = index.snippetsByName.get(ref.name);
    if (!snippet || seen.has(snippet.path)) continue;
    seen.add(snippet.path);
    out.push(snippet);
    collectRenderedSnippets(snippet, index, out, seen, depth - 1);
  }
}

// Every template renders through a layout (Shopify wraps the template's
// own output in {{ content_for_layout }}) — defaulting to layout/theme.
// liquid unless the template JSON sets "layout" to a custom name or false.
// Found auditing Shopify's own Skeleton theme: its shared meta-tags
// snippet (containing {{ product | structured_data }}) is rendered from
// the layout, not from any section — composeTemplate previously never
// looked at the layout at all, so that Product JSON-LD was false-flagged
// as "unreachable" from templates/product.json even though it renders on
// every single page.
function resolveLayoutFile(templateFile: ParsedFile, index: ThemeIndex): ParsedFile | undefined {
  const json = templateFile.jsonInfo?.json;
  const layoutValue = json && typeof json === "object" ? (json as Record<string, unknown>).layout : undefined;
  if (layoutValue === false) return undefined;
  const layoutName = typeof layoutValue === "string" ? layoutValue : "theme";
  return index.filesByPath.get(`layout/${layoutName}.liquid`);
}

/**
 * The template itself, its directly-referenced sections (in the template's
 * own "order"), and any snippets those sections render (recursively,
 * depth-limited to guard against cycles). This never executes Liquid — a
 * section behind a runtime {% if %} is still included, since over-including
 * is the safer failure mode than silently dropping content that's usually
 * rendered (phase-4 §16).
 */
export function composeTemplateMainContent(templateFile: ParsedFile, index: ThemeIndex): ComposedTemplate {
  const files: ParsedFile[] = [templateFile];
  const seen = new Set<string>([templateFile.path]);

  for (const type of orderedSectionTypes(templateFile)) {
    const section = index.sectionsByName.get(type);
    if (!section || seen.has(section.path)) continue;
    seen.add(section.path);
    files.push(section);
    collectRenderedSnippets(section, index, files, seen, 3);
  }

  return { templateFile, files };
}

/**
 * composeTemplateMainContent() plus the layout the template renders through
 * (defaulting to layout/theme.liquid unless the template JSON sets "layout"
 * to a custom name or false) and anything the layout itself renders.
 *
 * Deliberately a separate, wider function rather than folded into
 * composeTemplateMainContent(): "does this JSON-LD/schema render anywhere
 * on this page" correctly wants the full render tree including the layout,
 * but "is the page's heading order correct" wants only the main visible
 * content. Found auditing Shopify's own Dawn theme: layout/theme.liquid
 * renders a cart-drawer snippet containing off-canvas <h2> elements that
 * aren't part of the page's actual reading-order hierarchy — including
 * them in heading-sequence checks masked a genuine h1->h3 skip inside a
 * template's real content. Use this one only for checks that genuinely
 * need "anything that renders on this page," like JSON-LD reachability;
 * use composeTemplateMainContent() for anything about content structure/
 * reading order. Section GROUPS rendered from the layout (e.g.
 * {% sections 'header-group' %}) are not resolved here — a known
 * limitation, not attempted yet.
 */
export function composeTemplate(templateFile: ParsedFile, index: ThemeIndex): ComposedTemplate {
  const { files } = composeTemplateMainContent(templateFile, index);
  const seen = new Set(files.map((f) => f.path));

  const layout = resolveLayoutFile(templateFile, index);
  if (layout && !seen.has(layout.path)) {
    seen.add(layout.path);
    files.push(layout);
    collectRenderedSnippets(layout, index, files, seen, 3);
  }

  return { templateFile, files };
}

/** "templates/product.featured.json" -> "product"; "templates/index.json" -> "index". */
export function templateBaseName(path: string): string {
  const withoutDir = path.slice("templates/".length);
  const withoutExt = withoutDir.replace(/\.json$/i, "");
  return withoutExt.split(".")[0];
}
