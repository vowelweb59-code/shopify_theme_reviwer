// Parsers for the Shopify Partner Directory (www.shopify.com/partners/directory).
// The listing pages are server-rendered, 16 cards per page, so plain HTML
// fetches are enough — no browser needed. Checked live 2026-10-01:
//   /partners/directory/locations                → index of country pages
//   /partners/directory/locations/<country>?page=N → cards + "Showing 1 - 16 of N"
// An unknown country slug answers 302, and a page past the end has no cards.

export const PAGE_SIZE = 16;

export type DirectoryPartner = {
  slug: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  /** The location line as shown, e.g. "Salt Lake City, United States". */
  location: string | null;
  startingPrice: number | null;
  /** The few services the card lists (not the "+ N more"). */
  services: string[];
  moreServices: number;
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

/** Visible text of a chunk of HTML, one entry per tag boundary. */
function textParts(html: string): string[] {
  return html
    .replace(/<(svg|script|style)\b[\s\S]*?<\/\1>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/<[^>]+>/)
    .map((t) => decode(t).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** "Showing 1 - 16 of 1294 partners" → 1294 (null when the page has no such line). */
export function parseTotal(html: string): number | null {
  const m = html.match(/Showing[\s\S]{0,80}?\bof\s+([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export function parseCards(html: string): DirectoryPartner[] {
  const chunks = html.split('data-component-name="listing-profile-card"').slice(1);
  const out: DirectoryPartner[] = [];
  for (const chunk of chunks) {
    const slug = chunk.match(/href="(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/partners\/directory\/partner\/([a-z0-9_-]+)/i)?.[1];
    const name = decode(chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1].replace(/<[^>]+>/g, "") ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!slug || !name) continue;

    const parts = textParts(chunk);
    const ratingAt = parts.findIndex((p) => /^\d(\.\d)?$/.test(p));
    const rating = ratingAt >= 0 ? Number(parts[ratingAt]) : null;
    const reviews = ratingAt >= 0 ? parts[ratingAt + 1]?.match(/^\(?\s*(\d[\d,]*)\s*\)?$/)?.[1] : undefined;
    const priceAt = parts.findIndex((p) => /^Price range/i.test(p));
    const location = (priceAt > 0 ? parts[priceAt - 1] : parts.find((p) => /, /.test(p) && !/^Starting/.test(p))) ?? null;
    const price = parts.join(" ").match(/Starting from \$?([\d,]+)/)?.[1];
    const servicesAt = parts.indexOf("Services");
    const serviceParts = servicesAt >= 0 ? parts.slice(servicesAt + 1) : [];
    const more = serviceParts.find((p) => /^\+\s*\d+\s+more$/i.test(p))?.match(/\d+/)?.[0];
    const services = (serviceParts[0] && !/^\+\s*\d+\s+more$/i.test(serviceParts[0]) ? serviceParts[0] : "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    out.push({
      slug,
      name,
      rating: rating !== null && Number.isFinite(rating) ? rating : null,
      reviewCount: reviews ? Number(reviews.replace(/,/g, "")) : null,
      location,
      startingPrice: price ? Number(price.replace(/,/g, "")) : null,
      services,
      moreServices: more ? Number(more) : 0,
    });
  }
  return out;
}

/** Country slugs linked from the directory's locations index. */
export function parseCountrySlugs(html: string): string[] {
  const slugs = new Set<string>();
  for (const m of html.matchAll(/\/partners\/directory\/locations\/([a-z0-9-]+)/g)) slugs.add(m[1]);
  return [...slugs].sort();
}

/** "united-kingdom" → "United Kingdom" (the directory shows country names that way). */
export function countryLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w === "and" || w === "of" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** The country at the end of a location line: "Dover, United States" → "United States". */
export function countryFromLocation(location: string | null): string | null {
  if (!location) return null;
  const last = location.split(",").pop()?.trim();
  return last || null;
}

export type PartnerProfile = { website: string | null; email: string | null; phone: string | null; partnerSince: string | null };

/**
 * A profile page's "Contact information" block: a website link, then a
 * tel: and a mailto: link when the partner filled them in. Only that block
 * is read — the rest of the page links to merchants' stores.
 */
export function parseProfile(html: string): PartnerProfile {
  const start = html.indexOf("Contact information");
  const end = start >= 0 ? html.indexOf("Primary location", start) : -1;
  const block = start >= 0 ? html.slice(start, end > start ? end : start + 6000) : "";
  const website = block.match(/href="(https?:\/\/[^"]+)"/)?.[1] ?? null;
  const email = block.match(/href="mailto:([^"?]+)/)?.[1] ?? null;
  const phone = block.match(/href="tel:([^"]+)"/)?.[1] ?? null;
  const since = textParts(html).find((t) => /^Partner since /i.test(t))?.replace(/^Partner since /i, "") ?? null;
  return {
    website: website ? cleanUrl(decode(website)) : null,
    email: email ? decode(email).trim().toLowerCase() : null,
    phone: phone ? decode(phone).trim() : null,
    partnerSince: since,
  };
}

/** Drops the tracking query (?utm_source=sref) the directory adds to a partner's site. */
function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}
