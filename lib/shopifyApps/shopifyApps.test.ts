import { describe, expect, it } from "vitest";
import { computeAnalytics, percentileRanks, type AppRow } from "./analytics";
import { stageOfCategory, stagesOfApp } from "./lifecycle";
import { topicsOfApp } from "./topics";
import { featureBelongsTo, featureParts, parseAppCards, parseAppDeepDetail, parseAppDetail, parseCategoryLabel, parseCategoryLinks, pricingModel } from "./parseApps";

const cardHtml = (handle: string, name: string, rating: string | null, reviews: number, pricing: string, bfs = false) =>
  `<div class="tw-w-full" data-controller="app-card" data-app-card-handle-value="${handle}" data-app-card-name-value="${name}">
   <div><span>${rating ? `${rating}<span class="tw-sr-only"> out of 5 stars</span>` : ""}</span>${rating ? `<span class="tw-sr-only">${reviews} total reviews</span>` : ""}
   <span class="tw-overflow-hidden tw-whitespace-nowrap tw-text-ellipsis">${pricing}</span></div>
   <div class="tw-text-fg-secondary tw-text-body-xs">Does a thing &amp; more</div>${bfs ? '<div class="built-for-shopify-badge-container"></div>' : ""}</div>`;

describe("parseAppCards", () => {
  it("reads rating, reviews, pricing label, tagline and badge; dedupes", () => {
    const html = cardHtml("a-app", "A &amp; App", "4.9", 7673, "Free plan available", true) + cardHtml("a-app", "A App", "4.9", 7673, "x") + cardHtml("new-app", "New", null, 0, "Free");
    expect(parseAppCards(html)).toEqual([
      { handle: "a-app", name: "A & App", rating: 4.9, reviewCount: 7673, pricingLabel: "Free plan available", tagline: "Does a thing & more", builtForShopify: true },
      { handle: "new-app", name: "New", rating: null, reviewCount: 0, pricingLabel: "Free", tagline: "Does a thing & more", builtForShopify: false },
    ]);
  });
  it("maps the pricing label to a model", () => {
    expect(["Free", "Free plan available", "Free trial available", "Free to install", "Gratis", null].map(pricingModel)).toEqual(["free", "freemium", "trial", "paid", "unknown", "unknown"]);
  });
});

describe("parseAppDetail / category pages", () => {
  it("reads developer, launch date and the star split", () => {
    const html = `<dt class="x">Developer</dt><dd><a class="l" href="/partners/x"> CWILL INC </a></dd><p>Launched </p><p class="y"> October 7, 2022 &#183 <a>x</a></p>` +
      [5, 4, 3, 2, 1].map((s, i) => `<span class="tw-hidden"> ${[97, 2, 1, 0, 0][i]}% of ratings are ${s} stars </span>`).join("");
    expect(parseAppDetail(html)).toEqual({ developer: "CWILL INC", launchedAt: "2022-10-07", ratingShares: [0, 0, 1, 2, 97] });
  });
  it("is null where the page shows nothing", () => {
    expect(parseAppDetail("<p>nothing</p>")).toEqual({ developer: null, launchedAt: null, ratingShares: null });
  });
  it("finds category links and the label", () => {
    expect(parseCategoryLinks(`<a href="https://apps.shopify.com/categories/store-design?x=1">a</a><a href="https://apps.shopify.com/categories/store-design-content/all">b</a>`).sort()).toEqual(["store-design", "store-design-content"]);
    expect(parseCategoryLabel("<h1 class='a'>\n Email marketing apps </h1>")).toBe("Email marketing");
  });
});

describe("lifecycle", () => {
  it("uses the most specific prefix", () => {
    expect(stageOfCategory("marketing-and-conversion-marketing-email-marketing")).toBe("retain");
    expect(stageOfCategory("marketing-and-conversion-marketing-social-media")).toBe("attract");
    expect(stageOfCategory("store-design-site-optimization-seo")).toBe("attract");
    expect(stageOfCategory("selling-products-payments-subscriptions")).toBe("retain");
    expect(stageOfCategory("orders-and-shipping-returns-and-warranty")).toBe("fulfil");
  });
  it("does not match a prefix inside a longer word, and falls back to scale", () => {
    expect(stageOfCategory("store-designer-tools")).toBe("scale");
  });
  it("lists an app's stages in lifecycle order, once each", () => {
    expect(stagesOfApp(["orders-and-shipping-orders", "finding-products-sourcing-options-wholesale", "orders-and-shipping-inventory"])).toEqual(["source", "fulfil"]);
  });
});

describe("percentileRanks", () => {
  it("ranks 0..1, shares ties, keeps null", () => {
    expect(percentileRanks([10, 30, null, 20, 20])).toEqual([0, 1, null, 0.5, 0.5]);
  });
});

const app = (handle: string, categories: string[], reviewCount: number, rating: number | null, extra: Partial<AppRow> = {}): AppRow => ({
  handle, name: handle, rating, reviewCount, pricingLabel: "Free plan available", builtForShopify: false, categories, developer: null, launchedAt: null, ratingShares: null, ...extra,
});

describe("computeAnalytics", () => {
  // "open": lots of demand spread over weak apps. "locked": little demand, one strong badge-holding incumbent.
  const open = Array.from({ length: 6 }, (_, i) => app(`o${i}`, ["orders-and-shipping-orders"], 500, 4.0, { launchedAt: "2025-06-01" }));
  const locked = [app("l0", ["store-design-content"], 900, 4.9, { builtForShopify: true }), ...Array.from({ length: 5 }, (_, i) => app(`l${i + 1}`, ["store-design-content"], 3, 5))];
  const result = computeAnalytics([...open, ...locked], [{ slug: "orders-and-shipping-orders", label: "Orders" }], new Date("2026-01-01"));

  it("scores the open category above the locked one, with reasons", () => {
    const [first, second] = result.categories;
    expect(first.slug).toBe("orders-and-shipping-orders");
    expect(first.gap!).toBeGreaterThan(second.gap!);
    expect(first.label).toBe("Orders");
    expect(first.reasons.join(" ")).toMatch(/Leaders are rated only 4\.00/);
    expect(first.breakouts).toBe(6);
  });
  it("leaves a category with too few apps unscored", () => {
    const small = computeAnalytics([app("a", ["finding-products"], 10, 4.5)], []);
    expect(small.categories[0].gap).toBeNull();
  });
  it("rolls up stages, launches by year and coverage", () => {
    const fulfil = result.stages.find((s) => s.key === "fulfil")!;
    expect(fulfil).toMatchObject({ apps: 6, reviews: 3000, categories: 1, launchesByYear: { "2025": 6 } });
    expect(result.coverage).toEqual({ apps: 12, withDetails: 6 });
    expect(result.launchYears).toEqual([2025]);
  });
});

describe("topics and finer levels", () => {
  it("reads topics from name and tagline without matching inside longer words", () => {
    expect(topicsOfApp("Fast SMS Marketing", "Recover abandoned carts by WhatsApp")).toEqual(expect.arrayContaining(["sms", "abandoned-cart"]));
    expect(topicsOfApp("Starter Kit", "Optimize your store")).toEqual([]);
  });
  const sms = (i: number, cat: string) => app(`s${i}`, [cat], 100, 4.5, { name: "SMS Pro", tagline: "text messages" });
  const mail = (i: number, cat: string) => app(`m${i}`, [cat], 100, 4.5, { name: "Mailer", tagline: "newsletter email" });
  const rows = [...[1, 2, 3, 4, 5].map((i) => sms(i, "marketing-and-conversion-marketing-email-marketing")), ...[1, 2, 3, 4, 5].map((i) => mail(i, "marketing-and-conversion-marketing-email-marketing")), sms(9, "orders-and-shipping-orders")];
  it("splits a category into niches, dropping ones with fewer than 5 apps", () => {
    const niches = computeAnalytics(rows, [{ slug: "marketing-and-conversion-marketing-email-marketing", label: "Email marketing" }], new Date(), "niche").categories;
    expect(niches.map((c) => c.label).sort()).toEqual(["Email marketing › Email", "Email marketing › SMS & WhatsApp"]);
    expect(niches[0].stage).toBe("retain");
  });
  it("groups a topic across categories once per app, in its most common stage", () => {
    const topics = computeAnalytics(rows, [], new Date(), "topic").categories;
    const smsTopic = topics.find((c) => c.slug === "topic::sms")!;
    expect(smsTopic.apps).toBe(6);
    expect(smsTopic.stage).toBe("retain");
  });
});

describe("parseAppDeepDetail", () => {
  const li = (t: string) => `<li class="x"><span>${t}</span> <li>`; // the store leaves these <li> unclosed
  const html = `<script type="application/ld+json">{"@type":"SoftwareApplication","name":"A","description":"Answers &amp; more"}</script>
    <p class="tw-col-span-full sm:tw-col-span-1 h">Languages</p><div class="c"><p>English, German, and French</p></div>
    <p class="tw-col-span-full sm:tw-col-span-1 h">Works with</p><ul class="c"><li class="i"><a>Checkout</a></li><li class="i"><a>Shopify Admin</a></li></ul></div></div><div data-controller="accordion">
    <a href="https://apps.shopify.com/categories/x/all?feature_handles%5B%5D=cf.faq.display_options.search_bar&amp;locale=en"> Search bar </a>
    <a href="https://apps.shopify.com/categories/x/all?feature_handles%5B%5D=cf.faq.display_options.search_bar&amp;surface=1">Search bar</a>
    <a href="https://apps.shopify.com/categories/x/all?feature_handles%5B%5D=cf.chat.customization.chat_flows">Chat flows</a>
    <div data-pricing-component-target="cardHeading"><p data-test-id="name"> Free </p><h3 aria-label="Free"></h3>
      <ul data-test-id="features">${li("5 questions")}${li("Basic styling")}</ul></div>
    <div data-pricing-component-target="cardHeading"><p data-test-id="name"> Pro </p><h3 aria-label="$9/month"></h3><p data-test-id="additional-charges"> Billed yearly </p>
      <ul data-test-id="features">${li("Unlimited questions")}</ul></div>`;

  it("reads description, features (deduped), plans with their bullets, languages and works-with", () => {
    const d = parseAppDeepDetail(html);
    expect(d.description).toBe("Answers & more");
    expect(d.features).toEqual([
      { handle: "cf.faq.display_options.search_bar", label: "Search bar" },
      { handle: "cf.chat.customization.chat_flows", label: "Chat flows" },
    ]);
    expect(d.plans).toEqual([
      { name: "Free", price: "Free", note: null, features: ["5 questions", "Basic styling"] },
      { name: "Pro", price: "$9/month", note: "Billed yearly", features: ["Unlimited questions"] },
    ]);
    expect(d.languages).toEqual(["English", "German", "French"]);
    expect(d.worksWith).toEqual(["Checkout", "Shopify Admin"]);
  });
  it("is empty where the page shows nothing", () => {
    expect(parseAppDeepDetail("<p>nothing</p>")).toEqual({ description: null, features: [], plans: [], languages: [], worksWith: [] });
  });
});

describe("feature handles and the FAQ category", () => {
  it("splits a handle into its category key and group", () => {
    expect(featureParts("cf.faq.display_options.search_bar")).toEqual({ category: "faq", group: "Display options" });
    expect(featureParts("something-else")).toBeNull();
  });
  it("matches a handle's category key to the end of a category slug", () => {
    expect(featureBelongsTo("cf.faq.display_options.search_bar", "store-management-support-faq")).toBe(true);
    expect(featureBelongsTo("cf.bulk_editor.x.y", "store-management-operations-bulk-editor")).toBe(true);
    expect(featureBelongsTo("cf.chat.customization.chat_flows", "store-management-support-faq")).toBe(false);
  });
  it("puts FAQ with conversion while the rest of support stays with retention", () => {
    expect(stageOfCategory("store-management-support-faq")).toBe("convert");
    expect(stageOfCategory("store-management-support-chat")).toBe("retain");
  });
});
