// Capability topics mined from Shopify Theme Store release notes.
//
// The regexes were NOT written from general knowledge — each one was derived
// from the highest-frequency n-grams actually present in the harvested notes
// (see harvest-release-notes.mjs), then widened to catch the phrasing
// variants different designers use for the same capability.
//
// `category` groups points for the /enhancements UI. `id` is stable and is
// what EnhancementPoint.pointId stores, so re-running the aggregation never
// renumbers existing points.

export const TOPICS = [
  // --- Content & media -------------------------------------------------
  {
    id: "TREND-MEDIA-001",
    name: "Video and 3D media in galleries",
    category: "Content & Media",
    re: /\bvideo\b|3d model|model viewer|media gallery/i,
  },
  {
    id: "TREND-MEDIA-002",
    name: "Image focal points and art direction",
    category: "Content & Media",
    re: /focal point|art direction|aspect ratio|responsive image/i,
  },
  {
    id: "TREND-MEDIA-003",
    name: "Before/after image comparison slider",
    category: "Content & Media",
    re: /before.{0,6}after/i,
  },
  {
    id: "TREND-MEDIA-004",
    name: "Size chart / sizing guide",
    category: "Content & Media",
    re: /size (chart|guide)/i,
  },

  // --- Merchandising ---------------------------------------------------
  {
    id: "TREND-MERCH-001",
    name: "Product recommendations and recently viewed",
    category: "Merchandising",
    re: /product recommendation|complementary product|related product|recently viewed/i,
  },
  {
    id: "TREND-MERCH-002",
    name: "Announcement bar",
    category: "Merchandising",
    re: /announcement bar/i,
  },
  {
    id: "TREND-MERCH-003",
    name: "Countdown timers and urgency cues",
    category: "Merchandising",
    re: /countdown|urgency|stock counter/i,
  },
  {
    id: "TREND-MERCH-004",
    name: "Inventory and back-in-stock messaging",
    category: "Merchandising",
    re: /inventory|back in stock|low stock|out of stock/i,
  },
  {
    id: "TREND-MERCH-005",
    name: "Discount and promotion display",
    category: "Merchandising",
    re: /discount code|automatic discount|promo code/i,
  },
  {
    id: "TREND-MERCH-006",
    name: "Product bundles",
    category: "Merchandising",
    // /\bbundle/ also matched "CSS bundle sizes" and "bundled assets".
    re: /\bbundles?\b(?![- ](size|split))|bundle (section|product|builder|discount)|custom bundle/i,
  },
  {
    id: "TREND-MERCH-007",
    name: "Reviews and user-generated content",
    category: "Merchandising",
    re: /product review|star rating|\bugc\b/i,
  },
  {
    id: "TREND-MERCH-008",
    name: "Wishlist / saved items",
    category: "Merchandising",
    // /favourite|favorite/ matched "Favorite Collection" and "favorite colors".
    re: /wishlist|wish list|saved items|save for later/i,
  },

  // --- Theme customization --------------------------------------------
  {
    id: "TREND-CUSTOM-001",
    name: "Typography and font-scale controls",
    category: "Theme Customization",
    re: /font (size|family|weight)|typograph/i,
  },
  {
    id: "TREND-CUSTOM-002",
    name: "Color schemes and dark mode",
    category: "Theme Customization",
    re: /dark mode|color scheme/i,
  },
  {
    id: "TREND-CUSTOM-003",
    name: "Theme blocks and app blocks",
    category: "Theme Customization",
    re: /theme block|app block|section group|blocks in section/i,
  },
  {
    id: "TREND-CUSTOM-004",
    name: "Sticky headers, bars and add-to-cart",
    category: "Theme Customization",
    re: /sticky (header|cart|add to cart|bar|atc)/i,
  },
  {
    id: "TREND-CUSTOM-005",
    name: "Web components / custom elements architecture",
    category: "Theme Customization",
    re: /web component|custom element/i,
  },

  // --- Product discovery ----------------------------------------------
  {
    id: "TREND-DISCOVERY-001",
    name: "Native color and image swatches",
    category: "Product Discovery",
    re: /(native|shopify).{0,25}swatch|swatch (config|metafield|picker)|color swatch/i,
  },
  {
    id: "TREND-DISCOVERY-002",
    name: "Mega menu navigation",
    category: "Product Discovery",
    re: /mega menu/i,
  },
  {
    id: "TREND-DISCOVERY-003",
    name: "Predictive search",
    category: "Product Discovery",
    re: /predictive search/i,
  },
  {
    id: "TREND-DISCOVERY-004",
    name: "Search & Discovery app filters",
    category: "Product Discovery",
    re: /search (&|and) discovery|search-and-discovery|discovery app|visual filter|filter (swatch|value)/i,
  },
  {
    id: "TREND-DISCOVERY-005",
    name: "Variant picker patterns",
    category: "Product Discovery",
    re: /variant picker|variant selector/i,
  },
  {
    id: "TREND-DISCOVERY-006",
    name: "Infinite scroll / load-more pagination",
    category: "Product Discovery",
    re: /infinite scroll|load more/i,
  },
  {
    id: "TREND-DISCOVERY-007",
    name: "Store locator and local pickup",
    category: "Product Discovery",
    re: /store locator|store pickup|local pickup/i,
  },

  // --- Cart & checkout -------------------------------------------------
  {
    id: "TREND-CART-001",
    name: "Cart drawer",
    category: "Cart & Checkout",
    re: /cart drawer|drawer cart/i,
  },
  {
    id: "TREND-CART-002",
    name: "Shop Pay and accelerated checkout",
    category: "Cart & Checkout",
    re: /shop pay|checkout extension|accelerated checkout|express checkout/i,
  },
  {
    id: "TREND-CART-003",
    name: "Free-shipping and delivery messaging",
    category: "Cart & Checkout",
    re: /free shipping|delivery date|shipping (calculator|estimator)/i,
  },
  {
    id: "TREND-CART-004",
    name: "Gift card recipient form",
    category: "Cart & Checkout",
    re: /gift card recipient|recipient form/i,
  },

  // --- Platform integration -------------------------------------------
  {
    id: "TREND-PLATFORM-001",
    name: "Metaobjects and metafields",
    category: "Platform Integration",
    re: /metaobject|metafield/i,
  },
  {
    id: "TREND-PLATFORM-002",
    name: "Combined listings",
    category: "Platform Integration",
    re: /combined listing/i,
  },
  {
    id: "TREND-PLATFORM-003",
    name: "Volume and quantity pricing",
    category: "Platform Integration",
    re: /volume pricing|quantity pric|quantity rule|quantity break/i,
  },
  {
    id: "TREND-PLATFORM-004",
    name: "Quick order list",
    category: "Platform Integration",
    re: /quick order list/i,
  },
  {
    id: "TREND-PLATFORM-005",
    name: "B2B and company accounts",
    category: "Platform Integration",
    re: /\bb2b\b|company (account|location)|wholesale/i,
  },
  {
    id: "TREND-PLATFORM-006",
    name: "New customer accounts",
    category: "Platform Integration",
    re: /new customer account|customer account.{0,20}(new|extension)|shopify account/i,
  },
  {
    id: "TREND-PLATFORM-007",
    name: "Subscriptions and selling plans",
    category: "Platform Integration",
    re: /subscription|selling plan/i,
  },
  {
    id: "TREND-PLATFORM-008",
    name: "Agentic commerce and storefront events",
    category: "Platform Integration",
    re: /storefront (events|actions)|agentic|\bai\b assistant|ai agent|agent cart|chatgpt|llms?\.txt/i,
  },

  // --- Internationalization -------------------------------------------
  {
    id: "TREND-I18N-001",
    name: "Translations and multi-language storefronts",
    category: "Internationalization",
    re: /translat|multi.?lang|\bi18n\b/i,
  },
  {
    id: "TREND-I18N-002",
    name: "Markets, currency and country selectors",
    category: "Internationalization",
    re: /\bmarkets?\b.{0,20}(localiz|currenc|domain)|country selector|currency selector|localization/i,
  },
  {
    id: "TREND-I18N-003",
    name: "Right-to-left (RTL) layout support",
    category: "Internationalization",
    re: /\brtl\b|right.to.left/i,
  },

  // --- Accessibility & performance ------------------------------------
  {
    id: "TREND-A11Y-001",
    name: "Accessibility remediation",
    category: "Accessibility",
    re: /accessib|\ba11y\b|wcag|screen reader|aria[- ]|keyboard navigation|focus (state|outline|ring|trap)|contrast ratio/i,
  },
  {
    id: "TREND-PERF-001",
    name: "Core Web Vitals and load performance",
    category: "Performance",
    // /preload/ without a boundary matched slideshow "preloader" copy.
    re: /core web vital|\bcls\b|\blcp\b|lighthouse|\binp\b|lazy ?load|\bdefer(red|ring)?\b|\bpreload\b|\bprefetch\b|performance score|speed score/i,
  },
  {
    id: "TREND-PERF-002",
    name: "Progressive web app / offline support",
    category: "Performance",
    re: /\bpwa\b|service worker|offline/i,
  },

  // --- SEO & AEO -------------------------------------------------------
  {
    id: "TREND-SEO-001",
    name: "Structured data / JSON-LD",
    category: "SEO & AEO",
    re: /structured data|json-?ld|schema\.org|rich (result|snippet)|microdata/i,
  },

  // --- Trust & compliance ---------------------------------------------
  {
    id: "TREND-TRUST-001",
    name: "Email and newsletter capture",
    category: "Trust & Compliance",
    re: /newsletter|email (signup|capture|popup)/i,
  },
  {
    id: "TREND-TRUST-002",
    name: "Age verification gate",
    category: "Trust & Compliance",
    re: /age verif|age gate/i,
  },
  {
    id: "TREND-TRUST-003",
    name: "Privacy, consent and GDPR handling",
    category: "Trust & Compliance",
    re: /gdpr|cookie (banner|consent)|privacy|consent (mode|banner)|customer privacy/i,
  },
  {
    id: "TREND-TRUST-004",
    name: "Security hardening and output escaping",
    category: "Trust & Compliance",
    // A bare /security/ matched OS/battery notes and /escape/ matched
    // "escape key handler", so both are narrowed to security-work phrasing.
    re: /\bxss\b|sanitiz|escape (the |any )?(html|output|liquid|user)|security (fix|patch|update|hardening|issue|vulnerab)|vulnerabilit/i,
  },

  // --- Round 2 (2026-09-11): mined deeper from the same corpus, not a new
  // fetch. Each of these was checked against every regex above and kept
  // only when most of its matching notes were NOT already counted by an
  // existing topic — see .scratch/candidate-check.mjs at the time this was
  // written (not committed; a one-off overlap check, same spirit as the
  // n-gram mining that produced the original 47).
  {
    id: "TREND-DISCOVERY-008",
    name: "Quick view / quick add modal",
    category: "Product Discovery",
    re: /quick view|quick add|quick buy/i,
  },
  {
    id: "TREND-MERCH-009",
    name: "Social follow buttons",
    category: "Merchandising",
    re: /follow button|social (media )?icon|linkedin|facebook.{0,10}icon|instagram.{0,10}icon/i,
  },
  {
    id: "TREND-CUSTOM-006",
    name: "Collapsible content / accordion blocks",
    category: "Theme Customization",
    re: /collapsible content|accordion/i,
  },
  {
    id: "TREND-CUSTOM-007",
    name: "Transparent/overlay header",
    category: "Theme Customization",
    re: /transparent header|header overlay|overlay header/i,
  },
  {
    id: "TREND-MERCH-010",
    name: "Custom product badges",
    category: "Merchandising",
    re: /custom badge|product badge|sale badge|new badge|bestseller badge/i,
  },
  {
    id: "TREND-TRUST-005",
    name: "Payment method icons",
    category: "Trust & Compliance",
    re: /payment icon/i,
  },
  {
    id: "TREND-TRUST-006",
    name: "Footer policy links",
    category: "Trust & Compliance",
    re: /policy link/i,
  },
  {
    id: "TREND-MEDIA-005",
    name: "Blog content surfaced outside the blog template",
    category: "Content & Media",
    // Bare "blog post" was too broad — it matched routine article-template
    // fixes as often as the actual capability (a dedicated section/block
    // that pulls blog content onto other pages, e.g. the homepage).
    re: /featured blog|blog (posts?|articles?) section|blog block/i,
  },

  // --- Native capabilities (2026-09-11): these ids match the pointIds in
  // data/native-capabilities.json / lib/audit/enhancementDetectors.ts. Those
  // points were sourced from shopify.dev documentation, not release-note
  // mining — this is a SECOND, independent measurement layered on top: how
  // many themes actually advertise having built on that native primitive,
  // out of the same 335-theme corpus. Several came back at or near 0/335,
  // which is itself the honest finding for niche/plumbing/brand-new
  // capabilities nobody writes a release-note bullet about (regexes were
  // deliberately broadened once each to confirm 0 wasn't just a missed
  // pattern — see the git history / conversation this was written in for
  // the broadened variants that were tried and rejected as noise).
  {
    id: "NATIVE-SEO-001",
    name: "AI agent discovery files (llms.txt / agents.md)",
    category: "SEO & AEO",
    re: /llms\.txt|agents\.md|ai agent discovery|llm discovery/i,
  },
  {
    id: "NATIVE-SEO-002",
    name: "Custom robots.txt control",
    category: "SEO & AEO",
    re: /robots\.txt|robots txt/i,
  },
  {
    id: "NATIVE-SEO-003",
    name: "Automatic and custom hreflang tags",
    category: "SEO & AEO",
    re: /hreflang/i,
  },
  {
    id: "NATIVE-SEO-004",
    name: "Canonical URL tag",
    category: "SEO & AEO",
    re: /canonical (url|tag|link)/i,
  },
  {
    id: "NATIVE-CART-001",
    name: "Shop Pay Installments (buy-now-pay-later) messaging",
    category: "Cart & Checkout",
    re: /shop pay installments|buy now,? pay later|\bbnpl\b|payment_terms/i,
  },
  {
    id: "NATIVE-TRUST-001",
    name: "Unit pricing (price-per-unit-of-measurement) display",
    category: "Trust & Compliance",
    re: /unit[- ]pric(e|ing)/i,
  },
  {
    id: "NATIVE-CART-002",
    name: "Custom line-item properties and cart attributes",
    category: "Cart & Checkout",
    re: /line[- ]item propert|cart attribute|gift message|engrav(e|ing)|special instructions field/i,
  },
  {
    id: "NATIVE-CART-003",
    name: "Native gift card issuance page (QR code / Apple Wallet)",
    category: "Cart & Checkout",
    re: /gift card.{0,60}(qr code|apple wallet|wallet pass)|(?:qr code|apple wallet|wallet pass).{0,60}gift card/i,
  },
  {
    id: "NATIVE-CUSTOM-001",
    name: "Native storefront password / \"coming soon\" page",
    category: "Theme Customization",
    re: /password page|coming[- ]soon page|under construction page/i,
  },
  {
    id: "NATIVE-PLATFORM-001",
    name: "Native contact form",
    category: "Platform Integration",
    re: /contact form|contact page/i,
  },
  {
    id: "NATIVE-MEDIA-001",
    name: "Native blog post comments",
    category: "Content & Media",
    re: /blog comment|article comment|comments? (on|for) (blog|article)/i,
  },
  {
    id: "NATIVE-PLATFORM-002",
    name: "Automatic semantic metafield rendering",
    category: "Platform Integration",
    re: /metafield_tag|semantic metafield/i,
  },
  {
    id: "NATIVE-A11Y-001",
    name: "Programmatic color-contrast calculation",
    category: "Accessibility",
    re: /color[- ]contrast/i,
  },
  {
    id: "NATIVE-PERF-001",
    name: "Native CDN image transformation and next-gen format delivery",
    category: "Performance",
    re: /\bwebp\b|\bavif\b|next-gen image|automatic(ally)? (serve|convert|deliver).{0,20}image/i,
  },
];

export const ENHANCEMENT_CATEGORIES = [...new Set(TOPICS.map((t) => t.category))];
