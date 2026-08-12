import { buildLineIndex } from "./lineIndex";
import { DEPRECATED_FILTER_NAMES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES } from "./deprecatedReferences";
import type {
  ParsedAssetReference,
  ParsedDeprecatedReference,
  ParsedLiquidReference,
  ParsedLiquidTag,
  ParsedLocaleReference,
  ParsedParseError,
  ParsedSchemaBlock,
  ParsedSectionReference,
  ParsedSettingReference,
  ParsedString,
  ParsedTranslationReference,
} from "./types";

export type LiquidStructure = {
  schemaBlocks: ParsedSchemaBlock[];
  liquidTags: ParsedLiquidTag[];
  liquidObjects: ParsedLiquidReference[];
  deprecatedReferences: ParsedDeprecatedReference[];
  translationReferences: ParsedTranslationReference[];
  hardcodedStrings: ParsedString[];
  assetReferences: ParsedAssetReference[];
  sectionReferences: ParsedSectionReference[];
  localeReferences: ParsedLocaleReference[];
  settingReferences: ParsedSettingReference[];
  parseErrors: ParsedParseError[];
};

const SCHEMA_BLOCK_RE = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/g;
const COMMENT_BLOCK_RE = /\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g;
// {% style %}...{% endstyle %} wraps section-scoped raw CSS — not rendered
// user-facing text, so it must be stripped before the hardcoded-string scan
// the same way <style> tags and {% comment %} blocks are.
const STYLE_TAG_BLOCK_RE = /\{%-?\s*style\s*-?%\}[\s\S]*?\{%-?\s*endstyle\s*-?%\}/g;
// {% javascript %}...{% endjavascript %} is style's JS counterpart —
// same reasoning, same treatment.
const JAVASCRIPT_TAG_BLOCK_RE = /\{%-?\s*javascript\s*-?%\}[\s\S]*?\{%-?\s*endjavascript\s*-?%\}/g;
// {% capture x %}...{% endcapture %} assigns its body to a variable — it is
// not rendered at that position, so its content (which often looks like
// loose text once Liquid tokens inside it are stripped) must not be scanned.
const CAPTURE_BLOCK_RE = /\{%-?\s*capture\s+\w+\s*-?%\}[\s\S]*?\{%-?\s*endcapture\s*-?%\}/g;
// {% doc %}...{% enddoc %} is snippet-level developer documentation
// (JSDoc-style @param comments), never rendered.
const DOC_BLOCK_RE = /\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g;
const QUOTED_STRING_RE = /(['"])(?:(?!\1)[^\r\n])*\1/g;
const OUTPUT_RE = /\{\{-?([\s\S]*?)-?\}\}/g;
const TAG_RE = /\{%-?\s*(\w+)([\s\S]*?)-?%\}/g;
const OBJECT_CHAIN_RE = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.[a-zA-Z_][a-zA-Z0-9_]*\b/g;
const FILTER_RE = /\|\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
const TRANSLATION_RE = /(['"])((?:(?!\1)[^\r\n])*)\1\s*\|\s*(t|translate)\b/g;
const ASSET_URL_RE = /(['"])((?:(?!\1)[^\r\n])*?\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|eot))\1/gi;
const SETTINGS_REF_RE = /\bsettings\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
const NOT_LIQUID_WORD_CHARS = /^[a-zA-Z][a-zA-Z0-9 ,.'!?&:;()-]*$/;

/** Blanks a matched span to spaces while preserving every `\n` at its original position, so line numbers computed from character offsets into the blanked string never drift for content after a multi-line match. */
function blank(match: string): string {
  return match.replace(/[^\n]/g, " ");
}

function quotedArg(body: string): { value: string | null; dynamic: boolean } {
  const match = /(['"])((?:(?!\1)[^\r\n])*)\1/.exec(body);
  if (match) return { value: match[2], dynamic: false };
  const hasAnyToken = body.trim().length > 0;
  return { value: null, dynamic: hasAnyToken };
}

function classifyStringConfidence(text: string): ParsedString["confidence"] | null {
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;
  if (!NOT_LIQUID_WORD_CHARS.test(trimmed)) return null;
  if (/^[0-9,.\s-]+$/.test(trimmed)) return null; // pure numbers/punctuation
  if (/[_/]/.test(trimmed)) return null; // identifier-ish (snake_case, paths)

  const hasSpace = /\s/.test(trimmed);
  const looksCamelCase = /[a-z][A-Z]/.test(trimmed);
  if (looksCamelCase && !hasSpace) return "low";
  if (hasSpace) return "high";
  return trimmed.length >= 3 ? "medium" : "low";
}

/** Blanks out quoted string literals (same length, so offsets stay valid) so object-chain matching never fires inside a string like 'products.product.add_to_cart'. */
function maskStringLiterals(text: string): string {
  return text.replace(QUOTED_STRING_RE, blank);
}

function extractObjectAndFilterRefs(
  content: string,
  baseOffset: number,
  toLine: (offset: number) => number,
  liquidObjects: ParsedLiquidReference[],
  deprecatedReferences: ParsedDeprecatedReference[]
) {
  const masked = maskStringLiterals(content);
  for (const match of masked.matchAll(OBJECT_CHAIN_RE)) {
    const name = match[1];
    const line = toLine(baseOffset + (match.index ?? 0));
    liquidObjects.push({ line, kind: "object", name });
    if (DEPRECATED_OBJECT_NAMES.has(name)) {
      deprecatedReferences.push({ line, token: name, referenceType: "object" });
    }
  }
  for (const match of masked.matchAll(FILTER_RE)) {
    const name = match[1];
    const line = toLine(baseOffset + (match.index ?? 0));
    liquidObjects.push({ line, kind: "filter", name });
    if (DEPRECATED_FILTER_NAMES.has(name)) {
      deprecatedReferences.push({ line, token: name, referenceType: "filter" });
    }
  }
}

export function extractLiquidStructure(rawText: string): LiquidStructure {
  const toLine = buildLineIndex(rawText);

  const schemaBlocks: ParsedSchemaBlock[] = [];
  const liquidTags: ParsedLiquidTag[] = [];
  const liquidObjects: ParsedLiquidReference[] = [];
  const deprecatedReferences: ParsedDeprecatedReference[] = [];
  const translationReferences: ParsedTranslationReference[] = [];
  const hardcodedStrings: ParsedString[] = [];
  const assetReferences: ParsedAssetReference[] = [];
  const sectionReferences: ParsedSectionReference[] = [];
  const localeReferences: ParsedLocaleReference[] = [];
  const settingReferences: ParsedSettingReference[] = [];
  const parseErrors: ParsedParseError[] = [];

  // --- {% schema %} blocks -------------------------------------------------
  for (const match of rawText.matchAll(SCHEMA_BLOCK_RE)) {
    const rawJson = match[1].trim();
    const line = toLine(match.index ?? 0);
    const endLine = toLine((match.index ?? 0) + match[0].length);
    let json: Record<string, unknown> | null = null;
    let parseError: string | null = null;
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        json = parsed as Record<string, unknown>;
      } else {
        parseError = "Schema JSON must be an object.";
      }
    } catch (err) {
      parseError = err instanceof Error ? err.message : "Invalid JSON";
    }
    schemaBlocks.push({ line, endLine, json, parseError, rawJson });
  }

  // Strip schema blocks before further scanning so their JSON content
  // (which may itself contain `{{`/`{%`-looking strings in labels) doesn't
  // get double-counted as Liquid tags/output elsewhere in the file.
  const withoutSchema = rawText.replace(SCHEMA_BLOCK_RE, blank);

  // --- {{ output }} blocks: object/filter refs, translation refs ----------
  for (const match of withoutSchema.matchAll(OUTPUT_RE)) {
    const content = match[1];
    const offset = (match.index ?? 0) + match[0].indexOf(content);
    extractObjectAndFilterRefs(content, offset, toLine, liquidObjects, deprecatedReferences);
  }

  // --- {% tag %} blocks: tag refs, render/include/section targets ---------
  for (const match of withoutSchema.matchAll(TAG_RE)) {
    const tagName = match[1];
    const body = match[2];
    const line = toLine(match.index ?? 0);
    liquidTags.push({ line, tag: tagName, raw: match[0].slice(0, 300) });

    if (DEPRECATED_TAG_NAMES.has(tagName)) {
      deprecatedReferences.push({ line, token: tagName, referenceType: "tag" });
    }

    const bodyOffset = (match.index ?? 0) + match[0].indexOf(body);
    extractObjectAndFilterRefs(body, bodyOffset, toLine, liquidObjects, deprecatedReferences);

    if (tagName === "render" || tagName === "include") {
      const { value, dynamic } = quotedArg(body);
      sectionReferences.push({ line, kind: "snippet", name: value ?? "(dynamic)", dynamic: dynamic || !value });
    } else if (tagName === "section" || tagName === "sections") {
      const { value, dynamic } = quotedArg(body);
      sectionReferences.push({ line, kind: "section", name: value ?? "(dynamic)", dynamic: dynamic || !value });
    }
  }

  // --- translation filters --------------------------------------------------
  for (const match of withoutSchema.matchAll(TRANSLATION_RE)) {
    translationReferences.push({ line: toLine(match.index ?? 0), key: match[2], filter: match[3] });
  }

  // --- asset references (quoted strings that look like a file path) -------
  for (const match of withoutSchema.matchAll(ASSET_URL_RE)) {
    const ext = match[3].toLowerCase();
    const kind: ParsedAssetReference["kind"] =
      ext === "css" ? "css" : ext === "js" ? "js" : ["woff", "woff2", "ttf", "eot"].includes(ext) ? "font" : "image";
    assetReferences.push({ line: toLine(match.index ?? 0), kind, reference: match[2] });
  }

  // --- settings.* references -------------------------------------------------
  for (const match of withoutSchema.matchAll(SETTINGS_REF_RE)) {
    settingReferences.push({ line: toLine(match.index ?? 0), key: match[1] });
  }

  // Translation keys are only ever resolved through the `t`/`translate`
  // filter — Shopify has no generic dot-path accessor into locale JSON, so
  // `localeReferences` must not include bare `locale.xxx`/`request.locale.xxx`
  // access: that's always the built-in locale/language Drop (iso_code, name,
  // endonym_name, primary), never a translation lookup, and treating it as
  // one produced false "missing translation key" findings.
  for (const ref of translationReferences) {
    localeReferences.push({ line: ref.line, key: ref.key });
  }

  // --- hardcoded user-facing strings ---------------------------------------
  // Heuristic, deliberately conservative: only text nodes between tags, with
  // Liquid/HTML markup stripped first, that read like a phrase/word rather
  // than an identifier. Phase 3 treats confidence, not just presence.
  const withoutComments = withoutSchema
    .replace(COMMENT_BLOCK_RE, blank)
    .replace(STYLE_TAG_BLOCK_RE, blank)
    .replace(JAVASCRIPT_TAG_BLOCK_RE, blank)
    .replace(CAPTURE_BLOCK_RE, blank)
    .replace(DOC_BLOCK_RE, blank);
  const withoutScriptStyle = withoutComments
    .replace(/<script[\s\S]*?<\/script>/gi, blank)
    .replace(/<style[\s\S]*?<\/style>/gi, blank);
  const withoutLiquid = withoutScriptStyle.replace(OUTPUT_RE, blank).replace(TAG_RE, blank);
  // HTML tags routinely span multiple lines (attributes one per line, custom
  // elements with conditionally-included attributes) — stripped globally
  // with `s` (dotall) before splitting, not per-line, or a tag's attribute
  // lines leak through as if they were page text.
  const withoutHtmlTags = withoutLiquid.replace(/<[^>]*>/g, blank);
  const lines = withoutHtmlTags.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const textOnly = lines[i].trim();
    if (!textOnly) continue;
    const confidence = classifyStringConfidence(textOnly);
    if (confidence) hardcodedStrings.push({ line: i + 1, text: textOnly, confidence });
  }

  return {
    schemaBlocks,
    liquidTags,
    liquidObjects,
    deprecatedReferences,
    translationReferences,
    hardcodedStrings,
    assetReferences,
    sectionReferences,
    localeReferences,
    settingReferences,
    parseErrors,
  };
}
