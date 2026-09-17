import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  checkResponsiveReachability,
  collectFocusIndicatorSamples,
  comparePresets,
  extractLoadedPageFacts,
  focusIndicatorFindings,
  isNavigationTimeoutError,
  withNavigationRetry,
  type PageFacts,
} from "./liveCheck";

describe("isNavigationTimeoutError", () => {
  it("matches Playwright's own navigation timeout message", () => {
    expect(isNavigationTimeoutError(new Error('page.goto: Timeout 20000ms exceeded.\nCall log:\n  - navigating to "https://example.com/"'))).toBe(true);
  });

  it("does not match an unrelated error", () => {
    expect(isNavigationTimeoutError(new Error("getaddrinfo ENOTFOUND example.com"))).toBe(false);
  });

  it("does not match a non-Error value", () => {
    expect(isNavigationTimeoutError("Timeout 20000ms exceeded")).toBe(false);
  });
});

describe("withNavigationRetry", () => {
  it("returns the result on a successful first attempt without retrying", async () => {
    const attempt = vi.fn().mockResolvedValue("ok");
    await expect(withNavigationRetry(attempt)).resolves.toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once after a navigation timeout, then returns the second attempt's result", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error("page.goto: Timeout 20000ms exceeded."))
      .mockResolvedValueOnce("ok on retry");
    await expect(withNavigationRetry(attempt)).resolves.toBe("ok on retry");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("propagates a second consecutive timeout instead of retrying again", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("page.goto: Timeout 20000ms exceeded."));
    await expect(withNavigationRetry(attempt)).rejects.toThrow("Timeout 20000ms exceeded.");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-timeout error", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND example.com"));
    await expect(withNavigationRetry(attempt)).rejects.toThrow("getaddrinfo ENOTFOUND example.com");
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

// Real browser, no network — page.setContent() has no network dependency,
// so these run against Chromium's actual layout/style engine (the same one
// used against a real store) rather than a JS-only DOM mock.
describe("extractLoadedPageFacts", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  }, 30_000);

  afterAll(async () => {
    await browser.close();
  });

  it("does not flag text with good contrast against a solid background", async () => {
    await page.setContent(
      '<body style="background:#fff"><p style="color:#111">Plenty of contrast here</p></body>'
    );
    const facts = await extractLoadedPageFacts(page);
    const sample = facts.contrastSamples.find((s) => s.text.includes("Plenty of contrast"));
    expect(sample).toBeDefined();
    expect(sample?.background).not.toBe(null);
  });

  it("captures a sample with a genuinely poor contrast pairing", async () => {
    await page.setContent(
      '<body style="background:#fff"><p style="color:#f5f5f5">Nearly invisible text</p></body>'
    );
    const facts = await extractLoadedPageFacts(page);
    const sample = facts.contrastSamples.find((s) => s.text.includes("Nearly invisible"));
    expect(sample).toBeDefined();
    expect(sample?.color).toBe("rgb(245, 245, 245)");
  });

  // Regression test: found testing against a real Shopify store
  // (allbirds.com) — hero text sitting over a photo (not a CSS
  // background-image, a separate <img> element) produced a fabricated
  // "1.21:1" ratio against an unrelated ancestor's solid background-color,
  // since getComputedStyle can't see what an <img> visually renders.
  it("skips a text sample whose nearby container also contains an <img>", async () => {
    await page.setContent(
      '<body><div style="position:relative;background:#eceae2">' +
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="position:absolute;inset:0">' +
        '<h1 style="color:#fff;position:relative">Hero text over a photo</h1>' +
        "</div></body>"
    );
    const facts = await extractLoadedPageFacts(page);
    const sample = facts.contrastSamples.find((s) => s.text.includes("Hero text over a photo"));
    expect(sample).toBeUndefined();
  });

  it("skips a text sample sitting directly over a CSS background-image", async () => {
    await page.setContent(
      '<body><div style="background-image: url(data:image/gif;base64,R0lGODlhAQABAAAAACw=)">' +
        '<p style="color:#fff">Text over a CSS background-image</p>' +
        "</div></body>"
    );
    const facts = await extractLoadedPageFacts(page);
    const sample = facts.contrastSamples.find((s) => s.text.includes("Text over a CSS background-image"));
    expect(sample).toBeUndefined();
  });

  it("extracts rendered JSON-LD @type values", async () => {
    await page.setContent(
      '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Test"}</script></head><body></body></html>'
    );
    const facts = await extractLoadedPageFacts(page);
    expect(facts.jsonLdTypes).toContain("Organization");
  });

  it("extracts canonical and meta description", async () => {
    await page.setContent(
      '<html><head><link rel="canonical" href="https://example.com/"><meta name="description" content="A test page"></head><body></body></html>'
    );
    const facts = await extractLoadedPageFacts(page);
    expect(facts.canonical).toBe("https://example.com/");
    expect(facts.metaDescription).toBe("A test page");
  });

  it("samples an image's natural vs. rendered size and the page's device pixel ratio", async () => {
    await page.setContent(
      `<body><img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'/>" style="width:300px;height:300px"></body>`
    );
    const facts = await extractLoadedPageFacts(page);
    expect(facts.imageSamples).toHaveLength(1);
    expect(facts.imageSamples[0]).toMatchObject({ naturalWidth: 20, naturalHeight: 20, renderedWidth: 300, renderedHeight: 300 });
    expect(facts.devicePixelRatio).toBeGreaterThan(0);
  });

  it("skips icon-sized images when sampling for resolution", async () => {
    await page.setContent(
      `<body><img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'/>" style="width:20px;height:20px"></body>`
    );
    const facts = await extractLoadedPageFacts(page);
    expect(facts.imageSamples).toHaveLength(0);
  });

  it("flags a real touch-target sample undersized below 24x24 CSS pixels", async () => {
    await page.setContent('<body><button style="width:16px;height:16px;padding:0;border:0">×</button></body>');
    const facts = await extractLoadedPageFacts(page);
    expect(facts.touchTargetSamples).toHaveLength(1);
    expect(facts.touchTargetSamples[0].width).toBeLessThan(24);
  });

  it("does not sample an inline text link mid-paragraph (exempt from the touch-target minimum)", async () => {
    await page.setContent('<body><p>Some text with an <a href="/x" style="display:inline">inline link</a> in it.</p></body>');
    const facts = await extractLoadedPageFacts(page);
    expect(facts.touchTargetSamples).toHaveLength(0);
  });

  it("does sample a block-level link styled as a button", async () => {
    await page.setContent('<body><a href="/x" style="display:inline-block;width:16px;height:16px">Go</a></body>');
    const facts = await extractLoadedPageFacts(page);
    expect(facts.touchTargetSamples).toHaveLength(1);
  });

  it("reads rendered section ids from .shopify-section wrappers", async () => {
    await page.setContent(
      '<body>' +
        '<div id="shopify-section-hero" class="shopify-section">Hero</div>' +
        '<div id="shopify-section-featured-collection" class="shopify-section">Collection</div>' +
        '<div id="not-a-section">Ignore me</div>' +
        "</body>"
    );
    const facts = await extractLoadedPageFacts(page);
    expect(facts.sectionIds.sort()).toEqual(["featured-collection", "hero"]);
  });

  it("returns no section ids when the page has none", async () => {
    await page.setContent("<body><div>No sections here</div></body>");
    const facts = await extractLoadedPageFacts(page);
    expect(facts.sectionIds).toEqual([]);
  });
});

// Real focus() calls in a real Chromium page — not a CSS :focus-visible
// simulation — so this exercises the same mechanism a keyboard user's tab
// key actually triggers.
describe("collectFocusIndicatorSamples / focusIndicatorFindings", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  }, 30_000);

  afterAll(async () => {
    await browser.close();
  });

  it("recognizes an outline change as a visible focus indicator", async () => {
    await page.setContent(
      '<body><button style="outline:none" onfocus="this.style.outline=\'2px solid blue\'">Go</button></body>'
    );
    const samples = await collectFocusIndicatorSamples(page);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ hasIndicator: true, mechanism: "outline" });
  });

  it("recognizes a box-shadow change as a visible focus indicator", async () => {
    await page.setContent(
      '<body><a href="/x" style="outline:none" onfocus="this.style.boxShadow=\'0 0 0 2px blue\'">Link</a></body>'
    );
    const samples = await collectFocusIndicatorSamples(page);
    expect(samples[0]).toMatchObject({ hasIndicator: true, mechanism: "box-shadow" });
  });

  it("flags a focusable element whose style never changes on focus", async () => {
    await page.setContent('<body><button style="outline:none">Go</button></body>');
    const samples = await collectFocusIndicatorSamples(page);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ hasIndicator: false });
  });

  it("skips a hidden focusable element entirely", async () => {
    await page.setContent('<body><button style="display:none">Hidden</button></body>');
    const samples = await collectFocusIndicatorSamples(page);
    expect(samples).toHaveLength(0);
  });

  it("restores whatever had focus before sampling", async () => {
    await page.setContent(
      '<body><input id="already-focused" style="outline:none"><button style="outline:none">Go</button></body>'
    );
    await page.focus("#already-focused");
    await collectFocusIndicatorSamples(page);
    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("already-focused");
  });

  it("produces one summarizing finding, not one per failing element", async () => {
    await page.setContent(
      '<body><button style="outline:none">A</button><button style="outline:none">B</button></body>'
    );
    const findings = await focusIndicatorFindings(page, "https://example.myshopify.com/");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: "LIVE-A11Y-FOCUS-INDICATOR-001", requirementId: "A11Y-BP-002" });
    expect(findings[0].finding).toContain("2 of 2");
  });

  it("produces no finding when every sampled element shows a visible focus change", async () => {
    await page.setContent(
      '<body><button onfocus="this.style.outline=\'2px solid blue\'">A</button></body>'
    );
    const findings = await focusIndicatorFindings(page, "https://example.myshopify.com/");
    expect(findings).toHaveLength(0);
  });
});

// Pure function — no browser needed, just hand-built PageFacts.
function makeFacts(overrides: Partial<PageFacts> = {}): PageFacts {
  return {
    url: "https://example.myshopify.com/",
    jsonLdTypes: ["Organization", "WebSite"],
    canonical: "https://example.myshopify.com/",
    metaDescription: "A test store",
    contrastSamples: [],
    imageSamples: [],
    touchTargetSamples: [],
    devicePixelRatio: 1,
    sectionIds: ["hero", "featured-collection", "footer"],
    ...overrides,
  };
}

describe("comparePresets", () => {
  it("reports nothing for a single preset — there's nothing to compare against", () => {
    expect(comparePresets([{ label: "Only preset", home: makeFacts() }])).toEqual([]);
  });

  it("reports nothing when two presets' homepages render the same structure", () => {
    const findings = comparePresets([
      { label: "Baseline", home: makeFacts() },
      { label: "Sibling", home: makeFacts() },
    ]);
    expect(findings).toEqual([]);
  });

  it("flags a preset whose homepage renders materially fewer sections than the baseline", () => {
    const findings = comparePresets([
      { label: "Baseline", home: makeFacts({ sectionIds: ["hero", "featured-collection", "footer", "testimonials"] }) },
      { label: "Thin", home: makeFacts({ sectionIds: ["hero"] }) },
    ]);
    const sectionFinding = findings.find((f) => f.ruleId === "LIVE-PRESET-SYNC-SECTIONS-001");
    expect(sectionFinding).toBeDefined();
    expect(sectionFinding?.finding).toContain("Thin");
    expect(sectionFinding?.finding).toContain("Baseline");
    expect(sectionFinding?.requirementId).toBe("INTERNAL-PRESET-SYNC-001");
  });

  it("does not flag a small, expected section-count difference", () => {
    const findings = comparePresets([
      { label: "Baseline", home: makeFacts({ sectionIds: ["hero", "featured-collection", "footer"] }) },
      { label: "Sibling", home: makeFacts({ sectionIds: ["hero", "featured-collection"] }) },
    ]);
    expect(findings.find((f) => f.ruleId === "LIVE-PRESET-SYNC-SECTIONS-001")).toBeUndefined();
  });

  it("flags a preset missing JSON-LD the baseline has", () => {
    const findings = comparePresets([
      { label: "Baseline", home: makeFacts({ jsonLdTypes: ["Organization", "WebSite"] }) },
      { label: "Missing schema", home: makeFacts({ jsonLdTypes: ["WebSite"] }) },
    ]);
    const jsonLdFinding = findings.find((f) => f.ruleId === "LIVE-PRESET-SYNC-JSONLD-001");
    expect(jsonLdFinding).toBeDefined();
    expect(jsonLdFinding?.finding).toContain("Organization");
  });

  it("flags a preset missing canonical/meta description the baseline has", () => {
    const findings = comparePresets([
      { label: "Baseline", home: makeFacts({ canonical: "https://a.myshopify.com/", metaDescription: "Has one" }) },
      { label: "Missing metadata", home: makeFacts({ canonical: null, metaDescription: null }) },
    ]);
    const metadataFindings = findings.filter((f) => f.ruleId === "LIVE-PRESET-SYNC-METADATA-001");
    expect(metadataFindings).toHaveLength(2); // canonical AND meta description
  });

  it("compares the product page too when both presets have one", () => {
    const findings = comparePresets([
      { label: "Baseline", home: makeFacts(), product: makeFacts({ jsonLdTypes: ["Product", "BreadcrumbList"] }) },
      { label: "Sibling", home: makeFacts(), product: makeFacts({ jsonLdTypes: ["BreadcrumbList"] }) },
    ]);
    const jsonLdFinding = findings.find((f) => f.ruleId === "LIVE-PRESET-SYNC-JSONLD-001");
    expect(jsonLdFinding?.finding).toContain("product page");
    expect(jsonLdFinding?.finding).toContain("Product");
  });

  it("skips a page comparison when only one side has that page at all", () => {
    // Baseline has no product page found; sibling does — nothing to compare against.
    const findings = comparePresets([
      { label: "Baseline", home: makeFacts() },
      { label: "Sibling", home: makeFacts(), product: makeFacts({ jsonLdTypes: [] }) },
    ]);
    expect(findings.find((f) => f.finding.includes("product page"))).toBeUndefined();
  });

  it("compares every non-baseline preset against the first-listed baseline, not against each other", () => {
    const findings = comparePresets([
      { label: "Baseline", home: makeFacts({ sectionIds: ["hero", "featured-collection", "footer", "testimonials"] }) },
      { label: "Thin A", home: makeFacts({ sectionIds: ["hero"] }) },
      { label: "Thin B", home: makeFacts({ sectionIds: ["hero", "footer"] }) },
    ]);
    const labels = findings.filter((f) => f.ruleId === "LIVE-PRESET-SYNC-SECTIONS-001").map((f) => f.finding);
    expect(labels.some((f) => f.includes("Thin A"))).toBe(true);
    expect(labels.some((f) => f.includes("Thin B"))).toBe(true);
    expect(labels.every((f) => f.includes("Baseline"))).toBe(true);
  });
});

describe("checkResponsiveReachability", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  }, 30_000);

  afterAll(async () => {
    await browser.close();
  });

  it("flags social links that are hidden with no visible menu control to reveal them", async () => {
    await page.setContent('<body><footer><a href="https://facebook.com/store" style="display:none">FB</a></footer></body>');
    const findings = await checkResponsiveReachability(page);
    expect(findings.map((f) => f.ruleId)).toContain("LIVE-RESPONSIVE-SOCIAL-001");
  });

  it("does not flag social links revealed by clicking a visible menu control", async () => {
    await page.setContent(
      '<body>' +
        '<footer><a id="fb" href="https://facebook.com/store" style="display:none">FB</a></footer>' +
        '<button aria-label="Menu" onclick="document.getElementById(\'fb\').style.display=\'inline\'">Menu</button>' +
        "</body>"
    );
    const findings = await checkResponsiveReachability(page);
    expect(findings.map((f) => f.ruleId)).not.toContain("LIVE-RESPONSIVE-SOCIAL-001");
  });

  it("does not flag anything when the theme has no social links at all", async () => {
    await page.setContent("<body><footer></footer></body>");
    const findings = await checkResponsiveReachability(page);
    expect(findings).toHaveLength(0);
  });

  it("flags a hidden language/country selector with no visible menu control to reveal it", async () => {
    await page.setContent('<body><select name="locale_code" style="display:none"><option>EN</option></select></body>');
    const findings = await checkResponsiveReachability(page);
    expect(findings.map((f) => f.ruleId)).toContain("LIVE-RESPONSIVE-LOCALIZATION-001");
  });

  it("does not flag a visible, reachable language selector", async () => {
    await page.setContent('<body><select name="locale_code"><option>EN</option></select></body>');
    const findings = await checkResponsiveReachability(page);
    expect(findings).toHaveLength(0);
  });
});
