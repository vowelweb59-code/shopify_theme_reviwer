import { chromium, type Page } from "playwright";
import { contrastRatio, parseColorToRgb } from "./colorContrast";
import type { ExecutedFinding } from "./runRules";

export type LiveCheckResult = {
  findings: ExecutedFinding[];
  error?: { url: string; error: string };
};

const NAV_TIMEOUT_MS = 20_000;
const MAX_CONTRAST_SAMPLES = 80;

type ContrastSample = { selector: string; text: string; color: string; background: string };

type PageFacts = {
  url: string;
  jsonLdTypes: string[];
  canonical: string | null;
  metaDescription: string | null;
  contrastSamples: ContrastSample[];
};

/**
 * Reads real, rendered facts from whatever the page currently has loaded:
 * parsed JSON-LD @types (as the browser actually sees them — catches app-
 * injected schema and Shopify's | structured_data filter output alike,
 * neither of which a static source scan can see), canonical/meta
 * description, and a sample of visible text elements' *computed* color/
 * background — the CSS custom property resolution static analysis has
 * always had to decline (phase-3's A11Y-CONTRAST-001 explicitly limits
 * itself to literal hex/rgb values for exactly this reason; a real browser
 * has no such limitation). Split out from extractPageFacts (which also
 * navigates) so tests can exercise this against page.setContent() with no
 * network dependency.
 */
export async function extractLoadedPageFacts(page: Page, maxSamples: number = MAX_CONTRAST_SAMPLES): Promise<Omit<PageFacts, "url">> {
  return page.evaluate((maxSamples: number) => {
    // Returns null when any ancestor (including the element itself) has a
    // background-image — getComputedStyle can't see image pixel colors, so
    // walking past it to some unrelated solid-color ancestor further up
    // would silently attribute the wrong background to this text entirely.
    // Found testing against a real Shopify store (allbirds.com): hero
    // banner text with no background-color of its own picked up the page
    // body's background several levels up, producing a fabricated "1.21:1"
    // contrast ratio against text that's actually sitting on a photo.
    function resolvedBackground(el: Element): string | null {
      let node: Element | null = el;
      while (node) {
        const style = getComputedStyle(node);
        if (style.backgroundImage && style.backgroundImage !== "none") return null;
        const bg = style.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
        node = node.parentElement;
      }
      const bodyStyle = getComputedStyle(document.body);
      if (bodyStyle.backgroundImage && bodyStyle.backgroundImage !== "none") return null;
      return bodyStyle.backgroundColor;
    }

    // A background-image on an ancestor isn't the only way a photo can sit
    // behind text — at least as common is a separate, absolutely-positioned
    // <img>/<video> sibling filling the same container (a typical hero-
    // banner implementation). getComputedStyle has no way to see that
    // compositing at all; verifying it properly would need pixel sampling
    // from an actual screenshot, which is a much larger undertaking than
    // this check. Bounded-depth, conservative substitute: if an image/video
    // exists anywhere in the element's near container (within a few levels
    // up), treat the background as unverifiable and skip rather than risk
    // a fabricated ratio — found necessary testing against a real store
    // (allbirds.com), where hero text still produced a false "1.21:1"
    // after the background-image check above, because the photo was a
    // sibling <img>, not a CSS background-image.
    function hasNearbyMedia(el: Element): boolean {
      let node: Element | null = el;
      for (let depth = 0; depth < 4 && node; depth++) {
        if (node.querySelector("img, picture, video")) return true;
        node = node.parentElement;
      }
      return false;
    }

    const jsonLdTypes: string[] = [];
    for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        const parsed = JSON.parse(script.textContent ?? "null");
        const type = parsed?.["@type"];
        if (typeof type === "string") jsonLdTypes.push(type);
        else if (Array.isArray(type)) jsonLdTypes.push(...type.filter((t): t is string => typeof t === "string"));
      } catch {
        // malformed JSON-LD on a live page is out of scope for this
        // check — TECH-AEO-VALID-001 covers that from theme source.
      }
    }

    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null;

    const contrastSamples: ContrastSample[] = [];
    const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, a, button, li, span, label"))) {
      const text = (el.textContent ?? "").trim();
      if (text.length < 3 || contrastSamples.length >= maxSamples) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (hasNearbyMedia(el)) continue; // likely sitting over a photo — see hasNearbyMedia's comment

      const background = resolvedBackground(el);
      if (background === null) continue; // sits over a CSS background-image — can't reliably verify contrast

      const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      const selector = el.tagName.toLowerCase() + (classes ? `.${classes}` : "");
      const dedupeKey = `${selector}|${style.color}|${background}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      contrastSamples.push({ selector, text: text.slice(0, 60), color: style.color, background });
    }

    return { jsonLdTypes, canonical, metaDescription, contrastSamples };
  }, maxSamples);
}

async function extractPageFacts(page: Page, url: string): Promise<PageFacts> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  // Brief grace period for client-side/app-injected content (schema,
  // reviews widgets, etc.) to finish rendering before we read the DOM.
  await page.waitForTimeout(1500);
  const facts = await extractLoadedPageFacts(page);
  return { url, ...facts };
}

async function findFirstProductLink(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find((a) => /\/products\//.test(a.href));
    return link?.href ?? null;
  });
}

function contrastFindings(facts: PageFacts): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];
  for (const sample of facts.contrastSamples) {
    const fg = parseColorToRgb(sample.color);
    const bg = parseColorToRgb(sample.background);
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) {
      findings.push({
        ruleId: "LIVE-CONTRAST-001",
        requirementId: "SHOPIFY-A11Y-004",
        filePath: facts.url,
        category: "Accessibility",
        // Capped at medium, not high: hasNearbyMedia/resolvedBackground
        // filter out the common cases of text sitting over a photo, but
        // that check is a bounded heuristic (depth-4 nearby-element scan),
        // not a real compositing analysis — confirmed against a real store
        // that it still lets a few background-image cases through. Treat
        // this as "worth a manual look," not a certainty.
        severity: "medium",
        finding: `"${sample.selector}" text ("${sample.text}") has a real rendered contrast ratio of ${ratio.toFixed(2)}:1 (color: ${sample.color}, background: ${sample.background}) — below the WCAG AA minimum of 4.5:1. Verify manually: this could be a genuine contrast issue, or text over a background image this check couldn't fully rule out.`,
        recommendation: "Increase the contrast between this text color and its background, or confirm this is legitimately a photo overlay with acceptable real-world contrast.",
      });
    }
  }
  return findings;
}

function homepageFindings(facts: PageFacts): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [...contrastFindings(facts)];
  if (!facts.jsonLdTypes.includes("Organization")) {
    findings.push({
      ruleId: "LIVE-JSONLD-ORG-001",
      requirementId: "TECH-AEO-ORG-001",
      filePath: facts.url,
      category: "Technical AEO",
      severity: "medium",
      finding: "No Organization JSON-LD was found on the live rendered homepage.",
      recommendation: "Add an Organization JSON-LD block to the homepage.",
    });
  }
  if (!facts.jsonLdTypes.includes("WebSite")) {
    findings.push({
      ruleId: "LIVE-JSONLD-WEBSITE-001",
      requirementId: "TECH-AEO-WEBSITE-001",
      filePath: facts.url,
      category: "Technical AEO",
      severity: "low",
      finding: "No WebSite JSON-LD was found on the live rendered homepage.",
      recommendation: "Add a WebSite JSON-LD block to the homepage.",
    });
  }
  if (!facts.canonical) {
    findings.push({
      ruleId: "LIVE-SEO-CANONICAL-001",
      requirementId: "SHOPIFY-SEO-001",
      filePath: facts.url,
      category: "Technical SEO",
      severity: "high",
      finding: "No canonical link tag was found on the live rendered homepage.",
      recommendation: 'Add <link rel="canonical"> to the page head.',
    });
  }
  if (!facts.metaDescription) {
    findings.push({
      ruleId: "LIVE-SEO-METADESC-001",
      requirementId: "SHOPIFY-SEO-001",
      filePath: facts.url,
      category: "Technical SEO",
      severity: "medium",
      finding: "No meta description tag was found on the live rendered homepage.",
      recommendation: 'Add a <meta name="description"> tag.',
    });
  }
  return findings;
}

function productPageFindings(facts: PageFacts): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [...contrastFindings(facts)];
  if (!facts.jsonLdTypes.includes("Product")) {
    findings.push({
      ruleId: "LIVE-JSONLD-PRODUCT-001",
      requirementId: "TECH-AEO-PRODUCT-001",
      filePath: facts.url,
      category: "Technical AEO",
      severity: "high",
      finding: "No Product JSON-LD was found on the live rendered product page.",
      recommendation: "Add Product JSON-LD (or Shopify's | structured_data filter) to the product template.",
    });
  }
  if (!facts.jsonLdTypes.includes("BreadcrumbList")) {
    findings.push({
      ruleId: "LIVE-JSONLD-BREADCRUMB-001",
      requirementId: "TECH-AEO-BREADCRUMB-001",
      filePath: facts.url,
      category: "Technical AEO",
      severity: "medium",
      finding: "No BreadcrumbList JSON-LD was found on the live rendered product page.",
      recommendation: "Add a BreadcrumbList JSON-LD block to the product page.",
    });
  }
  return findings;
}

/**
 * Visits a real, running store (homepage, plus the first product page it
 * can find a link to) and checks the things static theme-source analysis
 * structurally cannot: real computed contrast, and JSON-LD/meta tags as
 * actually rendered rather than as they appear in source. A failure here
 * (unreachable URL, navigation timeout) is returned as `error`, never
 * thrown — the static findings for this audit run must stand on their own
 * regardless of whether the live store was reachable.
 */
export async function runLiveChecks(demoStoreUrl: string): Promise<LiveCheckResult> {
  let browser: import("playwright").Browser | undefined;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    const homeFacts = await extractPageFacts(page, demoStoreUrl);
    const findings = homepageFindings(homeFacts);

    const productHref = await findFirstProductLink(page);
    if (productHref) {
      try {
        const productFacts = await extractPageFacts(page, productHref);
        findings.push(...productPageFindings(productFacts));
      } catch {
        // Product page navigation failing doesn't invalidate the homepage
        // findings already collected — skip it and move on.
      }
    }

    return { findings };
  } catch (err) {
    return { findings: [], error: { url: demoStoreUrl, error: err instanceof Error ? err.message : String(err) } };
  } finally {
    await browser?.close();
  }
}
