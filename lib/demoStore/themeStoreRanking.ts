import { Parser } from "htmlparser2";

const THEME_STORE_LISTING_URL = "https://themes.shopify.com/themes";
const RANK_TIMEOUT_MS = 20_000;
// Independent safety cap on top of whatever the listing's own pagination
// reports (extractLastPage) — a future redesign misparsing "last page" as
// something absurd shouldn't turn one click into thousands of requests.
const RANK_MAX_PAGES = 200;

type PageCardEntry = { baseSlug: string; presetSlug: string; page: number };

// Every catalog card links to
// `/themes/<baseSlug>/presets/<presetSlug>?...&surface_type=all`
// (confirmed against a real listing) — surface_type=all excludes unrelated
// nav/filter links that also start with /themes/. Crucially, a theme with
// multiple named style presets gets ONE separately-ranked card per preset,
// not a single card for the whole theme (confirmed live: Adorn's Ace/
// Choice/Closet/Precious and Gravity's Decor/Everbloom/Gold/Mario each
// have their own card, scattered anywhere across the ~50+ pages, not
// necessarily near the theme's default listing) — so uniqueness must be
// keyed on the full (baseSlug, presetSlug) pair, never baseSlug alone. An
// earlier version of this crawler deduped by baseSlug only, which
// silently collapsed a multi-preset theme's several distinct cards into
// one and undercounted every rank after it on the page — a real bug,
// caught by a user checking the arithmetic (theme found on page 32 with
// 24 cards/page should rank in the 745-768 range, not below 720).
function extractCatalogCards(html: string, page: number): PageCardEntry[] {
  const entries: PageCardEntry[] = [];
  const seen = new Set<string>();
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name !== "a") return;
        const href = attribs.href;
        if (!href || !href.startsWith("/themes/") || !href.includes("surface_type=all")) return;
        const match = /^\/themes\/([a-z0-9-]+)\/presets\/([a-z0-9-]+)\?/.exec(href);
        if (!match) return;
        const [, baseSlug, presetSlug] = match;
        const key = `${baseSlug}/${presetSlug}`;
        if (seen.has(key)) return;
        seen.add(key);
        entries.push({ baseSlug, presetSlug, page });
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

export type CatalogRankResult = { presetSlug: string; rank: number; page: number };

/**
 * Crawls the public Shopify Theme Store's default "/themes" catalog,
 * page by page, looking for each requested theme's own default listing
 * AND every one of its known alternate style presets — the closest thing
 * to a "ranking" the storefront exposes (there's no per-theme rank
 * endpoint, only this paginated default sort). `targets` maps a theme's
 * base Theme Store slug to every preset slug expected for it (at least
 * its own default listing, i.e. presetSlug === baseSlug, plus whatever
 * lib/themes/themeStoreFeatures.ts's "Check Theme Store" action already
 * found for it — see that module's extractPresets); a theme with no
 * known alternates still short-circuits as soon as its one card turns
 * up. The crawl stops once every expected pair across all targets has
 * been found, or the listing's own last page is reached. Throws on any
 * individual page fetch failure — a partial crawl can't tell "ranks
 * beyond where we stopped" apart from "isn't listed at all", so the
 * caller gets nothing rather than a misleadingly confident answer.
 */
export async function findThemeStoreRankings(targets: Map<string, Set<string>>): Promise<Map<string, CatalogRankResult[]>> {
  const results = new Map<string, CatalogRankResult[]>([...targets.keys()].map((s) => [s, []]));
  const remaining = new Map<string, Set<string>>([...targets].map(([slug, presets]) => [slug, new Set(presets)]));
  for (const [slug, presets] of [...remaining]) {
    if (presets.size === 0) remaining.delete(slug);
  }
  if (remaining.size === 0) return results;

  const firstPageHtml = await fetchListingPage(1);
  const lastPage = Math.min(extractLastPage(firstPageHtml), RANK_MAX_PAGES);

  let overallIndex = 0;
  let html = firstPageHtml;
  for (let page = 1; page <= lastPage && remaining.size > 0; page++) {
    if (page > 1) html = await fetchListingPage(page);
    for (const entry of extractCatalogCards(html, page)) {
      overallIndex += 1;
      const expectedPresets = remaining.get(entry.baseSlug);
      if (expectedPresets?.has(entry.presetSlug)) {
        results.get(entry.baseSlug)!.push({ presetSlug: entry.presetSlug, rank: overallIndex, page });
        expectedPresets.delete(entry.presetSlug);
        if (expectedPresets.size === 0) remaining.delete(entry.baseSlug);
      }
    }
  }
  return results;
}
