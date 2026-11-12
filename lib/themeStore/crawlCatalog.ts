import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { fetchPublicText, sleep } from "@/lib/net/fetchPublic";
import { INDUSTRIES } from "@/lib/themes/industries";
import { fetchThemeStoreListingBySlug } from "@/lib/themes/themeStoreFeatures";
import { syncThemesFromCatalog } from "@/lib/themes/syncFromCatalog";
import { ThemeStoreTheme } from "@/models/theme-store-theme";
import { parseCatalogCards, parseCompanionApp, parseDesigner, parseLastPage, type CatalogCard } from "./parseCatalog";

// Reads every theme on themes.shopify.com in three steps, in the background,
// with progress the tab polls (same shape as lib/partners/crawlPartners.ts):
//   1. the whole catalog, page by page — name, price, rating, presets, order;
//   2. one pass per industry collection — which categories each theme is in;
//   3. each theme's own page — designer, features, reviews, latest version.
// Step 3 only reads themes not read in the last week (or not yet checked for a suggested app).

const LISTING = "https://themes.shopify.com/themes";
const PAUSE_MS = 1_500;
const RATE_LIMIT_WAIT_MS = 90_000;
const MAX_PAGES = 200; // safety net; the full catalog is ~55 pages
const DETAIL_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

type Phase = "catalog" | "categories" | "details";
type CrawlState = { running: Promise<void> | null; phase: Phase | null; total: number; done: number; current: string | null; themesSeen: number; errors: string[]; finishedAt: Date | null };
const g = globalThis as typeof globalThis & { _themeStoreCrawl?: CrawlState };
const crawl = (g._themeStoreCrawl ??= { running: null, phase: null, total: 0, done: 0, current: null, themesSeen: 0, errors: [], finishedAt: null });

export function themeStoreCrawlProgress() {
  return { running: crawl.running !== null, phase: crawl.phase, total: crawl.total, done: crawl.done, current: crawl.current, themesSeen: crawl.themesSeen, errors: crawl.errors, finishedAt: crawl.finishedAt };
}


async function fetchListing(url: string): Promise<string> {
  return fetchPublicText(url, { attempts: 3, rateLimitWaitMs: RATE_LIMIT_WAIT_MS });
}

/** Every card of a listing (the whole catalog, or one industry), in the store's own order. Throws if any page fails, so a partial read never passes for a full one. */
async function crawlListing(query: string | null, onPage?: (cards: CatalogCard[]) => void): Promise<CatalogCard[]> {
  const all: CatalogCard[] = [];
  let lastPage = 1;
  for (let page = 1; page <= Math.min(lastPage, MAX_PAGES); page++) {
    if (page > 1) await sleep(PAUSE_MS);
    const html = await fetchListing(`${LISTING}?${[query, `page=${page}`].filter(Boolean).join("&")}`);
    if (page === 1) lastPage = parseLastPage(html);
    const cards = parseCatalogCards(html);
    if (cards.length === 0) break;
    all.push(...cards);
    onPage?.(cards);
  }
  return all;
}

const titleCase = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

async function crawlCatalog(): Promise<void> {
  crawl.phase = "catalog";
  crawl.current = "all themes";
  crawl.total = 0;
  crawl.done = 0;
  const cards = await crawlListing(null, (page) => (crawl.themesSeen += page.length));
  if (cards.length === 0) throw new Error("The catalog came back empty.");

  const byTheme = new Map<string, { base: CatalogCard | null; first: CatalogCard; presets: { slug: string; name: string }[]; rank: number | null }>();
  cards.forEach((card, i) => {
    const entry = byTheme.get(card.baseSlug) ?? { base: null, first: card, presets: [], rank: i + 1 };
    entry.presets.push({ slug: card.presetSlug, name: card.name });
    if (card.presetSlug === card.baseSlug) {
      entry.base = card;
      entry.rank = i + 1;
    }
    byTheme.set(card.baseSlug, entry);
  });

  const now = new Date();
  // The price each theme had before this read, so a change can be added to its price history.
  const before = new Map(
    (await ThemeStoreTheme.find({}).select("slug price priceHistory firstSeenAt").lean<{ slug: string; price: number | null; priceHistory?: { price: number; at: Date }[]; firstSeenAt: Date }[]>()).map((r) => [r.slug, r])
  );
  await ThemeStoreTheme.bulkWrite(
    [...byTheme].map(([slug, t]) => {
      const main = t.base ?? t.first;
      const prev = before.get(slug);
      const history = prev?.priceHistory ?? [];
      const lastKnown = history.length > 0 ? history[history.length - 1].price : (prev?.price ?? null);
      // A card with no price says nothing about the price. Otherwise record when it differs from the last known price; a theme read
      // before history existed first gets its old price as the starting point.
      const entries: { price: number; at: Date }[] = [];
      if (main.price !== null && main.price !== lastKnown) {
        if (prev && history.length === 0 && prev.price !== null) entries.push({ price: prev.price, at: prev.firstSeenAt });
        entries.push({ price: main.price, at: now });
      } else if (prev && history.length === 0 && main.price !== null) entries.push({ price: main.price, at: prev.firstSeenAt });
      return {
        updateOne: {
          filter: { slug },
          update: {
            // A theme's name comes from its default preset's card; a theme whose default card isn't listed keeps the name its page gave it.
            $set: { ...(t.base ? { name: t.base.name } : {}), price: main.price, isNew: main.isNew, presets: t.presets, rank: t.rank, lastSeenAt: now, ...(main.positivePercent !== null ? { positivePercent: main.positivePercent } : {}) },
            $setOnInsert: { firstSeenAt: now, ...(t.base ? {} : { name: titleCase(slug) }), ...(prev ? {} : { priceHistory: main.price !== null ? [{ price: main.price, at: now }] : [] }) },
            ...(prev && entries.length > 0 ? { $push: { priceHistory: { $each: entries } } } : {}),
          },
          upsert: true,
        },
      };
    }) as never
  );
  crawl.themesSeen = byTheme.size;
}

async function crawlCategories(): Promise<void> {
  crawl.phase = "categories";
  crawl.total = INDUSTRIES.length;
  crawl.done = 0;
  for (const { slug, label } of INDUSTRIES) {
    crawl.current = label;
    await sleep(PAUSE_MS);
    try {
      const cards = await crawlListing(`industry[]=${slug}`);
      // Only the main theme's own card counts; a preset showing up in a category doesn't put the theme there.
      const slugs = [...new Set(cards.filter((c) => c.presetSlug === c.baseSlug).map((c) => c.baseSlug))];
      await ThemeStoreTheme.updateMany({ slug: { $in: slugs } }, { $addToSet: { industries: slug } });
      await ThemeStoreTheme.updateMany({ slug: { $nin: slugs } }, { $pull: { industries: slug } });
    } catch (err) {
      crawl.errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
    crawl.done++;
  }
}

async function crawlDetails(): Promise<void> {
  crawl.phase = "details";
  const stale = await ThemeStoreTheme.find({ $or: [{ detailAt: null }, { companionAppAt: null }, { detailAt: { $lt: new Date(Date.now() - DETAIL_FRESH_MS) } }] })
    .sort({ rank: 1 })
    .select("slug")
    .lean<{ slug: string }[]>();
  crawl.total = stale.length;
  crawl.done = 0;
  let failures = 0;
  for (const { slug } of stale) {
    crawl.current = slug;
    await sleep(PAUSE_MS);
    let result = await fetchThemeStoreListingBySlug(slug);
    // The store's bot protection intermittently 403s a request that succeeds moments later.
    for (const wait of [5_000, 20_000]) {
      if (result.ok || !/\b(403|429)\b/.test(result.error)) break;
      await sleep(wait);
      result = await fetchThemeStoreListingBySlug(slug);
    }
    if (result.ok) {
      failures = 0;
      await ThemeStoreTheme.updateOne(
        { slug },
        {
          $set: {
            designer: result.html ? parseDesigner(result.html) : null,
            features: result.features,
            reviewCount: result.reviewCount,
            positivePercent: result.positivePercent,
            latestVersion: result.latestVersion,
            latestVersionReleasedAt: result.latestVersionReleasedAt,
            companionApp: result.html ? parseCompanionApp(result.html) : null,
            companionAppAt: new Date(),
            detailAt: new Date(),
            detailError: null,
          },
        }
      );
    } else {
      crawl.errors.push(`${slug}: ${result.error}`);
      // detailAt stays unset so the next refresh tries this theme again.
      await ThemeStoreTheme.updateOne({ slug }, { $set: { detailError: result.error } });
      // A run of failures means the store is blocking us; stop and let a later run resume.
      if (++failures >= 5) throw new Error(`Stopped after repeated failures: ${result.error}`);
    }
    crawl.done++;
  }
}

/** Starts a full read of the Theme Store in the background (no-op if one is already running). Resolves when the read ends, whether or not it was this call that started it. */
export function startThemeStoreCrawl(): Promise<void> {
  if (crawl.running) return crawl.running;
  crawl.errors = [];
  crawl.done = 0;
  crawl.total = 0;
  crawl.themesSeen = 0;
  crawl.finishedAt = null;
  crawl.running = (async () => {
    await connectToDatabase();
    await crawlCatalog();
    // Our own themes learn whether they are live as soon as the catalog is read, and pick up the details once those are read.
    await syncThemesFromCatalog().catch((err) => console.error("[themeStore] theme sync failed:", err));
    await crawlCategories();
    await crawlDetails();
    await syncThemesFromCatalog().catch((err) => console.error("[themeStore] theme sync failed:", err));
  })()
    .catch((err) => {
      console.error("[themeStore] crawl failed:", err);
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
