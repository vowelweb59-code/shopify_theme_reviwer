import { describe, expect, it } from "vitest";
import { extractDemoContent } from "./demoContent";
import { demoRealismFindings } from "./demoRealism";

const BASE = "https://demo.example.com/";
const ids = (html: string, type: "home" | "collection" | "product" = "home") =>
  demoRealismFindings(extractDemoContent(html, BASE), type, BASE).map((f) => f.ruleId);

const img = (n: number, alt = "A real photo") => `<img src="/cdn/shop/files/photo-${n}.jpg" alt="${alt}">`;
const realHome = `<h1>Summer linen</h1><p>Handmade shirts cut in Portugal.</p>${[1, 2, 3, 4, 5].map((n) => img(n)).join("")}`;

describe("extractDemoContent", () => {
  it("reads lazy-loaded images, skips script text, finds product titles and the first real collection", () => {
    const c = extractDemoContent(
      `<script>var lorem ipsum</script><img src="data:image/gif;base64,AAA" data-src="//cdn.example.com/a.jpg" alt="x">
       <a href="/collections/all">All</a><a href="/collections/summer">Summer</a>
       <a href="/products/linen-shirt?variant=1"><span>Linen</span> shirt</a>
       <svg class="placeholder-svg"></svg>`,
      BASE
    );
    expect(c.images).toEqual([{ src: "https://cdn.example.com/a.jpg", alt: "x" }]);
    expect(c.text).not.toMatch(/lorem/);
    expect(c.firstCollectionLink).toBe("https://demo.example.com/collections/summer");
    expect(c.productTitles).toEqual({ "https://demo.example.com/products/linen-shirt": "Linen shirt" });
    expect(c.placeholderSvgCount).toBe(1);
  });
});

describe("demoRealismFindings", () => {
  it("is quiet for a realistic homepage", () => {
    expect(ids(realHome)).toEqual([]);
  });
  it("flags lorem ipsum as high and Shopify's default brand copy", () => {
    const f = demoRealismFindings(extractDemoContent(`<p>Lorem ipsum dolor sit amet</p><p>Share information about your brand</p>${realHome}`, BASE), "home", BASE);
    expect(f.find((x) => x.ruleId === "LIVE-DEMO-TEXT-001")?.severity).toBe("high");
  });
  it("does not mistake 'Add to cart' for a placeholder prompt", () => {
    expect(ids(`<button>Add to cart</button>${realHome}`)).toEqual([]);
  });
  it("flags placeholder svgs and stand-in image files", () => {
    expect(ids(`<svg class="placeholder-svg"></svg><img src="/files/no-image.png" alt="">${realHome}`)).toContain("LIVE-DEMO-IMG-001");
    expect(ids(`<img src="https://picsum.photos/200" alt="">${realHome}`)).toContain("LIVE-DEMO-IMG-001");
  });
  it("flags file-name alt text only when it happens at least twice", () => {
    expect(ids(`${realHome}<img src="/a.jpg" alt="IMG_1234.jpg">`)).not.toContain("LIVE-DEMO-IMG-002");
    expect(ids(`${realHome}<img src="/a.jpg" alt="IMG_1234.jpg"><img src="/b.jpg" alt="dsc 55.png">`)).toContain("LIVE-DEMO-IMG-002");
  });
  it("flags one picture used four times, even at different sizes, but not logos", () => {
    const sized = [1, 2, 3, 4].map((n) => `<img src="/cdn/shop/files/shirt_${n * 100}x.jpg" alt="s">`).join("");
    expect(ids(realHome + sized)).toContain("LIVE-DEMO-IMG-003");
    expect(ids(realHome + `<img src="/logo.png" alt="">`.repeat(5))).not.toContain("LIVE-DEMO-IMG-003");
  });
  it("flags Shopify's sample snowboards and generic names", () => {
    const a = (h: string, t: string) => `<a href="/products/${h}">${t}</a>`;
    expect(ids(realHome + a("x", "The Collection Snowboard: Liquid"))).toContain("LIVE-DEMO-PRODUCT-001");
    expect(ids(realHome + a("y", "Product 3"))).toContain("LIVE-DEMO-PRODUCT-002");
  });
  it("flags a thin collection and a sparse homepage / product page", () => {
    const grid = [1, 2, 3].map((n) => `<a href="/products/p${n}">Shirt ${n}</a>`).join("");
    expect(ids(grid + realHome, "collection")).toContain("LIVE-DEMO-CONTENT-001");
    expect(ids("<p>Hello</p>", "home")).toContain("LIVE-DEMO-CONTENT-002");
    expect(ids(img(1), "product")).toContain("LIVE-DEMO-CONTENT-003");
  });
  it("puts every finding in Theme Store Compliance with the page URL", () => {
    const f = demoRealismFindings(extractDemoContent("<p>Lorem ipsum</p>", BASE), "home", BASE);
    expect(f.every((x) => x.category === "Theme Store Compliance" && x.filePath === BASE && x.ruleId.startsWith("LIVE-DEMO-"))).toBe(true);
  });
});

describe("false-alarm guards", () => {
  it("ignores copy and pictures inside hidden elements", () => {
    const hidden = `<div class="quick-add-modal hidden"><p>Example product title $19.99</p><svg class="placeholder-svg"></svg></div><div aria-hidden="true">Lorem ipsum</div>`;
    expect(ids(hidden + realHome)).toEqual([]);
  });
  it("does not call vector icons or a small share of a big page repeated", () => {
    expect(ids(realHome + `<img src="https://cdn.shopify.com/static/images/flags/au.svg" alt="">`.repeat(6))).toEqual([]);
    const many = Array.from({ length: 40 }, (_, n) => img(n + 10)).join("");
    expect(ids(realHome + many + img(99).repeat(5))).not.toContain("LIVE-DEMO-IMG-003");
  });
});
