import { Parser } from "htmlparser2";

const THEME_STORE_LISTING_URL = "https://themes.shopify.com/themes";
const RANK_TIMEOUT_MS = 20_000;
// Same bot-protection workaround as lib/themes/themeStoreFeatures.ts's fetch
// of a single listing page — a UA-less request to themes.shopify.com
// intermittently 403s (confirmed live), which for a multi-page crawl would
// throw and discard the whole crawl per the "partial crawl can't tell ranks
// beyond where we stopped apart from not listed" policy below.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
// Independent safety cap on top of whatever the listing's own pagination
// reports (extractLastPage) — a future redesign misparsing "last page" as
// something absurd shouldn't turn one click into thousands of requests.
const RANK_MAX_PAGES = 200;

type PageCardEntry = { baseSlug: string; presetSlug: string; page: number };

// Every catalog card links to
// `/themes/<baseSlug>/presets/<presetSlug>?...&surface_inter_position=N&surface_intra_position=M...`
// (confirmed against a real listing) — requiring both position params
// present excludes unrelated nav/filter links that also start with
// /themes/. The exact `surface_type`/`surface_detail` params on that
// link vary by view and are NOT a reliable card marker: the unfiltered
// and sort-only views use `surface_type=all`, but an industry-filtered
// view uses `surface_type=industry&surface_detail=<industry-slug>`
// instead (confirmed live) — an earlier version of this function
// required the literal string "surface_type=all", which meant every
// industry-filtered crawl silently found zero cards on every page and
// reported "no matches" for themes that were actually there (caught by a
// user screenshotting a theme that plainly appeared in a real filtered
// browse, contradicting the app's own "No matches").
//
// Crucially, a theme with multiple named style presets gets ONE
// separately-ranked card per preset, not a single card for the whole
// theme (confirmed live: Adorn's Ace/Choice/Closet/Precious and
// Gravity's Decor/Everbloom/Gold/Mario each have their own card,
// scattered anywhere across the ~50+ pages, not necessarily near the
// theme's default listing) — so uniqueness must be keyed on the full
// (baseSlug, presetSlug) pair, never baseSlug alone. An earlier version
// of this crawler deduped by baseSlug only, which silently collapsed a
// multi-preset theme's several distinct cards into one and undercounted
// every rank after it on the page — a real bug, caught by a user
// checking the arithmetic (theme found on page 32 with 24 cards/page
// should rank in the 745-768 range, not below 720).
function extractCatalogCards(html: string, page: number): PageCardEntry[] {
  const entries: PageCardEntry[] = [];
  const seen = new Set<string>();
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name !== "a") return;
        const href = attribs.href;
        if (!href || !href.startsWith("/themes/") || !href.includes("surface_inter_position=") || !href.includes("surface_intra_position=")) return;
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

// The pager renders numbered page links as `<a href="/themes?page=N">` on
// the unfiltered default view — including the true last page explicitly
// even when earlier pages are collapsed behind an ellipsis (confirmed
// against a real listing: page 1 of 54 still links directly to page=54).
// Under a sort/industry filter the same link instead carries every active
// param, in varying order (confirmed live: `/themes?page=54&sort_by=newest`,
// page first) — an earlier version of this matched only the bare
// `?page=N` shape and silently found "1 page" for every filtered crawl,
// making every filtered check return zero results (nothing wrong, it just
// never looked past page 1). Matching `page=(\d+)` anywhere in the query
// string, regardless of what else surrounds it, handles both shapes.
// Falls back to 1 if the page this is called on turns out to be the only
// one.
function extractLastPage(html: string): number {
  let last = 1;
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name !== "a") return;
        const href = attribs.href;
        if (!href || !href.startsWith("/themes?")) return;
        const match = /[?&]page=(\d+)(?:&|$)/.exec(href);
        if (match) last = Math.max(last, Number(match[1]));
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return last;
}

// Confirmed live against themes.shopify.com: `sort_by` and `industry[]`
// are real server-side query params (a `sort_by=newest` request returns a
// genuinely different card order; `industry[]=beauty` genuinely narrows
// the total from ~1274 to ~136). A `feature[]` param was tried and did
// NOT filter anything — the checkboxes that looked like a feature filter
// turned out to belong to an unrelated newsletter-signup form elsewhere
// on the page, not the catalog filter — so feature-wise filtering isn't
// implemented (skipped per explicit product decision rather than guessed
// at further).
export type CatalogFilter = { sortBy?: "relevance" | "newest"; industry?: string | null };

function buildListingUrl(page: number, filter?: CatalogFilter): string {
  const params = new URLSearchParams({ page: String(page) });
  if (filter?.sortBy && filter.sortBy !== "relevance") params.set("sort_by", filter.sortBy);
  if (filter?.industry) params.append("industry[]", filter.industry);
  return `${THEME_STORE_LISTING_URL}?${params.toString()}`;
}

async function fetchListingPage(page: number, filter?: CatalogFilter): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RANK_TIMEOUT_MS);
  try {
    const res = await fetch(buildListingUrl(page, filter), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": BROWSER_USER_AGENT },
    });
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
 * caller gets nothing rather than a misleadingly confident answer. An
 * optional `filter` (sort order / industry) crawls that filtered view of
 * the catalog instead of the unfiltered default — a theme that doesn't
 * belong to the given industry simply never turns up, same as it
 * wouldn't on the real site; a smaller filtered catalog also means fewer
 * pages to walk, not more.
 */
export async function findThemeStoreRankings(
  targets: Map<string, Set<string>>,
  filter?: CatalogFilter
): Promise<Map<string, CatalogRankResult[]>> {
  const results = new Map<string, CatalogRankResult[]>([...targets.keys()].map((s) => [s, []]));
  const remaining = new Map<string, Set<string>>([...targets].map(([slug, presets]) => [slug, new Set(presets)]));
  for (const [slug, presets] of [...remaining]) {
    if (presets.size === 0) remaining.delete(slug);
  }
  if (remaining.size === 0) return results;

  const firstPageHtml = await fetchListingPage(1, filter);
  const lastPage = Math.min(extractLastPage(firstPageHtml), RANK_MAX_PAGES);

  let overallIndex = 0;
  let html = firstPageHtml;
  for (let page = 1; page <= lastPage && remaining.size > 0; page++) {
    if (page > 1) html = await fetchListingPage(page, filter);
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
