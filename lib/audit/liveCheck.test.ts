import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkResponsiveReachability, extractLoadedPageFacts } from "./liveCheck";

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
