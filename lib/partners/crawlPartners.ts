import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { ShopifyPartner } from "@/models/shopify-partner";
import { PARTNER_TIERS } from "@/models/shopify-partner";
import { PAGE_SIZE, parseCards, parseCountrySlugs, parseTotal, type DirectoryPartner } from "./parseDirectory";

// Crawls the public Partner Directory one country at a time (~350 pages for
// ~5,300 partners as of 2026-10-01, plus ~350 for the tier passes) with a pause between requests, in the
// background, with progress the tab polls. Same shape as the Sales category
// crawl in lib/sales/categories.ts.

const BASE = "https://www.shopify.com/partners/directory/locations";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36", Accept: "text/html" };
const PAUSE_MS = 1_200;
const RATE_LIMIT_WAIT_MS = 60_000;
const MAX_PAGES_PER_COUNTRY = 200; // safety net; the largest country is ~81 pages

type CrawlState = { running: Promise<void> | null; total: number; done: number; current: string | null; partnersSeen: number; errors: string[]; finishedAt: Date | null };
const g = globalThis as typeof globalThis & { _partnerCrawl?: CrawlState };
const crawl = (g._partnerCrawl ??= { running: null, total: 0, done: 0, current: null, partnersSeen: 0, errors: [], finishedAt: null });

export function partnerCrawlProgress() {
  return { running: crawl.running !== null, total: crawl.total, done: crawl.done, current: crawl.current, partnersSeen: crawl.partnersSeen, errors: crawl.errors, finishedAt: crawl.finishedAt };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** GET a directory page. Returns null for a redirect (the directory's answer for an unknown country). */
async function fetchPage(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: HEADERS, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    if (res.status >= 300 && res.status < 400) return null;
    if (res.status === 429 && attempt === 0) {
      await sleep(RATE_LIMIT_WAIT_MS);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  }
  throw new Error(`Rate limited (429) for ${url}`);
}

/** Pages through one listing (a country, optionally narrowed by a query like `partnerTiers=tier_plus`). */
async function crawlListing(slug: string, filter: string | null, onCards: (cards: DirectoryPartner[]) => Promise<void>): Promise<boolean> {
  let total: number | null = null;
  for (let page = 1; page <= MAX_PAGES_PER_COUNTRY; page++) {
    await sleep(PAUSE_MS);
    const query = [filter, page > 1 ? `page=${page}` : null].filter(Boolean).join("&");
    const html = await fetchPage(`${BASE}/${slug}${query ? `?${query}` : ""}`);
    if (html === null) return false;
    if (page === 1) total = parseTotal(html);
    const cards = parseCards(html);
    if (cards.length === 0) return true;
    await onCards(cards);
    if (total !== null && page * PAGE_SIZE >= total) return true;
  }
  return true;
}

async function crawlCountry(slug: string): Promise<void> {
  const now = new Date();
  const exists = await crawlListing(slug, null, async (cards) => {
    await ShopifyPartner.bulkWrite(
      cards.map((c) => ({
        updateOne: {
          filter: { slug: c.slug },
          update: {
            $set: {
              name: c.name,
              rating: c.rating,
              reviewCount: c.reviewCount,
              location: c.location,
              startingPrice: c.startingPrice,
              services: c.services,
              moreServices: c.moreServices,
              lastSeenAt: now,
            },
            $addToSet: { countrySlugs: slug },
            $setOnInsert: { firstSeenAt: now },
          },
          upsert: true,
        },
      }))
    );
    crawl.partnersSeen += cards.length;
  });
  if (!exists) return;

  // The cards don't show a partner's tier, so read it from the directory's own
  // tier filter: one pass per tier. Partners in no pass have no tier.
  await ShopifyPartner.updateMany({ countrySlugs: slug }, { $set: { tier: null } });
  for (const tier of PARTNER_TIERS) {
    await crawlListing(slug, `partnerTiers=tier_${tier}`, async (cards) => {
      await ShopifyPartner.updateMany({ slug: { $in: cards.map((c) => c.slug) } }, { $set: { tier } });
    });
  }
}

/** Starts a full crawl of every country in the background (no-op if one is already running). */
export function startPartnerCrawl(): void {
  if (crawl.running) return;
  crawl.errors = [];
  crawl.done = 0;
  crawl.total = 0;
  crawl.partnersSeen = 0;
  crawl.finishedAt = null;
  crawl.running = (async () => {
    await connectToDatabase();
    const index = await fetchPage(BASE);
    const slugs = index ? parseCountrySlugs(index).filter((s) => s) : [];
    if (slugs.length === 0) throw new Error("Couldn't read the country list from the directory.");
    crawl.total = slugs.length;
    for (const [i, slug] of slugs.entries()) {
      crawl.current = slug;
      if (i > 0) await sleep(PAUSE_MS);
      try {
        await crawlCountry(slug);
      } catch (err) {
        crawl.errors.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`);
      }
      crawl.done++;
    }
  })()
    .catch((err) => {
      console.error("[partners] crawl failed:", err);
      crawl.errors.push(err instanceof Error ? err.message : String(err));
    })
    .finally(() => {
      crawl.current = null;
      crawl.finishedAt = new Date();
      crawl.running = null;
    });
}
