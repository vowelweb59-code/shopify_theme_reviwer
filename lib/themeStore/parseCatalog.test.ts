import { describe, expect, it } from "vitest";
import { parseCatalogCards, parseCompanionApp, parseDesigner, parseLastPage } from "./parseCatalog";

const card = (base: string, preset: string, title: string, extra: string) =>
  `<a aria-label="Details" href="/themes/${base}/presets/${preset}?surface_inter_position=1&amp;surface_intra_position=1&amp;surface_type=all"><picture></picture><div><p class="t">${title}</p><div><data value="${extra}">x</data></div></div></a>`;

describe("parseCatalogCards", () => {
  it("reads name, price, badge and rating off a card", () => {
    const html = `<a aria-label="d" href="/themes/adam/presets/adam?surface_inter_position=1&amp;surface_intra_position=1&amp;surface_type=all"><p>Adam</p><div><data value="290.00"> $290 </data><span role="status"> New </span><div aria-label="43% positive"></div></div></a>`;
    expect(parseCatalogCards(html)).toEqual([{ baseSlug: "adam", presetSlug: "adam", name: "Adam", price: 290, isNew: true, positivePercent: 43 }]);
  });

  it("keeps a free theme at 0 and dedupes repeated cards", () => {
    const html = card("colorblock", "colorblock", "Colorblock", "0.00") + card("colorblock", "colorblock", "Colorblock", "0.00") + card("colorblock", "pop", "Pop", "0.00");
    const cards = parseCatalogCards(html);
    expect(cards.map((c) => [c.presetSlug, c.price])).toEqual([["colorblock", 0], ["pop", 0]]);
  });

  it("ignores links that aren't catalog cards", () => {
    expect(parseCatalogCards(`<a href="/themes/dawn/presets/dawn">Dawn</a>`)).toEqual([]);
  });
});

describe("parseLastPage / parseDesigner", () => {
  it("finds the last page in the pager, with or without other params", () => {
    expect(parseLastPage(`<a href="/themes?page=2">2</a><a href="/themes?industry%5B%5D=art&amp;page=7">7</a>`)).toBe(7);
    expect(parseLastPage("<p>none</p>")).toBe(1);
  });
  it("reads the designer", () => {
    expect(parseDesigner(`<p class="x">\n  by <a class="l" href="#ReleaseNotes">Archetype Themes</a></p>`)).toBe("Archetype Themes");
    expect(parseDesigner("<p>nothing</p>")).toBeNull();
  });
});

describe("parseCompanionApp", () => {
  it("reads the suggested app off a theme page", () => {
    const html = `<section data-companion-app-section><a href="https://apps.shopify.com/crawl-hunt?x=1" data-companion-app-listing-link><span data-companion-app-name>CrawlHunt - Fix SEO</span><span data-companion-app-subtitle>Improve &amp; fix</span></a><dd data-companion-app-pricing-summary>Free plan available</dd></section>`;
    expect(parseCompanionApp(html)).toEqual({ name: "CrawlHunt - Fix SEO", subtitle: "Improve & fix", url: "https://apps.shopify.com/crawl-hunt", pricing: "Free plan available" });
  });
  it("is null when the page has no such section", () => {
    expect(parseCompanionApp("<p>Features</p>")).toBeNull();
  });
});
