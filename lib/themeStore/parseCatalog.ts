import { Parser } from "htmlparser2";

// Parsers for themes.shopify.com's public catalog (`/themes?page=N`). Pure
// functions over HTML so they can be tested without the network.

export type CatalogCard = {
  baseSlug: string;
  presetSlug: string;
  /** The card's title: the theme's name for its default preset, the preset's name otherwise. */
  name: string;
  /** USD; 0 = free; null when the card shows no price. */
  price: number | null;
  isNew: boolean;
  positivePercent: number | null;
};

// Every card links to `/themes/<base>/presets/<preset>?...surface_inter_position=N&surface_intra_position=M`
// (see lib/demoStore/themeStoreRanking.ts for why both params are required).
// The card's title is the first <p>, the price is `<data value="290.00">`, a
// "New" badge is `<span role="status">`, and the rating is the `aria-label`
// "43% positive" on a div.
export function parseCatalogCards(html: string): CatalogCard[] {
  const cards: CatalogCard[] = [];
  const seen = new Set<string>();
  let card: CatalogCard | null = null;
  let capture: "name" | "status" | null = null;
  let buffer = "";

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === "a") {
          const href = attribs.href;
          if (!href || !href.startsWith("/themes/") || !href.includes("surface_inter_position=") || !href.includes("surface_intra_position=")) return;
          const match = /^\/themes\/([a-z0-9-]+)\/presets\/([a-z0-9-]+)\?/.exec(href);
          if (!match) return;
          card = { baseSlug: match[1], presetSlug: match[2], name: "", price: null, isNew: false, positivePercent: null };
          return;
        }
        if (!card) return;
        if (name === "p" && !card.name && !capture) {
          capture = "name";
          buffer = "";
        } else if (name === "data" && attribs.value !== undefined) {
          const price = Number(attribs.value);
          if (Number.isFinite(price)) card.price = price;
        } else if (name === "span" && attribs.role === "status") {
          capture = "status";
          buffer = "";
        } else if (attribs["aria-label"]) {
          const m = /^(\d+)% positive$/.exec(attribs["aria-label"]);
          if (m) card.positivePercent = Number(m[1]);
        }
      },
      ontext(text) {
        if (capture) buffer += text;
      },
      onclosetag(name) {
        if (!card) return;
        if (capture === "name" && name === "p") {
          card.name = buffer.trim();
          capture = null;
        } else if (capture === "status" && name === "span") {
          if (/^new$/i.test(buffer.trim())) card.isNew = true;
          capture = null;
        } else if (name === "a") {
          const key = `${card.baseSlug}/${card.presetSlug}`;
          if (!seen.has(key)) {
            seen.add(key);
            cards.push(card);
          }
          card = null;
          capture = null;
        }
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return cards;
}

/** The highest `page=N` the pager links to (1 when there is no pager). */
export function parseLastPage(html: string): number {
  let last = 1;
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name !== "a" || !attribs.href?.startsWith("/themes?")) return;
        const m = /[?&]page=(\d+)(?:&|$)/.exec(attribs.href);
        if (m) last = Math.max(last, Number(m[1]));
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return last;
}

/** The theme's designer, from the "by <a href="#ReleaseNotes">Name</a>" line on its page. */
export function parseDesigner(html: string): string | null {
  const m = /<p[^>]*>\s*by\s*<a[^>]*href="#ReleaseNotes"[^>]*>([^<]+)<\/a>/.exec(html);
  return m ? m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim() || null : null;
}

export type CompanionApp = { name: string; subtitle: string | null; url: string; pricing: string | null };

/**
 * The "More for your store. Made for your theme." section of a theme's page: the app add-on the theme's developer suggests
 * (marked with `data-companion-app-*` attributes). Null when the page has no such section — most themes don't.
 */
export function parseCompanionApp(html: string): CompanionApp | null {
  let inSection = false;
  let url: string | null = null;
  let capture: "name" | "subtitle" | "pricing" | null = null;
  const text = { name: "", subtitle: "", pricing: "" };

  const parser = new Parser(
    {
      onopentag(_tag, attribs) {
        if ("data-companion-app-section" in attribs) inSection = true;
        if (!inSection) return;
        if ("data-companion-app-listing-link" in attribs && !url) url = attribs.href ?? null;
        if ("data-companion-app-name" in attribs) capture = "name";
        else if ("data-companion-app-subtitle" in attribs) capture = "subtitle";
        else if ("data-companion-app-pricing-summary" in attribs) capture = "pricing";
        else return;
      },
      ontext(chunk) {
        if (capture) text[capture] += chunk;
      },
      onclosetag() {
        capture = null;
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();

  const name = text.name.trim();
  if (!name || !url) return null;
  let clean: string = url;
  try {
    const u = new URL(url);
    clean = `${u.origin}${u.pathname}`;
  } catch {
    /* keep the raw href */
  }
  return { name, subtitle: text.subtitle.trim() || null, url: clean, pricing: text.pricing.trim() || null };
}
