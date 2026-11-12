import { describe, expect, it } from "vitest";
import { AVAILABLE_FEATURES } from "./availableFeatures";
import { detectLiveFeatures, LIVE_CHECKABLE } from "./liveFeatures";

describe("detectLiveFeatures", () => {
  it("recognises features from their markup", () => {
    const html = `<cart-drawer id="CartDrawer"></cart-drawer><product-recommendations></product-recommendations>
      <a href="/blogs/news/spring">Blog</a><div class="quick-add"></div><nav class="breadcrumb"></nav><div class="swatch-input"></div>`;
    expect(detectLiveFeatures(html).sort()).toEqual(["blogs", "breadcrumbs", "color-swatches", "quick-buy", "recommended-products", "slide-out-cart"]);
  });
  it("ignores names that only appear in inline scripts, styles and comments", () => {
    const html = `<script>window.x = {"cart-drawer": 1, "predictive-search": 1}</script><style>.mega-menu{}</style><!-- quick-view -->`;
    expect(detectLiveFeatures(html)).toEqual([]);
  });
  it("matches visible text such as a stock counter", () => {
    expect(detectLiveFeatures("<p>Only 3 left in stock</p>")).toContain("stock-counter");
  });
  it("only names features that exist in the catalog", () => {
    const ids = new Set(AVAILABLE_FEATURES.map((f) => f.id));
    expect([...LIVE_CHECKABLE].every((id) => ids.has(id))).toBe(true);
  });
});
