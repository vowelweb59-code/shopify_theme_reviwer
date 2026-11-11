import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { fetchPublicText, sleep } from "@/lib/net/fetchPublic";
import { ShopifyApp, ShopifyAppCategory, ShopifyAppFeature } from "@/models/shopify-app";
import { featureParts, parseAppCards, parseAppDeepDetail, parseAppDetail, parseCategoryLabel, parseCategoryLinks, type AppCard } from "./parseApps";

// Reads the public Shopify App Store in the background and keeps the data current. Three kinds of read share one
// "running" guard, and the tab polls their progress (same shape as lib/themeStore/crawlCatalog.ts):
//   full       the category tree (every level, so nested categories such as FAQ are found), every leaf category's full
//              listing (`/categories/<slug>/all?page=N`: rating, reviews, pricing label, badge, categories), then a few
//              app pages. Runs about once a day (scheduler.ts).
//   details    a batch of app pages: developer, launch date, star split, description, features, plans, languages,
//              works-with. The App Store has ~12,000 apps, so the scheduler works through the backlog in small batches.
//   category   one category on demand: its listing, then every app in it, freshly.
// Which apps' pages are read first: watched categories (ShopifyAppCategory.priority; FAQ from the start), then apps never
// read or read by an older reader (DETAIL_VERSION), then anything older than DETAIL_FRESH_MS, most-reviewed first.
// robots.txt allows all of this (it disallows only /internal, /services, search `q=` and login URLs).

const ORIGIN = "https://apps.shopify.com";
const TOP_LEVEL = ["finding-products", "marketing-and-conversion", "orders-and-shipping", "sales-channels", "selling-products", "store-design", "store-management"];
/** Categories watched from the start; more can be watched from the tab. */
const WATCHED_BY_DEFAULT = ["store-management-support-faq"];
const PAUSE_MS = 1_200;
const RATE_LIMIT_WAIT_MS = 90_000;
const MAX_PAGES = 150; // per category; the largest has ~100
/** Bump when the detail reader learns to read more: every app below it is read again, watched categories first. */
export const DETAIL_VERSION = 2;
const FULL_SCAN_DETAIL_BATCH = 100;
export const DETAIL_SCAN_BATCH = 200;
const DETAIL_FRESH_MS = 30 * 24 * 60 * 60 * 1000;
const WATCHED_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

type Phase = "tree" | "listings" | "details";
type Mode = "full" | "details" | "category";
type CrawlState = { running: Promise<void> | null; mode: Mode | null; scope: string | null; phase: Phase | null; total: number; done: number; current: string | null; appsSeen: number; errors: string[]; finishedAt: Date | null };
const g = globalThis as typeof globalThis & { _shopifyAppsCrawl?: CrawlState };
const crawl = (g._shopifyAppsCrawl ??= { running: null, mode: null, scope: null, phase: null, total: 0, done: 0, current: null, appsSeen: 0, errors: [], finishedAt: null });

export function shopifyAppsCrawlProgress() {
  return { running: crawl.running !== null, mode: crawl.mode, scope: crawl.scope, phase: crawl.phase, total: crawl.total, done: crawl.done, current: crawl.current, appsSeen: crawl.appsSeen, errors: crawl.errors, finishedAt: crawl.finishedAt };
}

const titleCase = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** The page's HTML; null on 404. Waits out a 429 and retries; any other failure throws. */
async function fetchPage(url: string): Promise<string | null> {
  return fetchPublicText(url, { attempts: 3, rateLimitWaitMs: RATE_LIMIT_WAIT_MS, nullOn404: true });
}

/**
 * Walks the category tree from the seven top-level pages down: every page's links to its own sub-categories are followed,
 * however deep (the store nests several levels; FAQ is store-management > support > faq). `complete` is false when any
 * page could not be read, so a partial tree never rewrites which categories an app is in.
 */
async function crawlTree(): Promise<{ leaves: string[]; complete: boolean }> {
  crawl.phase = "tree";
  crawl.total = TOP_LEVEL.length;
  crawl.done = 0;
  const labels = new Map<string, string>();
  const all = new Set<string>(TOP_LEVEL);
  const queue = [...TOP_LEVEL];
  let complete = true;
  while (queue.length > 0) {
    const slug = queue.shift()!;
    crawl.current = slug;
    await sleep(PAUSE_MS);
    try {
      const html = await fetchPage(`${ORIGIN}/categories/${slug}`);
      if (!html) {
        crawl.errors.push(`${slug}: category page not found`);
      } else {
        const label = parseCategoryLabel(html);
        if (label) labels.set(slug, label);
        for (const s of parseCategoryLinks(html)) {
          const child = s.startsWith(`${slug}-`);
          // The top-level pages also link a few categories that carry no top-level prefix.
          const stray = TOP_LEVEL.includes(slug) && !TOP_LEVEL.some((t) => s === t || s.startsWith(`${t}-`));
          if ((child || stray) && !all.has(s)) {
            all.add(s);
            queue.push(s);
          }
        }
      }
    } catch (err) {
      complete = false;
      crawl.errors.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
    crawl.done++;
    crawl.total = Math.max(crawl.total, all.size);
  }
  const slugs = [...all];
  const isLeaf = (slug: string) => !slugs.some((o) => o !== slug && o.startsWith(`${slug}-`));
  // Only leaves list their apps in full; a parent is kept as a row so the tree is known.
  await ShopifyAppCategory.bulkWrite(
    slugs.map((slug) => ({
      updateOne: {
        filter: { slug },
        update: { $set: { leaf: isLeaf(slug) }, $setOnInsert: { label: labels.get(slug) ?? titleCase(slug.split("-").slice(-2).join("-")), priority: WATCHED_BY_DEFAULT.includes(slug) } },
        upsert: true,
      },
    })) as never
  );
  return { leaves: slugs.filter(isLeaf), complete };
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

async function saveCards(cards: AppCard[], now: Date): Promise<void> {
  if (cards.length === 0) return;
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
}

async function crawlListings(leaves: string[], rewriteCategories: boolean): Promise<void> {
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
      await saveCards(cards, now);
      for (const c of cards) seen.set(c.handle, [...(seen.get(c.handle) ?? []), slug]);
      crawl.appsSeen = seen.size;
    } catch (err) {
      crawl.errors.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
    crawl.done++;
  }
  // Categories are rewritten from this read, so an app that left a category stops counting there.
  // Done only when the whole tree and every leaf were read, so a partial read never drops categories.
  if (rewriteCategories && failed === 0 && seen.size > 0) {
    await ShopifyApp.bulkWrite([...seen].map(([handle, slugs]) => ({ updateOne: { filter: { handle }, update: { $set: { categories: slugs } } } })) as never);
    await ShopifyApp.updateMany({ handle: { $nin: [...seen.keys()] } }, { $set: { categories: [] } });
  }
}

/** One category on demand: its listing (its apps join the category), returning every handle listed. */
async function readOneCategory(slug: string): Promise<string[]> {
  crawl.phase = "listings";
  crawl.total = 1;
  crawl.done = 0;
  crawl.current = slug;
  const { cards, label } = await readListing(slug);
  if (label) await ShopifyAppCategory.updateOne({ slug }, { $set: { label } });
  await saveCards(cards, new Date());
  const handles = cards.map((c) => c.handle);
  if (handles.length > 0) await ShopifyApp.updateMany({ handle: { $in: handles } }, { $addToSet: { categories: slug } });
  crawl.appsSeen = handles.length;
  crawl.done = 1;
  return handles;
}

// What "needs reading": never read, read by an older reader, or older than the cut-off.
const needsDetail = (cut: Date) => ({ $or: [{ detailVersion: { $lt: DETAIL_VERSION } }, { detailAt: null }, { detailAt: { $lt: cut } }] });

/** Handles to read next, up to `limit`: watched categories first, then everything else, most-reviewed first. `only` limits to given apps; `force` re-reads them even if fresh. */
async function detailQueue(limit: number, only?: string[], force = false): Promise<string[]> {
  const now = Date.now();
  const cut = (ms: number) => new Date(force ? now + 1000 : now - ms);
  const scope = only ? { handle: { $in: only } } : {};
  const watched = (await ShopifyAppCategory.find({ priority: true }).select("slug").lean<{ slug: string }[]>()).map((c) => c.slug);
  const first = watched.length
    ? await ShopifyApp.find({ $and: [scope, { categories: { $in: watched } }, needsDetail(cut(WATCHED_FRESH_MS))] }).sort({ reviewCount: -1 }).limit(limit).select("handle").lean<{ handle: string }[]>()
    : [];
  const handles = first.map((a) => a.handle);
  if (handles.length < limit) {
    const rest = await ShopifyApp.find({ $and: [scope, { handle: { $nin: handles } }, needsDetail(cut(DETAIL_FRESH_MS))] })
      .sort({ reviewCount: -1 })
      .limit(limit - handles.length)
      .select("handle")
      .lean<{ handle: string }[]>();
    handles.push(...rest.map((a) => a.handle));
  }
  return handles;
}

/** How many apps are waiting for their page to be read (watched categories count from a week, others from a month). */
export async function detailBacklog(): Promise<number> {
  const watched = (await ShopifyAppCategory.find({ priority: true }).select("slug").lean<{ slug: string }[]>()).map((c) => c.slug);
  const now = Date.now();
  const general = needsDetail(new Date(now - DETAIL_FRESH_MS));
  const filter = watched.length ? { $or: [general, { $and: [{ categories: { $in: watched } }, needsDetail(new Date(now - WATCHED_FRESH_MS))] }] } : general;
  return ShopifyApp.countDocuments(filter);
}

async function crawlDetails({ limit, only, force }: { limit: number; only?: string[]; force?: boolean }): Promise<void> {
  crawl.phase = "details";
  const queue = await detailQueue(limit, only, force);
  crawl.total = queue.length;
  crawl.done = 0;
  let failures = 0;
  for (const handle of queue) {
    crawl.current = handle;
    await sleep(PAUSE_MS);
    try {
      const html = await fetchPage(`${ORIGIN}/${handle}`);
      if (html === null) {
        // Delisted since the listing was read.
        await ShopifyApp.updateOne({ handle }, { $set: { detailAt: new Date(), detailError: "Not found", detailVersion: DETAIL_VERSION } });
      } else {
        const d = parseAppDetail(html);
        const deep = parseAppDeepDetail(html);
        await ShopifyApp.updateOne(
          { handle },
          {
            $set: {
              developer: d.developer,
              launchedAt: d.launchedAt,
              ratingShares: d.ratingShares,
              description: deep.description,
              features: deep.features.map((f) => f.handle),
              plans: deep.plans,
              languages: deep.languages,
              worksWith: deep.worksWith,
              detailAt: new Date(),
              detailError: null,
              detailVersion: DETAIL_VERSION,
            },
          }
        );
        const catalog = deep.features.flatMap((f) => {
          const parts = featureParts(f.handle);
          return parts ? [{ updateOne: { filter: { handle: f.handle }, update: { $set: { label: f.label, group: parts.group, categoryKey: parts.category } }, upsert: true } }] : [];
        });
        if (catalog.length > 0) await ShopifyAppFeature.bulkWrite(catalog as never);
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

/** Runs a read in the background (no-op if one is already running); resolves when the read ends, whether or not this call started it. */
function run(mode: Mode, scope: string | null, body: () => Promise<void>): Promise<void> {
  if (crawl.running) return crawl.running;
  crawl.errors = [];
  crawl.done = 0;
  crawl.total = 0;
  crawl.appsSeen = 0;
  crawl.finishedAt = null;
  crawl.mode = mode;
  crawl.scope = scope;
  crawl.running = (async () => {
    await connectToDatabase();
    await body();
  })()
    .catch((err) => {
      console.error("[shopifyApps] crawl failed:", err);
      crawl.errors.push(err instanceof Error ? err.message : String(err));
    })
    .finally(() => {
      crawl.phase = null;
      crawl.current = null;
      crawl.mode = null;
      crawl.scope = null;
      crawl.finishedAt = new Date();
      crawl.running = null;
    });
  return crawl.running;
}

/** The daily read: the whole tree, every listing, then a first batch of app pages. */
export function startShopifyAppsCrawl(): Promise<void> {
  return run("full", null, async () => {
    const tree = await crawlTree();
    await crawlListings(tree.leaves, tree.complete);
    await crawlDetails({ limit: FULL_SCAN_DETAIL_BATCH });
  });
}

/** The rolling read: the next batch of app pages from the backlog. */
export function startDetailScan(limit = DETAIL_SCAN_BATCH): Promise<void> {
  return run("details", null, () => crawlDetails({ limit }));
}

/** One category now: its listing, then every app in it, freshly read. */
export function startCategoryRead(slug: string): Promise<void> {
  return run("category", slug, async () => {
    const handles = await readOneCategory(slug);
    await crawlDetails({ limit: handles.length, only: handles, force: true });
    await ShopifyAppCategory.updateOne({ slug }, { $set: { lastReadAt: new Date() } });
  });
}
