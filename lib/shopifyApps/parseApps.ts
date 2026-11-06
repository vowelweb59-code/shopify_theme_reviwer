// Parsers for apps.shopify.com's public pages. Pure functions over HTML so they can be tested without the network.

export type AppCard = {
  handle: string;
  name: string;
  /** null = no reviews yet. */
  rating: number | null;
  reviewCount: number;
  /** The free-tier label the card shows ("Free", "Free plan available", "Free trial available", "Free to install"), in the store's language. */
  pricingLabel: string | null;
  tagline: string | null;
  builtForShopify: boolean;
};

export type PricingModel = "free" | "freemium" | "trial" | "paid" | "unknown";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** Every app card on a listing page, in order, once each. */
export function parseAppCards(html: string): AppCard[] {
  const seen = new Set<string>();
  const cards: AppCard[] = [];
  for (const block of html.split('data-controller="app-card"').slice(1)) {
    const b = block.slice(0, 8000);
    const handle = /data-app-card-handle-value="([^"]+)"/.exec(b)?.[1];
    const name = /data-app-card-name-value="([^"]*)"/.exec(b)?.[1];
    if (!handle || !name || seen.has(handle)) continue;
    seen.add(handle);
    const rating = /<span>\s*([\d.]+)\s*<span class="tw-sr-only"> out of 5/.exec(b)?.[1];
    const reviews = /(\d+) total reviews/.exec(b)?.[1];
    const pricing = /tw-text-ellipsis">\s*([^<]*?)\s*<\/span>/.exec(b)?.[1];
    // The tagline is the plain secondary-text div that follows the rating row.
    const tagline = /<div class="tw-text-fg-secondary tw-text-body-xs">\s*([^<]+?)\s*<\/div>/.exec(b)?.[1];
    cards.push({
      handle,
      name: decode(name),
      rating: rating ? Number(rating) : null,
      reviewCount: reviews ? Number(reviews) : 0,
      pricingLabel: pricing ? decode(pricing) : null,
      tagline: tagline ? decode(tagline) : null,
      builtForShopify: b.includes("built-for-shopify-badge"),
    });
  }
  return cards;
}

/** The card's free-tier label as a pricing model. The store localizes the label, so only English is matched; anything else is "unknown". */
export function pricingModel(label: string | null): PricingModel {
  if (!label) return "unknown";
  const l = label.toLowerCase();
  if (l === "free") return "free";
  if (l.includes("free plan")) return "freemium";
  if (l.includes("free trial")) return "trial";
  if (l.includes("free to install")) return "paid";
  return "unknown";
}

export type AppDetail = {
  developer: string | null;
  /** ISO date (yyyy-mm-dd). */
  launchedAt: string | null;
  /** Share of ratings at each star count, index 0 = 1 star … 4 = 5 stars; null when the page shows none. */
  ratingShares: [number, number, number, number, number] | null;
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function parseAppDetail(html: string): AppDetail {
  const developer = /<dt[^>]*>\s*Developer\s*<\/dt>\s*<dd[^>]*>\s*<a[^>]*>\s*([^<]*?)\s*<\/a>/.exec(html)?.[1];
  const launched = /Launched\s*<\/p>\s*<p[^>]*>\s*([A-Za-z]+) (\d{1,2}), (\d{4})/.exec(html);
  let launchedAt: string | null = null;
  if (launched) {
    const month = MONTHS.indexOf(launched[1].toLowerCase());
    if (month >= 0) launchedAt = `${launched[3]}-${String(month + 1).padStart(2, "0")}-${launched[2].padStart(2, "0")}`;
  }
  const shares: number[] = [0, 0, 0, 0, 0];
  let found = 0;
  for (const m of html.matchAll(/(\d+)% of ratings are (\d) stars?/g)) {
    shares[Number(m[2]) - 1] = Number(m[1]);
    found++;
  }
  return { developer: developer ? decode(developer) : null, launchedAt, ratingShares: found === 5 ? (shares as AppDetail["ratingShares"]) : null };
}

/** Category slugs linked from a page (`/categories/<slug>`, optionally followed by `/all`), without the page's own. */
export function parseCategoryLinks(html: string): string[] {
  const slugs = new Set<string>();
  for (const m of html.matchAll(/apps\.shopify\.com\/categories\/([a-z0-9-]+)/g)) slugs.add(m[1]);
  return [...slugs];
}

/** A category page's heading without the trailing " apps" ("Email marketing apps" → "Email marketing"). */
export function parseCategoryLabel(html: string): string | null {
  const h1 = /<h1[^>]*>\s*([^<]*?)\s*<\/h1>/.exec(html)?.[1];
  return h1 ? decode(h1).replace(/\s+apps$/i, "") : null;
}
