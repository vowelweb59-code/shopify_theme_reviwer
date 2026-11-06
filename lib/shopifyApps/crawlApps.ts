import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { ShopifyApp, ShopifyAppCategory } from "@/models/shopify-app";
import { parseAppCards, parseAppDetail, parseCategoryLabel, parseCategoryLinks, type AppCard } from "./parseApps";

// Reads the public Shopify App Store in the background, with progress the tab polls (same shape as
// lib/themeStore/crawlCatalog.ts):
//   1. the category tree, from the seven top-level categories down;
//   2. every leaf category's full listing (`/categories/<slug>/all?page=N`) — each app's rating, reviews,
//      pricing label, badge and categories;
//   3. a batch of app pages — developer, launch date, star split. The App Store has ~12,000 apps, so a run
//      reads at most DETAIL_BATCH (most-reviewed first, then anything not read in 30 days); runs add up.
// robots.txt allows all of this (it disallows only /internal, /services, search `q=` and login URLs).

const ORIGIN = "https://apps.shopify.com";
const TOP_LEVEL = ["finding-products", "marketing-and-conversion", "orders-and-shipping", "sales-channels", "selling-products", "store-design", "store-management"];
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" };
const PAUSE_MS = 1_200;
const RATE_LIMIT_WAIT_MS = 90_000;
const MAX_PAGES = 150; // per category; the largest has ~100
const DETAIL_BATCH = 400;
const DETAIL_FRESH_MS = 30 * 24 * 60 * 60 * 1000;

type Phase = "tree" | "listings" | "details";
type CrawlState = { running: Promise<void> | null; phase: Phase | null; total: number; done: number; current: string | null; appsSeen: number; errors: string[]; finishedAt: Date | null };
const g = globalThis as typeof globalThis & { _shopifyAppsCrawl?: CrawlState };
const crawl = (g._shopifyAppsCrawl ??= { running: null, phase: null, total: 0, done: 0, current: null, appsSeen: 0, errors: [], finishedAt: null });

export function shopifyAppsCrawlProgress() {
  return { running: crawl.running !== null, phase: crawl.phase, total: crawl.total, done: crawl.done, current: crawl.current, appsSeen: crawl.appsSeen, errors: crawl.errors, finishedAt: crawl.finishedAt };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const titleCase = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** The page's HTML; null on 404. Waits out a 429 and retries; any other failure throws. */
async function fetchPage(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    if (res.status === 404) return null;
    if (res.status === 429 && attempt < 2) {
      await sleep(RATE_LIMIT_WAIT_MS);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  }
  throw new Error(`Rate limited (429) for ${url}`);
}

async function crawlTree(): Promise<string[]> {
  crawl.phase = "tree";
  crawl.total = TOP_LEVEL.length;
  crawl.done = 0;
  const labels = new Map<string, string>();
  const all = new Set<string>(TOP_LEVEL);
  for (const slug of TOP_LEVEL) {
    crawl.current = slug;
    await sleep(PAUSE_MS);
    const html = await fetchPage(`${ORIGIN}/categories/${slug}`);
    if (!html) {
      crawl.errors.push(`${slug}: category page not found`);
    } else {
      // Sub-categories (and their children) are linked from the top-level page, and a few have children of their own.
      for (const s of parseCategoryLinks(html)) if (s === slug || s.startsWith(`${slug}-`) || !TOP_LEVEL.some((t) => s.startsWith(`${t}-`))) all.add(s);
      const label = parseCategoryLabel(html);
      if (label) labels.set(slug, label);
    }
    crawl.done++;
  }
  const slugs = [...all];
  const isLeaf = (slug: string) => !slugs.some((o) => o !== slug && o.startsWith(`${slug}-`));
  // Only leaves list their apps in full; a parent is kept as a row so the tree is known.
  await ShopifyAppCategory.bulkWrite(
    slugs.map((slug) => ({
      updateOne: { filter: { slug }, update: { $set: { leaf: isLeaf(slug) }, $setOnInsert: { label: labels.get(slug) ?? titleCase(slug.split("-").slice(-2).join("-")) } }, upsert: true },
    })) as never
  );
  return slugs.filter(isLeaf);
}

async function readListing(slug: string): Promise<{ cards: AppCard[]; label: string | null }> {
  const cards: AppCard[] = [];
  let label: string | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(PAUSE_MS);
    let html = await fetchPage(`${ORIGIN}/categories/${slug}/all?page=${page}`);
    // Some leaves have no "/all" view; their plain page is then the whole (first-page-only) listing.
    if (html === null && page === 1) {
      html = await fetchPage(`${ORIGIN}/categories/${slug}`);
      if (html) label = parseCategoryLabel(html);
      if (html) cards.push(...parseAppCards(html));
      break;
    }
    if (html === null) break;
    if (page === 1) label = parseCategoryLabel(html);
    const found = parseAppCards(html);
    if (found.length === 0) break;
    cards.push(...found);
  }
  return { cards, label };
}

async function crawlListings(leaves: string[]): Promise<void> {
  crawl.phase = "listings";
  crawl.total = leaves.length;
  crawl.done = 0;
  const now = new Date();
  const seen = new Map<string, string[]>(); // handle → leaf slugs it was read in
  let failed = 0;
  for (const slug of leaves) {
    crawl.current = slug;
    await sleep(PAUSE_MS);
    try {
      const { cards, label } = await readListing(slug);
      if (label) await ShopifyAppCategory.updateOne({ slug }, { $set: { label } });
      if (cards.length > 0) {
        await ShopifyApp.bulkWrite(
          cards.map((c) => ({
            updateOne: {
              filter: { handle: c.handle },
              update: {
                $set: { name: c.name, tagline: c.tagline, rating: c.rating, reviewCount: c.reviewCount, pricingLabel: c.pricingLabel, builtForShopify: c.builtForShopify, lastSeenAt: now },
                $setOnInsert: { firstSeenAt: now },
              },
              upsert: true,
            },
          })) as never
        );
        for (const c of cards) seen.set(c.handle, [...(seen.get(c.handle) ?? []), slug]);
        crawl.appsSeen = seen.size;
      }
    } catch (err) {
      crawl.errors.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
    crawl.done++;
  }
  // Categories are rewritten from this read, so an app that left a category stops counting there.
  // Done only when every leaf was read, so a partial read never drops categories.
  if (failed === 0 && seen.size > 0) {
    await ShopifyApp.bulkWrite([...seen].map(([handle, slugs]) => ({ updateOne: { filter: { handle }, update: { $set: { categories: slugs } } } })) as never);
    await ShopifyApp.updateMany({ handle: { $nin: [...seen.keys()] } }, { $set: { categories: [] } });
  }
}

async function crawlDetails(): Promise<void> {
  crawl.phase = "details";
  const stale = await ShopifyApp.find({ $or: [{ detailAt: null }, { detailAt: { $lt: new Date(Date.now() - DETAIL_FRESH_MS) } }] })
    .sort({ reviewCount: -1 })
    .limit(DETAIL_BATCH)
    .select("handle")
    .lean<{ handle: string }[]>();
  crawl.total = stale.length;
  crawl.done = 0;
  let failures = 0;
  for (const { handle } of stale) {
    crawl.current = handle;
    await sleep(PAUSE_MS);
    try {
      const html = await fetchPage(`${ORIGIN}/${handle}`);
      if (html === null) {
        // Delisted since the listing was read.
        await ShopifyApp.updateOne({ handle }, { $set: { detailAt: new Date(), detailError: "Not found" } });
      } else {
        const d = parseAppDetail(html);
        await ShopifyApp.updateOne({ handle }, { $set: { developer: d.developer, launchedAt: d.launchedAt, ratingShares: d.ratingShares, detailAt: new Date(), detailError: null } });
      }
      failures = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      crawl.errors.push(`${handle}: ${message}`);
      await ShopifyApp.updateOne({ handle }, { $set: { detailError: message } });
      if (++failures >= 5) throw new Error(`Stopped after repeated failures: ${message}`);
    }
    crawl.done++;
  }
}

/** Starts a read of the App Store in the background (no-op if one is already running). Resolves when the read ends, whether or not it was this call that started it. */
export function startShopifyAppsCrawl(): Promise<void> {
  if (crawl.running) return crawl.running;
  crawl.errors = [];
  crawl.done = 0;
  crawl.total = 0;
  crawl.appsSeen = 0;
  crawl.finishedAt = null;
  crawl.running = (async () => {
    await connectToDatabase();
    const leaves = await crawlTree();
    await crawlListings(leaves);
    await crawlDetails();
  })()
    .catch((err) => {
      console.error("[shopifyApps] crawl failed:", err);
      crawl.errors.push(err instanceof Error ? err.message : String(err));
    })
    .finally(() => {
      crawl.phase = null;
      crawl.current = null;
      crawl.finishedAt = new Date();
      crawl.running = null;
    });
  return crawl.running;
}
