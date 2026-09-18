import { Parser } from "htmlparser2";
import { extractLiteralJsonLdTypes } from "@/lib/theme-parser/liquidJson";

export type PageFacts = {
  url: string;
  jsonLdTypes: string[];
  canonical: string | null;
  metaDescription: string | null;
  /**
   * Every `.shopify-section` wrapper's id (the `shopify-section-` prefix
   * stripped) — Shopify's layout rendering wraps every section in this
   * exact markup unconditionally, so this is a reliable, theme-agnostic
   * read of "which sections are actually rendered on this page", useful
   * for comparePresets() without any extra page load.
   */
  sectionIds: string[];
  /** First product page link found on this page, if any (used to find a product page to check from the homepage). */
  firstProductLink: string | null;
};

// A real demo store's first hit can be genuinely slow (cold CDN cache, a
// heavy theme's third-party apps/trackers) — matches the timeout the old
// Playwright-based navigation used for the same reason.
const FETCH_TIMEOUT_MS = 30_000;

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

async function fetchOnce(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches raw HTML with one retry — on a timeout only, mirroring the
 * one-retry reasoning the old Playwright-based navigation used (a real
 * store's first hit can be slow, but a URL that's genuinely unreachable
 * will just fail the same way again).
 */
export async function fetchHtml(url: string): Promise<string> {
  try {
    return await fetchOnce(url);
  } catch (err) {
    if (!isAbortError(err)) throw err;
    return fetchOnce(url);
  }
}

const SECTION_CLASS_RE = /(^|\s)shopify-section(\s|$)/;
const PRODUCT_LINK_RE = /\/products\//;

/**
 * Extracts the same structural signals the old Playwright-based
 * extractLoadedPageFacts read from a live rendered DOM, but from the
 * server-rendered HTML source directly — no browser needed. Shopify's own
 * section rendering and the `| structured_data` filter both emit this
 * markup server-side, so this sees the same content for the overwhelming
 * majority of themes. The one thing it can't see that a real browser
 * could is content injected purely by client-side JS after load (e.g. an
 * app that writes JSON-LD via a script tag at runtime rather than server-
 * side) — an accepted trade-off for not needing Chromium.
 */
export function extractPageFactsFromHtml(html: string, baseUrl: string): Omit<PageFacts, "url"> {
  const jsonLdTypes = new Set<string>();
  let canonical: string | null = null;
  let metaDescription: string | null = null;
  const sectionIds: string[] = [];
  let firstProductLink: string | null = null;
  let inJsonLd = false;
  let jsonLdBuffer = "";

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === "script" && (attribs.type ?? "").toLowerCase() === "application/ld+json") {
          inJsonLd = true;
          jsonLdBuffer = "";
          return;
        }
        if (name === "link" && (attribs.rel ?? "").toLowerCase() === "canonical" && attribs.href) {
          canonical = attribs.href;
          return;
        }
        if (name === "meta" && (attribs.name ?? "").toLowerCase() === "description" && attribs.content) {
          metaDescription = attribs.content;
          return;
        }
        if (attribs.id?.startsWith("shopify-section-") && SECTION_CLASS_RE.test(attribs.class ?? "")) {
          sectionIds.push(attribs.id.replace(/^shopify-section-/, ""));
        }
        if (name === "a" && attribs.href && !firstProductLink && PRODUCT_LINK_RE.test(attribs.href)) {
          try {
            firstProductLink = new URL(attribs.href, baseUrl).toString();
          } catch {
            // malformed href — skip
          }
        }
      },
      ontext(text) {
        if (inJsonLd) jsonLdBuffer += text;
      },
      onclosetag(name) {
        if (name === "script" && inJsonLd) {
          inJsonLd = false;
          for (const type of extractLiteralJsonLdTypes(jsonLdBuffer)) jsonLdTypes.add(type);
        }
      },
    },
    { decodeEntities: true }
  );

  parser.write(html);
  parser.end();

  return { jsonLdTypes: [...jsonLdTypes], canonical, metaDescription, sectionIds, firstProductLink };
}

export async function fetchPageFacts(url: string): Promise<PageFacts> {
  const html = await fetchHtml(url);
  return { url, ...extractPageFactsFromHtml(html, url) };
}
