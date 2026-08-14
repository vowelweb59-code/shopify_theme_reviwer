import { Parser } from "htmlparser2";
import { buildLineIndex } from "./lineIndex";
import { extractLiteralJsonLdTypes, tryParseLiquidJson } from "./liquidJson";
import {
  emptyMetaTags,
  type ParsedAriaReference,
  type ParsedButton,
  type ParsedElementId,
  type ParsedForm,
  type ParsedHeading,
  type ParsedIconElement,
  type ParsedImage,
  type ParsedInput,
  type ParsedInteractiveElement,
  type ParsedJsonLdBlock,
  type ParsedLabel,
  type ParsedLink,
  type ParsedMetaTags,
  type ParsedParseError,
  type ParsedScript,
  type ParsedStylesheet,
  type ParsedSvgElement,
} from "./types";

export type HtmlStructure = {
  images: ParsedImage[];
  svgElements: ParsedSvgElement[];
  iconElements: ParsedIconElement[];
  headings: ParsedHeading[];
  links: ParsedLink[];
  buttons: ParsedButton[];
  forms: ParsedForm[];
  inputs: ParsedInput[];
  labels: ParsedLabel[];
  interactiveElements: ParsedInteractiveElement[];
  elementIds: ParsedElementId[];
  ariaReferences: ParsedAriaReference[];
  scripts: ParsedScript[];
  stylesheets: ParsedStylesheet[];
  metaTags: ParsedMetaTags;
  jsonLdBlocks: ParsedJsonLdBlock[];
  parseErrors: ParsedParseError[];
};

const ARIA_REFERENCE_ATTRS = ["aria-labelledby", "aria-describedby"] as const;

// Tags whose inner text we accumulate for a meaningful accessible-name-ish
// value (link/button/label text, heading text, <title>).
const TEXT_CAPTURE_TAGS = new Set(["a", "button", "label", "title", "h1", "h2", "h3", "h4", "h5", "h6"]);
// Tags already covered by their own dedicated array — excluded from the
// generic "interactive element" catch-all to avoid redundant noise.
const DEDICATED_INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "textarea", "label"]);
const INTERACTIVE_ROLES = /^(button|link|menuitem|tab|switch|checkbox|radio)$/;

type StackFrame = {
  name: string;
  attribs: Record<string, string>;
  startOffset: number;
  text: string[];
};

function isLiquidExpression(value: string | undefined): boolean {
  return !!value && (value.includes("{{") || value.includes("{%"));
}

// Real theme markup routinely wraps text nodes in Liquid logic (conditionals
// picking between a logo image and a shop-name fallback, translation
// filters, etc). Captured element text should read as the literal parts a
// person could actually see, not the raw Liquid source — so tags/output are
// stripped rather than included verbatim.
function stripLiquidSyntax(text: string): string {
  return text.replace(/\{\{-?[\s\S]*?-?\}\}/g, " ").replace(/\{%-?[\s\S]*?-?%\}/g, " ");
}

export function extractHtmlStructure(rawText: string): HtmlStructure {
  const toLine = buildLineIndex(rawText);

  const images: ParsedImage[] = [];
  const svgElements: ParsedSvgElement[] = [];
  const iconElements: ParsedIconElement[] = [];
  const headings: ParsedHeading[] = [];
  const links: ParsedLink[] = [];
  const buttons: ParsedButton[] = [];
  const forms: ParsedForm[] = [];
  const inputs: ParsedInput[] = [];
  const labels: ParsedLabel[] = [];
  const interactiveElements: ParsedInteractiveElement[] = [];
  const elementIds: ParsedElementId[] = [];
  const ariaReferences: ParsedAriaReference[] = [];
  const scripts: ParsedScript[] = [];
  const stylesheets: ParsedStylesheet[] = [];
  const jsonLdBlocks: ParsedJsonLdBlock[] = [];
  const metaTags = emptyMetaTags();
  const parseErrors: ParsedParseError[] = [];

  const stack: StackFrame[] = [];
  // Set when a <title> closes with an <svg> as its immediate parent, read
  // when that same <svg> closes right after, then reset.
  let svgHadTitle = false;

  function ancestorNames(): string[] {
    return stack.map((f) => f.name);
  }

  function handleImageLikeOpen(tag: "img" | "source", attribs: Record<string, string>, offset: number) {
    const alt = attribs.alt;
    const altSource: ParsedImage["altSource"] =
      alt === undefined ? "missing" : alt === "" ? "empty" : isLiquidExpression(alt) ? "liquid" : "literal";
    const src = attribs.src ?? attribs.srcset;
    images.push({
      line: toLine(offset),
      tag,
      alt: alt ?? null,
      altSource,
      hasWidth: "width" in attribs,
      hasHeight: "height" in attribs,
      loading: attribs.loading ?? null,
      src,
      sourceExpression: isLiquidExpression(src) ? src : undefined,
      lazyLoadPattern: attribs.loading === "lazy" ? "loading=lazy" : attribs["data-src"] ? "data-src" : undefined,
      isLikelyDecorative: altSource === "empty" || attribs["aria-hidden"] === "true" || attribs.role === "presentation",
    });
  }

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const offset = parser.startIndex;
        stack.push({ name, attribs, startOffset: offset, text: [] });

        // Tracked for every element (not just the "dedicated" categories
        // below) — aria-labelledby/aria-describedby can target the id of any
        // element, and a component's label/target elements are routinely
        // split across snippets, so cross-file rules need a theme-wide id
        // registry (see lib/audit/themeIndex.ts) rather than a per-tag one.
        if (attribs.id && !isLiquidExpression(attribs.id)) {
          elementIds.push({ line: toLine(offset), id: attribs.id });
        }
        for (const attr of ARIA_REFERENCE_ATTRS) {
          const value = attribs[attr];
          if (!value || isLiquidExpression(value)) continue;
          const ids = value.split(/\s+/).filter(Boolean);
          if (ids.length > 0) ariaReferences.push({ line: toLine(offset), attr, ids });
        }

        switch (name) {
          case "html":
            metaTags.htmlLang = attribs.lang ?? metaTags.htmlLang;
            break;
          case "img":
            handleImageLikeOpen("img", attribs, offset);
            break;
          case "source":
            if (attribs.srcset || attribs.src) handleImageLikeOpen("source", attribs, offset);
            break;
          case "use": {
            svgElements.push({
              line: toLine(offset),
              isUseElement: true,
              hasTitle: false,
              ariaHidden: attribs["aria-hidden"] === "true",
              role: attribs.role ?? null,
              ariaLabel: attribs["aria-label"] ?? null,
              href: attribs.href ?? attribs["xlink:href"] ?? null,
            });
            break;
          }
          case "i":
          case "span": {
            const classAttr = attribs.class ?? "";
            if (/icon/i.test(classAttr)) {
              iconElements.push({
                line: toLine(offset),
                kind: name === "i" ? "icon-font" : "icon-span",
                classes: classAttr.split(/\s+/).filter(Boolean),
                ariaHidden: attribs["aria-hidden"] === "true",
                role: attribs.role ?? null,
                ariaLabel: attribs["aria-label"] ?? null,
              });
            }
            break;
          }
          case "form":
            forms.push({ line: toLine(offset), action: attribs.action ?? null, method: attribs.method ?? null });
            break;
          case "input":
          case "select":
          case "textarea":
            inputs.push({
              line: toLine(offset),
              tag: name,
              type: name === "input" ? attribs.type : undefined,
              name: attribs.name,
              id: attribs.id,
              ariaLabel: attribs["aria-label"],
              ariaLabelledBy: attribs["aria-labelledby"],
              ariaDescribedBy: attribs["aria-describedby"],
              required: "required" in attribs,
            });
            break;
          case "script": {
            const src = attribs.src ?? null;
            const inHead = ancestorNames().includes("head");
            const inBody = ancestorNames().includes("body");
            scripts.push({
              line: toLine(offset),
              src,
              inline: !src,
              location: inHead ? "head" : inBody ? "body" : "unknown",
              async: "async" in attribs,
              defer: "defer" in attribs,
              type: attribs.type,
            });
            break;
          }
          case "style":
            stylesheets.push({ line: toLine(offset), href: null, inline: true });
            break;
          case "link":
            if ((attribs.rel ?? "").toLowerCase() === "canonical") {
              metaTags.canonical = attribs.href ?? metaTags.canonical;
            }
            if ((attribs.rel ?? "").toLowerCase().includes("stylesheet")) {
              stylesheets.push({ line: toLine(offset), href: attribs.href ?? null, inline: false });
            }
            break;
          case "meta": {
            const metaName = (attribs.name ?? "").toLowerCase();
            const property = (attribs.property ?? "").toLowerCase();
            const content = attribs.content ?? "";
            if (metaName === "description") metaTags.description = content;
            else if (metaName === "robots") metaTags.robots = content;
            else if (metaName.startsWith("twitter:")) metaTags.twitter[metaName.slice("twitter:".length)] = content;
            if (property.startsWith("og:")) metaTags.openGraph[property.slice(3)] = content;
            break;
          }
          default:
            break;
        }

        if (!DEDICATED_INTERACTIVE_TAGS.has(name)) {
          const hasOnClick = "onclick" in attribs;
          const hasKeyHandler = Object.keys(attribs).some((k) => k.startsWith("onkey"));
          const tabIndexAttr = attribs.tabindex;
          const interactiveRole = !!attribs.role && INTERACTIVE_ROLES.test(attribs.role);
          if (hasOnClick || hasKeyHandler || tabIndexAttr !== undefined || interactiveRole) {
            const ariaAttributes: Record<string, string> = {};
            for (const [k, v] of Object.entries(attribs)) {
              if (k.startsWith("aria-")) ariaAttributes[k] = v;
            }
            interactiveElements.push({
              line: toLine(offset),
              tag: name,
              role: attribs.role ?? null,
              tabIndex: tabIndexAttr !== undefined ? Number.parseInt(tabIndexAttr, 10) : null,
              ariaAttributes,
              hasClickHandlerAttr: hasOnClick,
            });
          }
        }
      },

      ontext(data) {
        for (const frame of stack) frame.text.push(data);
      },

      onclosetag(name) {
        const frame = stack.pop();
        if (!frame) return;

        if (name === "title" && stack[stack.length - 1]?.name === "svg") {
          svgHadTitle = true;
        }

        const line = toLine(frame.startOffset);
        const rawFrameText = frame.text.join("");
        const text = stripLiquidSyntax(rawFrameText).replace(/\s+/g, " ").trim();

        if (name === "svg") {
          svgElements.push({
            line,
            isUseElement: false,
            hasTitle: svgHadTitle,
            ariaHidden: frame.attribs["aria-hidden"] === "true",
            role: frame.attribs.role ?? null,
            ariaLabel: frame.attribs["aria-label"] ?? null,
            href: null,
          });
          svgHadTitle = false;
          return;
        }

        if (!TEXT_CAPTURE_TAGS.has(name) && name !== "script") return;

        switch (name) {
          case "title":
            // An <svg><title> is that icon's accessible name, not the
            // document title — only the non-svg-nested <title> counts.
            if (!stack.some((f) => f.name === "svg")) {
              metaTags.title = text || metaTags.title;
            }
            break;
          case "a":
            links.push({
              line,
              href: frame.attribs.href ?? null,
              text: text || null,
              target: frame.attribs.target ?? null,
              rel: frame.attribs.rel ?? null,
              ariaLabel: frame.attribs["aria-label"] ?? null,
            });
            break;
          case "button":
            buttons.push({
              line,
              text: text || null,
              type: frame.attribs.type ?? null,
              disabled: "disabled" in frame.attribs,
              ariaLabel: frame.attribs["aria-label"] ?? null,
            });
            break;
          case "label":
            labels.push({ line, for: frame.attribs.for, text: text || undefined });
            break;
          case "h1":
          case "h2":
          case "h3":
          case "h4":
          case "h5":
          case "h6":
            headings.push({ line, level: Number(name[1]) as 1 | 2 | 3 | 4 | 5 | 6, text: text || undefined });
            break;
          case "script": {
            const type = (frame.attribs.type ?? "").toLowerCase();
            if (type === "application/ld+json") {
              const { json, parseError } = tryParseLiquidJson(rawFrameText);
              const types = new Set<string>(extractLiteralJsonLdTypes(rawFrameText));
              if (json && typeof json === "object") {
                const t = (json as Record<string, unknown>)["@type"];
                if (typeof t === "string") types.add(t);
                else if (Array.isArray(t)) t.filter((x): x is string => typeof x === "string").forEach((x) => types.add(x));
              }
              jsonLdBlocks.push({
                line,
                endLine: toLine(parser.startIndex),
                json,
                parseError,
                rawJson: rawFrameText.trim(),
                types: [...types],
              });
            }
            break;
          }
          default:
            break;
        }
      },

      onerror(err) {
        parseErrors.push({ message: `HTML parse error: ${err.message}` });
      },
    },
    { recognizeSelfClosing: true, decodeEntities: true }
  );

  try {
    parser.write(rawText);
    parser.end();
  } catch (err) {
    parseErrors.push({ message: `HTML parsing failed: ${err instanceof Error ? err.message : String(err)}` });
  }

  return {
    images,
    svgElements,
    iconElements,
    headings,
    links,
    buttons,
    forms,
    inputs,
    labels,
    interactiveElements,
    elementIds,
    ariaReferences,
    scripts,
    stylesheets,
    metaTags,
    jsonLdBlocks,
    parseErrors,
  };
}
