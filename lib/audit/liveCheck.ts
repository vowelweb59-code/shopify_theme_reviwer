import { chromium, type Page } from "playwright";
import { contrastRatio, parseColorToRgb } from "./colorContrast";
import type { ExecutedFinding } from "./runRules";

export type LiveCheckResult = {
  findings: ExecutedFinding[];
  error?: { url: string; error: string };
};

export type PresetLink = { label: string; url: string };
export type PresetLiveCheckError = { label: string; url: string; error: string };

export type MultiPresetLiveCheckResult = {
  findings: ExecutedFinding[];
  errors: PresetLiveCheckError[];
};

const NAV_TIMEOUT_MS = 20_000;
const MAX_CONTRAST_SAMPLES = 80;
const MAX_IMAGE_SAMPLES = 60;
const MAX_FOCUS_SAMPLES = 40;

// Every element type WCAG 2.4.7 (Focus Visible) actually applies to —
// deliberately broader than the tags this parser tracks statically
// elsewhere, since this check reads real rendered elements, not source.
const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]';

// Sits between the two most common Shopify breakpoint conventions (mobile
// menu appears below ~749px; desktop-only chrome — social icons,
// language/country selector — appears above ~990px). A theme whose two
// breakpoints don't line up leaves this width range as a dead zone where
// neither version is shown. Found from a real review report describing
// exactly this: footer social icons and the header language/country
// selector both invisible at an "intermediate" width despite working fine
// on both mobile and desktop.
const MEDIUM_VIEWPORT = { width: 900, height: 800 };

type ContrastSample = { selector: string; text: string; color: string; background: string };
type ImageSample = { selector: string; naturalWidth: number; naturalHeight: number; renderedWidth: number; renderedHeight: number };
type TouchTargetSample = { selector: string; width: number; height: number };

export type PageFacts = {
  url: string;
  jsonLdTypes: string[];
  canonical: string | null;
  metaDescription: string | null;
  contrastSamples: ContrastSample[];
  imageSamples: ImageSample[];
  touchTargetSamples: TouchTargetSample[];
  devicePixelRatio: number;
  /**
   * Every `.shopify-section` wrapper's id (the `shopify-section-` prefix
   * stripped) — Shopify's layout rendering wraps every section in this
   * exact markup unconditionally, so this is a reliable, theme-agnostic
   * read of "which sections are actually rendered on this page", useful
   * for comparePresets() below without any extra page load.
   */
  sectionIds: string[];
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
export async function extractLoadedPageFacts(
  page: Page,
  maxSamples: number = MAX_CONTRAST_SAMPLES,
  maxImageSamples: number = MAX_IMAGE_SAMPLES
): Promise<Omit<PageFacts, "url">> {
  return page.evaluate(({ maxSamples, maxImageSamples }: { maxSamples: number; maxImageSamples: number }) => {
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

    // Compares each image's real source resolution against how large it's
    // actually rendered (accounting for the display's device pixel ratio,
    // since a retina display legitimately needs 2-3x the CSS pixel
    // dimensions to render crisply) — an objective, measurable stand-in for
    // "this asset is low-resolution/pixelated", rather than the editorial
    // "professional-quality imagery" judgment call SHOPIFY-DESIGN-VISUAL-001
    // otherwise requires a human to make.
    const imageSamples: ImageSample[] = [];
    for (const img of Array.from(document.querySelectorAll("img"))) {
      if (imageSamples.length >= maxImageSamples) break;
      const rect = img.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) continue; // icon-sized — upscaling is imperceptible at this size
      if (!img.complete || img.naturalWidth === 0) continue; // not loaded, or broken — out of scope here
      const style = getComputedStyle(img);
      if (style.visibility === "hidden" || style.display === "none") continue;

      const classes = typeof img.className === "string" ? img.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      const selector = "img" + (classes ? `.${classes}` : "") + (img.alt ? `[alt="${img.alt.slice(0, 40)}"]` : "");
      imageSamples.push({
        selector,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: rect.width,
        renderedHeight: rect.height,
      });
    }

    // Real controls only: an inline text link (e.g. "read more" mid-
    // paragraph) is explicitly exempt from the 24x24 minimum, so only
    // non-inline-display links are sampled alongside buttons/role="button"
    // elements and button-type inputs — the elements the requirement
    // actually targets.
    const TOUCH_TARGET_MAX_SAMPLES = 80;
    const touchTargetSamples: { selector: string; width: number; height: number }[] = [];
    const touchTargetCandidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], a'
      )
    );
    for (const el of touchTargetCandidates) {
      if (touchTargetSamples.length >= TOUCH_TARGET_MAX_SAMPLES) break;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (el.tagName === "A" && style.display === "inline") continue; // inline text link — exempt
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      const selector = el.tagName.toLowerCase() + (classes ? `.${classes}` : "");
      touchTargetSamples.push({ selector, width: rect.width, height: rect.height });
    }

    const sectionIds = Array.from(document.querySelectorAll(".shopify-section"))
      .map((el) => el.id.replace(/^shopify-section-/, ""))
      .filter(Boolean);

    return {
      jsonLdTypes,
      canonical,
      metaDescription,
      contrastSamples,
      imageSamples,
      touchTargetSamples,
      devicePixelRatio: window.devicePixelRatio,
      sectionIds,
    };
  }, { maxSamples, maxImageSamples });
}

async function extractPageFacts(page: Page, url: string): Promise<PageFacts> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  // Brief grace period for client-side/app-injected content (schema,
  // reviews widgets, etc.) to finish rendering before we read the DOM.
  await page.waitForTimeout(1500);
  const facts = await extractLoadedPageFacts(page);
  return { url, ...facts };
}

export async function findFirstProductLink(page: Page): Promise<string | null> {
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

// A margin below the exact device-pixel-ratio threshold — some upscaling
// (a few percent) is imperceptible depending on image content and viewing
// distance; only flag images that are clearly short of what the display
// needs, not every image with any degree of scaling at all.
const IMAGE_RESOLUTION_TOLERANCE = 0.9;

function imageResolutionFindings(facts: PageFacts): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];
  for (const img of facts.imageSamples) {
    const requiredWidth = img.renderedWidth * facts.devicePixelRatio;
    if (img.naturalWidth < requiredWidth * IMAGE_RESOLUTION_TOLERANCE) {
      findings.push({
        ruleId: "LIVE-IMAGE-RESOLUTION-001",
        requirementId: "SHOPIFY-DESIGN-DEMOSTORE-001",
        filePath: facts.url,
        category: "Theme Store Compliance",
        severity: "medium",
        finding: `Image "${img.selector}" is displayed at ${Math.round(img.renderedWidth)}×${Math.round(img.renderedHeight)}px on a ${facts.devicePixelRatio}x-density display (needs roughly ${Math.round(requiredWidth)}px wide to stay crisp), but its source is only ${img.naturalWidth}×${img.naturalHeight}px — it will likely appear blurred or pixelated.`,
        recommendation: "Upload a higher-resolution version of this image, or reduce the size it's displayed at.",
      });
    }
  }
  return findings;
}

// Shopify's own stated bar (WCAG 2.5.8) — 24x24 CSS pixels, with the same
// inline-text-link exception already filtered out at sampling time.
const TOUCH_TARGET_MIN_SIZE = 24;

function touchTargetFindings(facts: PageFacts): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];
  for (const sample of facts.touchTargetSamples) {
    if (sample.width >= TOUCH_TARGET_MIN_SIZE && sample.height >= TOUCH_TARGET_MIN_SIZE) continue;
    findings.push({
      ruleId: "LIVE-A11Y-TOUCH-TARGET-001",
      requirementId: "SHOPIFY-A11Y-006",
      filePath: facts.url,
      category: "Accessibility",
      severity: "medium",
      finding: `"${sample.selector}" renders at ${Math.round(sample.width)}×${Math.round(sample.height)}px — below the 24×24 CSS pixel minimum touch target size.`,
      recommendation: "Increase this control's rendered size (padding, min-width/min-height) to at least 24×24 CSS pixels.",
    });
  }
  return findings;
}

function homepageFindings(facts: PageFacts): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [...contrastFindings(facts), ...imageResolutionFindings(facts), ...touchTargetFindings(facts)];
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
  const findings: ExecutedFinding[] = [...contrastFindings(facts), ...imageResolutionFindings(facts), ...touchTargetFindings(facts)];
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

type FocusIndicatorSample = { selector: string; hasIndicator: boolean; mechanism?: string };

/**
 * For each real focusable element: read its computed style, actually call
 * .focus() on it (not a CSS :focus-visible simulation — a real DOM focus
 * event, so this catches JS-driven focus styling too, not just CSS rules),
 * re-read computed style, and check whether anything a sighted user could
 * actually see changed. Distinct from the static A11Y-OUTLINE-REMOVAL-001
 * rule: that one flags the specific "outline:none with no CSS :focus
 * replacement" source anti-pattern; this instead verifies the real,
 * rendered end result on real elements, catching indicators that
 * genuinely don't show (however they were supposed to be produced) as
 * well as ones that do work despite CSS that looks suspicious in isolation.
 * Never asserts *which* mechanism every element should use — only whether
 * *some* visible change happens, matching "consistent" as "reliably
 * visible", not "identical styling".
 */
export async function collectFocusIndicatorSamples(page: Page): Promise<FocusIndicatorSample[]> {
  return page.evaluate(
    ({ selector, maxSamples }: { selector: string; maxSamples: number }) => {
      function relevantStyle(style: CSSStyleDeclaration) {
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
          borderWidth: style.borderWidth,
          borderColor: style.borderColor,
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      }

      const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = getComputedStyle(el);
        return style.visibility !== "hidden" && style.display !== "none";
      });

      const samples: FocusIndicatorSample[] = [];
      const previouslyFocused = document.activeElement;

      for (const el of candidates.slice(0, maxSamples)) {
        const before = relevantStyle(getComputedStyle(el));
        el.focus({ preventScroll: true });
        // Some elements refuse focus outright (disabled, covered by
        // another element at the same point, etc.) — nothing to measure.
        if (document.activeElement !== el) continue;
        const after = relevantStyle(getComputedStyle(el));
        el.blur();

        const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
        const sampleSelector = el.tagName.toLowerCase() + (classes ? `.${classes}` : "");

        let mechanism: string | undefined;
        if (after.outlineStyle !== "none" && (before.outlineStyle !== after.outlineStyle || before.outlineWidth !== after.outlineWidth || before.outlineColor !== after.outlineColor)) {
          mechanism = "outline";
        } else if (after.boxShadow !== "none" && before.boxShadow !== after.boxShadow) {
          mechanism = "box-shadow";
        } else if (after.borderWidth !== "0px" && (before.borderWidth !== after.borderWidth || before.borderColor !== after.borderColor)) {
          mechanism = "border";
        } else if (before.backgroundColor !== after.backgroundColor) {
          mechanism = "background-color";
        } else if (before.color !== after.color) {
          mechanism = "color";
        }

        samples.push({ selector: sampleSelector, hasIndicator: !!mechanism, mechanism });
      }

      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
      return samples;
    },
    { selector: FOCUSABLE_SELECTOR, maxSamples: MAX_FOCUS_SAMPLES }
  );
}

/**
 * One finding summarizing every element that showed no visible change on
 * real focus, rather than one per element — a theme missing focus styles
 * theme-wide would otherwise produce dozens of near-identical findings.
 */
export async function focusIndicatorFindings(page: Page, url: string): Promise<ExecutedFinding[]> {
  const samples = await collectFocusIndicatorSamples(page);
  const failing = samples.filter((s) => !s.hasIndicator);
  if (failing.length === 0) return [];

  const examples = failing.slice(0, 5).map((s) => s.selector).join(", ");
  return [
    {
      ruleId: "LIVE-A11Y-FOCUS-INDICATOR-001",
      requirementId: "A11Y-BP-002",
      filePath: url,
      category: "Accessibility",
      severity: "medium",
      finding: `${failing.length} of ${samples.length} focusable elements sampled show no visible change when actually focused (e.g. ${examples}) — keyboard users have no way to tell where focus currently is.`,
      recommendation: "Give every focusable element a visible :focus/:focus-visible style — an outline, box-shadow, border, or background/color change from its normal state. Different elements don't need identical styling, just a reliably visible one.",
    },
  ];
}

type ReachabilityFacts = {
  hasSocialLinks: boolean;
  socialReachable: boolean;
  hasLocalizationSelect: boolean;
  localizationReachable: boolean;
};

// Reused across the "before" and "after clicking a menu trigger" checks —
// kept identical in both so a change in reachability can only come from a
// real DOM/style change, not a difference in how reachability is judged.
function evaluateReachabilityInPage(): ReachabilityFacts {
  function isReachable(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    if ((el as HTMLElement).offsetParent === null && style.position !== "fixed") return false;
    return true;
  }

  const SOCIAL_DOMAIN_RE = /(facebook|instagram|twitter|x\.com|tiktok|pinterest|youtube|snapchat|linkedin)\.com/i;
  const socialLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).filter((a) => SOCIAL_DOMAIN_RE.test(a.href));
  // Shopify's own {% form 'localization' %} tag renders these exact field
  // names — a reliable, theme-agnostic signal, unlike guessing at class
  // names custom to any one theme's markup.
  const localizationSelects = Array.from(
    document.querySelectorAll<HTMLSelectElement>('select[name="locale_code"], select[name="country_code"]')
  );

  return {
    hasSocialLinks: socialLinks.length > 0,
    socialReachable: socialLinks.some(isReachable),
    hasLocalizationSelect: localizationSelects.length > 0,
    localizationReachable: localizationSelects.some(isReachable),
  };
}

function findAndClickMenuTriggerInPage(): boolean {
  function isReachable(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    if ((el as HTMLElement).offsetParent === null && style.position !== "fixed") return false;
    return true;
  }
  const trigger = Array.from(document.querySelectorAll<HTMLElement>('button, summary, [role="button"]')).find((el) => {
    if (!isReachable(el)) return false;
    const label = (el.getAttribute("aria-label") || el.textContent || "").toLowerCase();
    return /menu|navigation/.test(label);
  });
  trigger?.click();
  return !!trigger;
}

/**
 * Resizes to a viewport width that commonly falls between Shopify's two
 * usual breakpoints (mobile menu below ~749px, desktop-only chrome above
 * ~990px) and checks whether the footer's social links and the header's
 * language/country selector are still visible or reachable — and if not,
 * whether a visible menu control reveals them. Only clicks the *first*
 * matching trigger it finds, so a theme with separate triggers for nav vs.
 * localization could still under-report; that's a known limitation, not a
 * guarantee of full coverage.
 */
export async function checkResponsiveReachability(page: Page): Promise<ExecutedFinding[]> {
  const originalViewport = page.viewportSize();
  await page.setViewportSize(MEDIUM_VIEWPORT);

  const before = await page.evaluate(evaluateReachabilityInPage);
  const needsRescue = (before.hasSocialLinks && !before.socialReachable) || (before.hasLocalizationSelect && !before.localizationReachable);

  let after = before;
  if (needsRescue) {
    const clicked = await page.evaluate(findAndClickMenuTriggerInPage);
    if (clicked) {
      await page.waitForTimeout(400);
      after = await page.evaluate(evaluateReachabilityInPage);
    }
  }

  const findings: ExecutedFinding[] = [];
  const url = page.url();
  if (before.hasSocialLinks && !before.socialReachable && !after.socialReachable) {
    findings.push({
      ruleId: "LIVE-RESPONSIVE-SOCIAL-001",
      requirementId: "SHOPIFY-SOCIAL-ICONS-001",
      filePath: url,
      category: "Theme Store Compliance",
      severity: "medium",
      finding: `At a ${MEDIUM_VIEWPORT.width}px viewport width, the footer's social media links are not visible, and no visible menu control revealed them either. Verify manually — this check only tries the first menu-like control it finds, and can't rule out a different mechanism revealing them.`,
      recommendation: "Check where the desktop social icons and the mobile menu each switch on — there may be a width range between them where neither is shown.",
    });
  }
  if (before.hasLocalizationSelect && !before.localizationReachable && !after.localizationReachable) {
    findings.push({
      ruleId: "LIVE-RESPONSIVE-LOCALIZATION-001",
      requirementId: "SHOPIFY-FEATURES-LANGUAGE-SELECT-001",
      filePath: url,
      category: "Theme Store Compliance",
      severity: "medium",
      finding: `At a ${MEDIUM_VIEWPORT.width}px viewport width, the language/country selector is not visible, and no visible menu control revealed it either. Verify manually — this check only tries the first menu-like control it finds, and can't rule out a different mechanism revealing it.`,
      recommendation: "Check where the desktop selector and the mobile menu each switch on — there may be a width range between them where neither is shown.",
    });
  }

  if (originalViewport) await page.setViewportSize(originalViewport);
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
type PresetCheckOutcome = { findings: ExecutedFinding[]; home: PageFacts; product?: PageFacts };

/** The actual check battery, given a page already inside some browser context — shared by the single- and multi-preset entry points below so there's exactly one implementation of "what checks run against one preset". */
async function runChecksForLoadedPreset(page: Page, label: string | null, demoStoreUrl: string): Promise<PresetCheckOutcome> {
  const homeFacts = await extractPageFacts(page, demoStoreUrl);
  const findings = homepageFindings(homeFacts);
  // Must run before checkResponsiveReachability, which resizes the
  // viewport and would otherwise contaminate the focus-style measurements.
  findings.push(...(await focusIndicatorFindings(page, demoStoreUrl)));
  findings.push(...(await checkResponsiveReachability(page)));

  let productFacts: PageFacts | undefined;
  const productHref = await findFirstProductLink(page);
  if (productHref) {
    try {
      productFacts = await extractPageFacts(page, productHref);
      findings.push(...productPageFindings(productFacts));
      findings.push(...(await focusIndicatorFindings(page, productHref)));
    } catch {
      // Product page navigation failing doesn't invalidate the homepage
      // findings already collected — skip it and move on.
    }
  }

  if (label) for (const f of findings) f.presetLabel = label;
  return { findings, home: homeFacts, product: productFacts };
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
export async function runLiveChecksForPreset(label: string, demoStoreUrl: string): Promise<LiveCheckResult> {
  let browser: import("playwright").Browser | undefined;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const { findings } = await runChecksForLoadedPreset(page, label, demoStoreUrl);
    return { findings };
  } catch (err) {
    return { findings: [], error: { url: demoStoreUrl, error: err instanceof Error ? err.message : String(err) } };
  } finally {
    await browser?.close();
  }
}

// The margin at which two presets' rendered section counts are treated as
// "the same layout, presets are allowed to differ a little" rather than a
// real structural drift worth flagging — one section added/removed for
// seasonal content is normal; a homepage with half as many sections as its
// sibling preset is a genuine inconsistency.
const SECTION_COUNT_DRIFT_THRESHOLD = 2;

type PresetFacts = { label: string; home: PageFacts; product?: PageFacts };

/**
 * The "presets should be in sync" check (an internal quality standard, not
 * a documented Shopify rule — see INTERNAL-PRESET-SYNC-001), comparing
 * every preset's *actually rendered* homepage (and product page, where
 * both sides have one) against the first-listed preset, treated as "the
 * main theme" baseline the way the user framed it. Deliberately compares
 * rendered output, not config/settings_data.json: each preset is a
 * genuinely separate published theme install with its own admin-configured
 * content, so a live comparison catches real drift a static file diff
 * can't — verified against the Theme Store's own multi-preset themes
 * (e.g. Prestige), where each preset resolves to a distinct live store.
 */
export function comparePresets(presets: PresetFacts[]): ExecutedFinding[] {
  if (presets.length < 2) return [];
  const [baseline, ...rest] = presets;
  const findings: ExecutedFinding[] = [];

  for (const preset of rest) {
    for (const page of ["home", "product"] as const) {
      const basePage = baseline[page];
      const thisPage = preset[page];
      if (!basePage || !thisPage) continue; // one preset has no product page found — nothing to compare there

      const pageLabel = page === "home" ? "homepage" : "product page";
      const sectionDiff = Math.abs(basePage.sectionIds.length - thisPage.sectionIds.length);
      if (sectionDiff >= SECTION_COUNT_DRIFT_THRESHOLD) {
        findings.push({
          ruleId: "LIVE-PRESET-SYNC-SECTIONS-001",
          requirementId: "INTERNAL-PRESET-SYNC-001",
          filePath: thisPage.url,
          category: "Internal Standard",
          severity: "medium",
          finding: `Preset "${preset.label}"'s ${pageLabel} renders ${thisPage.sectionIds.length} sections, versus ${basePage.sectionIds.length} on the baseline preset "${baseline.label}"'s ${pageLabel} (${basePage.url}) — a structural difference of ${sectionDiff}. Confirm this is an intentional design difference between presets, not a preset that's fallen out of sync.`,
          recommendation: `Compare the ${pageLabel} section composition between "${baseline.label}" and "${preset.label}" and reconcile any sections that were added to one preset but not carried over to the other.`,
        });
      }

      const missingTypes = basePage.jsonLdTypes.filter((t) => !thisPage.jsonLdTypes.includes(t));
      if (missingTypes.length > 0) {
        findings.push({
          ruleId: "LIVE-PRESET-SYNC-JSONLD-001",
          requirementId: "INTERNAL-PRESET-SYNC-001",
          filePath: thisPage.url,
          category: "Internal Standard",
          severity: "medium",
          finding: `Preset "${preset.label}"'s ${pageLabel} is missing ${missingTypes.join(", ")} JSON-LD that the baseline preset "${baseline.label}"'s ${pageLabel} (${basePage.url}) has.`,
          recommendation: `Check why "${preset.label}" doesn't render the same structured data as "${baseline.label}" on this page — a disabled app/section, or a genuine regression in this preset.`,
        });
      }

      if (basePage.canonical && !thisPage.canonical) {
        findings.push({
          ruleId: "LIVE-PRESET-SYNC-METADATA-001",
          requirementId: "INTERNAL-PRESET-SYNC-001",
          filePath: thisPage.url,
          category: "Internal Standard",
          severity: "medium",
          finding: `Preset "${preset.label}"'s ${pageLabel} has no canonical link tag, but the baseline preset "${baseline.label}"'s ${pageLabel} does.`,
          recommendation: `Add a canonical link tag to "${preset.label}"'s ${pageLabel}, matching "${baseline.label}".`,
        });
      }
      if (basePage.metaDescription && !thisPage.metaDescription) {
        findings.push({
          ruleId: "LIVE-PRESET-SYNC-METADATA-001",
          requirementId: "INTERNAL-PRESET-SYNC-001",
          filePath: thisPage.url,
          category: "Internal Standard",
          severity: "medium",
          finding: `Preset "${preset.label}"'s ${pageLabel} has no meta description, but the baseline preset "${baseline.label}"'s ${pageLabel} does.`,
          recommendation: `Add a meta description to "${preset.label}"'s ${pageLabel}, matching "${baseline.label}".`,
        });
      }
    }
  }

  return findings;
}

/**
 * Runs the full live-check battery against every preset's demo URL, using
 * one browser (a fresh context per preset, not N separate browser
 * processes), then — once 2+ presets actually succeeded — runs
 * comparePresets() across their collected page facts and appends its
 * findings too. A single preset's demo being unreachable is recorded in
 * `errors` and does not prevent the others (or the comparison, if 2+ of
 * the rest still succeeded) from running.
 */
export async function runLiveChecksForPresets(presets: PresetLink[]): Promise<MultiPresetLiveCheckResult> {
  const findings: ExecutedFinding[] = [];
  const errors: PresetLiveCheckError[] = [];
  const presetFacts: PresetFacts[] = [];

  let browser: import("playwright").Browser | undefined;
  try {
    browser = await chromium.launch();
    for (const preset of presets) {
      let context: import("playwright").BrowserContext | undefined;
      try {
        context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await context.newPage();
        const outcome = await runChecksForLoadedPreset(page, preset.label, preset.url);
        findings.push(...outcome.findings);
        presetFacts.push({ label: preset.label, home: outcome.home, product: outcome.product });
      } catch (err) {
        errors.push({ label: preset.label, url: preset.url, error: err instanceof Error ? err.message : String(err) });
      } finally {
        await context?.close();
      }
    }
  } finally {
    await browser?.close();
  }

  if (presetFacts.length >= 2) findings.push(...comparePresets(presetFacts));

  return { findings, errors };
}
