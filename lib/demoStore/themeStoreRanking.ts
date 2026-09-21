import { Parser } from "htmlparser2";

const THEME_STORE_LISTING_URL = "https://themes.shopify.com/themes";
const RANK_TIMEOUT_MS = 20_000;
// Independent safety cap on top of whatever the listing's own pagination
// reports (extractLastPage) — a future redesign misparsing "last page" as
// something absurd shouldn't turn one click into thousands of requests.
const RANK_MAX_PAGES = 200;

type PageThemeEntry = { slug: string; page: number };

// Every theme card on a listing page links to
// `/themes/<slug>/presets/<slug>?...&surface_type=all` (confirmed against
// a real listing) — surface_type=all excludes unrelated nav/filter links
// that also start with /themes/. A card can render more than one <a> to
// the same slug (image + title), so only the first occurrence per page
// counts toward that page's order.
function extractThemeCardSlugs(html: string, page: number): PageThemeEntry[] {
  const entries: PageThemeEntry[] = [];
  const seen = new Set<string>();
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name !== "a") return;
        const href = attribs.href;
        if (!href || !href.startsWith("/themes/") || !href.includes("surface_type=all")) return;
        const match = /^\/themes\/([a-z0-9-]+)\//.exec(href);
        if (!match) return;
        const slug = match[1];
        if (seen.has(slug)) return;
        seen.add(slug);
        entries.push({ slug, page });
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return entries;
}

// The pager renders numbered page links as `<a href="/themes?page=N">` —
// including the true last page explicitly even when earlier pages are
// collapsed behind an ellipsis (confirmed against a real listing: page 1
// of 54 still links directly to page=54). Falls back to 1 if the page
// this is called on turns out to be the only page.
function extractLastPage(html: string): number {
  let last = 1;
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name !== "a") return;
        const href = attribs.href;
        if (!href) return;
        const match = /^\/themes\?page=(\d+)$/.exec(href);
        if (match) last = Math.max(last, Number(match[1]));
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return last;
}

async function fetchListingPage(page: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RANK_TIMEOUT_MS);
  try {
    const res = await fetch(`${THEME_STORE_LISTING_URL}?page=${page}`, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`Theme Store listing page ${page} responded with status ${res.status}.`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export type ThemeRankResult = { rank: number; page: number };

/**
 * Crawls the public Shopify Theme Store's default "/themes" catalog,
 * page by page, to find each of the given slugs' overall position in it —
 * the closest thing to a "ranking" the storefront exposes (there's no
 * per-theme rank endpoint, only this paginated default sort). A single
 * pass serves every slug at once and stops as soon as all of them have
 * been found, or the listing's own last page is reached, so checking a
 * theme that ranks on page 1 costs one request, not fifty-four. Throws on
 * any individual page fetch failure — a partial crawl can't tell "ranks
 * beyond where we stopped" apart from "isn't listed at all", so the
 * caller gets nothing rather than a misleadingly confident answer.
 */
export async function findThemeStoreRankings(slugs: string[]): Promise<Map<string, ThemeRankResult | null>> {
  const results = new Map<string, ThemeRankResult | null>(slugs.map((s) => [s, null]));
  const targets = new Set(slugs);
  if (targets.size === 0) return results;

  const firstPageHtml = await fetchListingPage(1);
  const lastPage = Math.min(extractLastPage(firstPageHtml), RANK_MAX_PAGES);

  let overallIndex = 0;
  let html = firstPageHtml;
  for (let page = 1; page <= lastPage && targets.size > 0; page++) {
    if (page > 1) html = await fetchListingPage(page);
    for (const entry of extractThemeCardSlugs(html, page)) {
      overallIndex += 1;
      if (targets.has(entry.slug)) {
        results.set(entry.slug, { rank: overallIndex, page });
        targets.delete(entry.slug);
      }
    }
  }
  return results;
}
