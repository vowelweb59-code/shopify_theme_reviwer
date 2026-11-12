import type { ExecutedFinding } from "../runRules";
import type { DemoContent } from "./demoContent";

export type DemoPageType = "home" | "collection" | "product";

const CATEGORY = "Theme Store Compliance" as const;
const SOURCE = "Theme Store review: a demo store must look like a real, finished store (real products, real copy, real images).";

// Text a theme or Shopify leaves behind when nobody wrote real copy.
const PLACEHOLDER_TEXT: { re: RegExp; label: string }[] = [
  { re: /lorem ipsum|dolor sit amet|consectetur adipiscing/i, label: "lorem ipsum filler" },
  { re: /share information about your brand/i, label: "Shopify's default brand paragraph" },
  { re: /talk about your brand/i, label: "\"Talk about your brand\"" },
  { re: /\byour text here\b|\bclick here to edit\b|\bdescribe your (product|brand|business)\b/i, label: "an unedited prompt" },
  { re: /\badd (a )?(heading|tagline|your (text|description|content))\b/i, label: "an unedited prompt" },
  { re: /\b(example|sample|test|dummy) (product|collection|title|text|content)\b/i, label: "example/sample/test wording" },
  { re: /\bplaceholder (text|title|content|image)\b/i, label: "the word \"placeholder\"" },
];

// Shopify's own sample products (the snowboard shop every new dev store ships with).
const SAMPLE_PRODUCT_RE = /\bthe (complete|collection|compare at price|multi-managed|multi-location|hidden|draft|archived|inventory not tracked|videographer|3p fulfilled|out of stock|minimal|oversized)\b[^.]{0,40}\bsnowboard\b|\bselling plans ski wax\b/i;
const GENERIC_PRODUCT_RE = /^(product|item|example|sample|test|dummy)\s*#?\d*$/i;

const PLACEHOLDER_IMAGE_FILE_RE = /(placeholder|no[-_]?image|noimage|default[-_]?image|dummy|image[-_]?coming|coming[-_]?soon)/i;
const PLACEHOLDER_IMAGE_HOST_RE = /(^|\.)(placehold\.co|placehold\.it|via\.placeholder\.com|placeholder\.com|picsum\.photos|loremflickr\.com|placekitten\.com|dummyimage\.com)$/i;
const NOT_CONTENT_IMAGE_RE = /(logo|icon|payment|badge|flag|star|arrow|sprite|favicon|cursor|spinner|loading|trust|social)/i;
const FILENAME_ALT_RE = /\.(jpe?g|png|webp|gif|avif)$|^(img|dsc|image|photo|picture|screenshot)[-_ ]?\d+/i;

function fileName(src: string): string {
  try {
    return new URL(src).pathname.split("/").pop() ?? "";
  } catch {
    return src;
  }
}

/** The same picture at different sizes shares a name once the Shopify size suffix (_600x, _grande) and version are dropped. */
export function imageKey(src: string): string {
  try {
    const u = new URL(src);
    return `${u.hostname}${u.pathname.replace(/_(\d+x\d*|x\d+|pico|icon|thumb|small|compact|medium|large|grande|original|master)(?=\.[a-z]+$)/i, "")}`;
  } catch {
    return src;
  }
}

/** The pictures that count as content: not icons, flags, logos or vector art. */
export function contentImagesOf(content: DemoContent) {
  return content.images.filter((i) => !NOT_CONTENT_IMAGE_RE.test(fileName(i.src)) && !/\.svg$/i.test(fileName(i.src)) && !/cdn\.shopify\.com\/static\//i.test(i.src));
}

function snippet(items: string[], max = 3): string {
  const shown = items.slice(0, max).map((s) => `"${s.length > 60 ? `${s.slice(0, 57)}…` : s}"`);
  return shown.join(", ") + (items.length > max ? ` (+${items.length - max} more)` : "");
}

/**
 * Demo realism: does this demo page look like a real store (real copy, real products, real pictures) or an unfinished
 * template? Pure rules over what the page's HTML shows; no AI. Findings are in "Theme Store Compliance" with ids LIVE-DEMO-*.
 */
export function demoRealismFindings(content: DemoContent, pageType: DemoPageType, url: string): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];
  const add = (ruleId: string, severity: ExecutedFinding["severity"], finding: string, recommendation: string) =>
    findings.push({ ruleId, filePath: url, category: CATEGORY, severity, finding, recommendation, sourceReference: SOURCE });

  // 1. Placeholder copy.
  const hits = PLACEHOLDER_TEXT.filter((p) => p.re.test(content.text));
  if (hits.length > 0) {
    const lorem = hits.some((h) => h.label.startsWith("lorem"));
    add(
      "LIVE-DEMO-TEXT-001",
      lorem ? "high" : "medium",
      `The ${pageType} page still shows placeholder copy: ${[...new Set(hits.map((h) => h.label))].join(", ")}.`,
      "Replace it with real copy written for the demo brand in the theme editor (sections and blocks)."
    );
  }

  // 2. Placeholder pictures: drawn empty slots, or image files/hosts that are stand-ins.
  const placeholderImages = content.images.filter((i) => {
    try {
      return PLACEHOLDER_IMAGE_HOST_RE.test(new URL(i.src).hostname) || PLACEHOLDER_IMAGE_FILE_RE.test(fileName(i.src));
    } catch {
      return false;
    }
  });
  const emptySlots = content.placeholderSvgCount + placeholderImages.length;
  if (emptySlots > 0) {
    add(
      "LIVE-DEMO-IMG-001",
      emptySlots >= 3 ? "high" : "medium",
      `The ${pageType} page shows ${emptySlots} placeholder image${emptySlots === 1 ? "" : "s"} (${content.placeholderSvgCount} empty image slot${content.placeholderSvgCount === 1 ? "" : "s"}, ${placeholderImages.length} stand-in image file${placeholderImages.length === 1 ? "" : "s"}).`,
      "Upload a real photo for every product, collection and section image on the demo store."
    );
  }

  // 3. Alt text that is just a file name.
  // Icons, flags and other vector art are not photos: leave them out of every picture check.
  const contentImages = contentImagesOf(content);
  const fileAlt = contentImages.filter((i) => i.alt && FILENAME_ALT_RE.test(i.alt.trim()));
  if (fileAlt.length >= 2) {
    add(
      "LIVE-DEMO-IMG-002",
      "low",
      `${fileAlt.length} images on the ${pageType} page have a file name as their alt text: ${snippet(fileAlt.map((i) => i.alt!))}.`,
      "Describe what the picture shows (for example \"Woman wearing a linen shirt\") instead of the file name."
    );
  }

  // 4. The same picture used again and again.
  const counts = new Map<string, number>();
  for (const i of contentImages) counts.set(imageKey(i.src), (counts.get(imageKey(i.src)) ?? 0) + 1);
  // Real pages repeat pictures (hover images, carousel clones, mega menus), so only a heavy share of the page counts as filler.
  const repeated = [...counts.entries()].filter(([, n]) => n >= 4 && n / contentImages.length >= 0.25).sort((a, b) => b[1] - a[1]);
  if (repeated.length > 0) {
    add(
      "LIVE-DEMO-IMG-003",
      "medium",
      `The ${pageType} page uses the same picture ${repeated[0][1]} times (${fileName(repeated[0][0])}${repeated.length > 1 ? `, and ${repeated.length - 1} more repeated` : ""}), which reads as filler.`,
      "Use a different photo for each product or block so the demo looks like a real catalog."
    );
  }

  // 5. Product names.
  const titles = Object.values(content.productTitles);
  const sample = titles.filter((t) => SAMPLE_PRODUCT_RE.test(t));
  if (sample.length > 0) {
    add(
      "LIVE-DEMO-PRODUCT-001",
      "high",
      `The ${pageType} page lists Shopify's built-in sample products: ${snippet(sample)}.`,
      "Delete the default sample products and add products that fit the demo's niche."
    );
  }
  const generic = titles.filter((t) => GENERIC_PRODUCT_RE.test(t));
  if (generic.length > 0) {
    add(
      "LIVE-DEMO-PRODUCT-002",
      "medium",
      `The ${pageType} page lists products with generic names: ${snippet(generic)}.`,
      "Give every demo product a believable name."
    );
  }
  if (titles.length >= 6) {
    const dupes = titles.length - new Set(titles.map((t) => t.toLowerCase())).size;
    if (dupes >= Math.ceil(titles.length / 3)) {
      add(
        "LIVE-DEMO-PRODUCT-003",
        "low",
        `${dupes} of the ${titles.length} products on the ${pageType} page share a name with another product.`,
        "Use distinct product names across the catalog."
      );
    }
  }

  // 6. Too little on the page to look like a real store.
  const productCount = titles.length;
  if (pageType === "collection" && productCount < 8) {
    add(
      "LIVE-DEMO-CONTENT-001",
      productCount < 4 ? "high" : "medium",
      `The collection page shows only ${productCount} product${productCount === 1 ? "" : "s"}.`,
      "Fill each demo collection with at least 8 to 12 products so the grid, filters and pagination are visible."
    );
  }
  if (pageType === "home" && contentImages.length < 4) {
    add(
      "LIVE-DEMO-CONTENT-002",
      "medium",
      `The homepage has only ${contentImages.length} content image${contentImages.length === 1 ? "" : "s"}.`,
      "Add real imagery to the homepage sections (hero, featured collections, banners)."
    );
  }
  if (pageType === "product" && contentImages.length < 3) {
    add(
      "LIVE-DEMO-CONTENT-003",
      "low",
      `The product page shows only ${contentImages.length} image${contentImages.length === 1 ? "" : "s"}.`,
      "Give the demo product several photos so the gallery and zoom features can be seen."
    );
  }

  // 7. A product with no description or no price in the page's own product data (Product JSON-LD).
  if (pageType === "product" && content.product) {
    if (content.product.description.replace(/\s+/g, " ").trim().length < 50) {
      add(
        "LIVE-DEMO-PRODUCT-004",
        "medium",
        "The demo product has no real description (its product data holds under 50 characters).",
        "Write a believable product description so the product page shows how the theme lays out real copy."
      );
    }
    if (content.product.price === null || !(Number(content.product.price) > 0)) {
      add("LIVE-DEMO-PRODUCT-005", "medium", "The demo product has no price (or a price of zero).", "Give every demo product a real price.");
    }
  }

  // 8. Every price the same: a sign the catalog is filler.
  if (pageType !== "product") {
    const prices = (content.text.match(PRICE_RE) ?? []).map((p) => p.replace(/\s/g, ""));
    const distinct = new Set(prices).size;
    if (prices.length >= 8 && distinct <= 2) {
      add(
        "LIVE-DEMO-PRODUCT-006",
        "low",
        `The ${pageType} page shows ${prices.length} prices but only ${distinct} different one${distinct === 1 ? "" : "s"}.`,
        "Vary the prices across the demo catalog, including some sale prices."
      );
    }
  }

  // 9. A homepage with almost no copy.
  if (pageType === "home" && content.text.length < 400) {
    add(
      "LIVE-DEMO-CONTENT-004",
      "medium",
      `The homepage has very little text (${content.text.length} characters).`,
      "Add real headings, descriptions and calls to action to the homepage sections."
    );
  }

  return findings;
}

const PRICE_RE = /(?:[$€£¥₹]|\bRs\.?|\b(?:USD|EUR|GBP|INR|CAD|AUD))\s?\d[\d,]*(?:\.\d{1,2})?/g;

type ImageProbeResult = { src: string; status: number; width: number | null; height: number | null };
const LOW_RES_PX = 600;

/** Findings from reading the headers of a page's photos (see imageProbe.ts): pictures that don't load, and pictures too small. */
export function imageProbeFindings(probes: ImageProbeResult[], pageType: DemoPageType, url: string): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];
  const add = (ruleId: string, severity: ExecutedFinding["severity"], finding: string, recommendation: string) =>
    findings.push({ ruleId, filePath: url, category: CATEGORY, severity, finding, recommendation, sourceReference: SOURCE });

  const broken = probes.filter((p) => p.status === 404 || p.status === 410);
  if (broken.length > 0) {
    add(
      "LIVE-DEMO-IMG-004",
      broken.length >= 3 ? "high" : "medium",
      `${broken.length} of ${probes.length} images checked on the ${pageType} page don't load (not found): ${snippet(broken.map((b) => fileName(b.src)))}.`,
      "Re-upload the missing pictures or remove the blocks that point to them."
    );
  }
  const small = probes.filter((p) => p.width !== null && p.width < LOW_RES_PX);
  if (small.length >= 2) {
    add(
      "LIVE-DEMO-IMG-005",
      "medium",
      `${small.length} of ${probes.length} images checked on the ${pageType} page are under ${LOW_RES_PX}px wide (${snippet(small.map((s) => `${fileName(s.src)} ${s.width}×${s.height}`))}), so they will look soft on large screens.`,
      "Upload photos at least 1000px wide (1500px or more for hero and banner images)."
    );
  }
  return findings;
}

/**
 * Presets of one theme should look like different stores. Flags a preset whose homepage reuses most of another preset's pictures
 * (the later preset in the list is the one reported). Needs at least 5 photos on each side to say anything.
 */
export function presetOverlapFindings(presets: { label: string; url: string; content?: DemoContent }[]): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];
  const keys = presets.map((p) => new Set(p.content ? contentImagesOf(p.content).map((i) => imageKey(i.src)) : []));
  for (let j = 1; j < presets.length; j++) {
    for (let i = 0; i < j; i++) {
      const smaller = Math.min(keys[i].size, keys[j].size);
      if (smaller < 5) continue;
      const shared = [...keys[j]].filter((k) => keys[i].has(k)).length;
      if (shared / smaller >= 0.8) {
        findings.push({
          ruleId: "LIVE-DEMO-PRESET-001",
          filePath: presets[j].url,
          category: CATEGORY,
          severity: "low",
          presetLabel: presets[j].label,
          finding: `The "${presets[j].label}" preset's homepage reuses ${Math.round((shared / smaller) * 100)}% of the pictures on "${presets[i].label}", so it reads as the same store restyled, not a different one.`,
          recommendation: "Give each preset its own photography so the presets show distinct looks.",
          sourceReference: SOURCE,
        });
        break;
      }
    }
  }
  return findings;
}
