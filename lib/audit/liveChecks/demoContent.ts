import { Parser } from "htmlparser2";

export type DemoImage = { src: string; alt: string | null };

/** What a demo-store page shows a visitor, read from its server-rendered HTML (no browser, so late JS-injected content is not seen). */
export type DemoContent = {
  images: DemoImage[];
  /** `<svg class="placeholder…">` graphics: the empty-image slots Shopify draws when a product or section has no picture. */
  placeholderSvgCount: number;
  /** Where each empty slot sits (its page section and the product / collection link around it), at most 8, for the finding text. */
  placeholderSlots?: string[];
  /** Visible text with scripts, styles and templates removed, whitespace collapsed. */
  text: string;
  /** Product link text by product URL (the longest text seen for each), i.e. the product names shown on the page. */
  productTitles: Record<string, string>;
  /** First collection link on the page, preferring a real collection over /collections/all. */
  firstCollectionLink: string | null;
  /** The page's Product JSON-LD (what search engines read as the product), when it has one. */
  product: ProductData | null;
};

export type ProductData = { name: string; description: string; price: string | null; imageCount: number };

function findProduct(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findProduct(n);
      if (hit) return hit;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return obj;
  return findProduct(obj["@graph"]);
}

function productFromJsonLd(raw: string): ProductData | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const p = findProduct(data);
  if (!p) return null;
  const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  const o = (offers && typeof offers === "object" ? offers : {}) as Record<string, unknown>;
  const price = o.price ?? o.lowPrice ?? null;
  const image = p.image;
  return {
    name: typeof p.name === "string" ? p.name : "",
    description: typeof p.description === "string" ? p.description : "",
    price: price === null || price === undefined ? null : String(price),
    imageCount: Array.isArray(image) ? image.length : image ? 1 : 0,
  };
}

const SKIP_TEXT_TAGS = new Set(["script", "style", "noscript", "template", "svg"]);
const PRODUCT_HREF_RE = /\/products\/([^/?#]+)/;
const COLLECTION_HREF_RE = /\/collections\/([^/?#]+)/;

const HIDDEN_CLASS_TOKENS = new Set(["hidden", "is-hidden", "d-none", "hide", "display-none", "visually-hidden", "sr-only"]);

function isHidden(attribs: Record<string, string>): boolean {
  if ("hidden" in attribs || attribs["aria-hidden"] === "true") return true;
  if (/display\s*:\s*none/i.test(attribs.style ?? "")) return true;
  return (attribs.class ?? "").split(/\s+/).some((c) => HIDDEN_CLASS_TOKENS.has(c));
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href.startsWith("//") ? `https:${href}` : href, baseUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The first URL in a srcset ("a.jpg 1x, b.jpg 2x"). */
function firstSrcsetUrl(srcset: string | undefined): string | undefined {
  return srcset?.split(",")[0]?.trim().split(/\s+/)[0] || undefined;
}

/** "section \"image-banner\", inside https://shop/products/x": where an empty image slot is on the page. */
function describeSlot(stack: { id?: string; href?: string; cls?: string }[], baseUrl: string): string {
  const parts: string[] = [];
  for (let i = stack.length - 1; i >= 0; i--) {
    const e = stack[i];
    if (!parts.some((p) => p.startsWith("inside")) && e.href && /\/(products|collections)\//.test(e.href)) {
      parts.push(`inside ${resolveUrl(e.href, baseUrl)?.split(/[?#]/)[0] ?? e.href}`);
    }
    const m = e.id ? /^shopify-section-(?:template--\d+__)?(.+)$/.exec(e.id) : null;
    if (m) {
      parts.unshift(`section "${m[1]}"`);
      break;
    }
  }
  return parts.length > 0 ? parts.join(", ") : "a section with no id";
}

export function extractDemoContent(html: string, baseUrl: string): DemoContent {
  const images: DemoImage[] = [];
  const textParts: string[] = [];
  const productTitles: Record<string, string> = {};
  let placeholderSvgCount = 0;
  const placeholderSlots: string[] = [];
  // Open elements, to say where an empty slot is: its Shopify section id and the link around it.
  const stack: { id?: string; href?: string; cls?: string }[] = [];
  let firstCollectionLink: string | null = null;
  let fallbackCollectionLink: string | null = null;
  let skipDepth = 0;
  // Elements a visitor never sees (quick-add / cart / modal templates ship in the HTML but stay hidden): their copy and
  // pictures say nothing about the demo. `openHidden` mirrors the open-tag stack so a hidden element's end is matched.
  let hiddenCount = 0;
  const openHidden: boolean[] = [];
  let productHref: string | null = null;
  let productText = "";
  let product: ProductData | null = null;
  let inJsonLd = false;
  let jsonLdBuffer = "";

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === "script" && (attribs.type ?? "").toLowerCase() === "application/ld+json") {
          inJsonLd = true;
          jsonLdBuffer = "";
        }
        const hidden = isHidden(attribs);
        openHidden.push(hidden);
        stack.push({ id: attribs.id, href: name === "a" ? attribs.href : undefined, cls: attribs.class });
        if (hidden) hiddenCount++;
        if (name === "svg" && hiddenCount === 0 && /placeholder/i.test(attribs.class ?? "")) {
          placeholderSvgCount++;
          if (placeholderSlots.length < 8) placeholderSlots.push(describeSlot(stack, baseUrl));
        }
        if (SKIP_TEXT_TAGS.has(name)) skipDepth++;

        if (name === "img" && hiddenCount === 0) {
          // Lazy-loaded themes put a 1px data: URI in src and the real picture in data-src / srcset.
          const candidates = [attribs["data-src"], firstSrcsetUrl(attribs["data-srcset"]), attribs.src, firstSrcsetUrl(attribs.srcset)];
          const raw = candidates.find((c) => c && !c.startsWith("data:"));
          const src = raw ? resolveUrl(raw, baseUrl) : null;
          if (src) images.push({ src, alt: attribs.alt ?? null });
        }

        if (name === "a" && attribs.href) {
          if (PRODUCT_HREF_RE.test(attribs.href)) {
            productHref = resolveUrl(attribs.href, baseUrl)?.split(/[?#]/)[0] ?? null;
            productText = "";
          }
          const collection = COLLECTION_HREF_RE.exec(attribs.href);
          if (collection) {
            const link = resolveUrl(attribs.href, baseUrl)?.split(/[?#]/)[0] ?? null;
            if (link && collection[1] !== "all") firstCollectionLink ??= link;
            else if (link) fallbackCollectionLink ??= link;
          }
        }
      },
      ontext(text) {
        if (inJsonLd) {
          jsonLdBuffer += text;
          return;
        }
        if (skipDepth > 0 || hiddenCount > 0) return;
        textParts.push(text);
        if (productHref) productText += text;
      },
      onclosetag(name) {
        if (name === "script" && inJsonLd) {
          inJsonLd = false;
          product ??= productFromJsonLd(jsonLdBuffer);
        }
        if (openHidden.pop()) hiddenCount--;
        stack.pop();
        if (SKIP_TEXT_TAGS.has(name) && skipDepth > 0) skipDepth--;
        if (name === "a" && productHref) {
          const title = productText.replace(/\s+/g, " ").trim();
          if (title && title.length > (productTitles[productHref]?.length ?? 0)) productTitles[productHref] = title;
          productHref = null;
        }
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();

  return {
    images,
    placeholderSvgCount,
    placeholderSlots,
    text: textParts.join(" ").replace(/\s+/g, " ").trim(),
    productTitles,
    firstCollectionLink: firstCollectionLink ?? fallbackCollectionLink,
    product,
  };
}
