// Presence heuristics for the "Future updates" enhancement points
// (models/enhancement-point.ts), mirrored one-for-one against the pointId
// list in data/theme-trend-points.json / scripts/seed-enhancement-points.ts.
//
// These are grep-style checks, same spirit as lib/rules/shopify/features.ts:
// a pattern match against a theme's parsed source is evidence the capability
// is present, not proof. A theme can implement something through a pattern
// this doesn't recognize (false negative), and a keyword can appear in an
// unrelated context (false positive) — e.g. "metafields" is used constantly
// even by themes with no metaobject-driven content. Regexes below were
// chosen to favor a specific API/setting name (`focal_point`,
// `color_scheme_group`, `selling_plan_groups`, …) over a generic word
// wherever the corresponding auditHint names one, precisely to keep the
// false-positive rate down. Detection is never used for severity, coverage,
// or readiness — see EnhancementDetection on AuditRun.
import type { ParsedFile } from "@/lib/theme-parser";

export type EnhancementDetector = {
  pointId: string;
  /** Detected if ANY pattern matches ANY (non-asset) file's raw text. */
  patterns?: RegExp[];
  /** Detected if ANY pattern matches a file's path. */
  pathPatterns?: RegExp[];
  /**
   * For checks regex-over-one-file can't express (e.g. "more than one
   * locale file exists"). Return the files that count as evidence, or an
   * empty array/null when not detected. Only used when patterns/pathPatterns
   * (if also present) didn't already find a match.
   */
  predicate?: (files: ParsedFile[]) => ParsedFile[] | null;
};

export const ENHANCEMENT_DETECTORS: EnhancementDetector[] = [
  // --- Content & Media ---------------------------------------------------
  {
    pointId: "TREND-MEDIA-001",
    patterns: [/media\.media_type/i, /model-viewer/i, /product-model/i, /video_tag/i, /external_video_url/i],
  },
  {
    pointId: "TREND-MEDIA-002",
    patterns: [/focal_point/i, /\baspect_ratio\b/i],
  },
  {
    pointId: "TREND-MEDIA-003",
    patterns: [/before.{0,8}after/i, /image[-_]comparison/i],
    pathPatterns: [/before.{0,8}after/i, /image[-_]comparison/i],
  },
  {
    pointId: "TREND-MEDIA-004",
    patterns: [/size[-_]?chart/i, /size[-_]?guide/i],
    pathPatterns: [/size[-_]?chart/i, /size[-_]?guide/i],
  },

  // --- Merchandising -------------------------------------------------------
  {
    pointId: "TREND-MERCH-001",
    patterns: [/\/recommendations\/products/i, /intent:\s*['"]?related/i, /intent:\s*['"]?complementary/i, /recently[-_]viewed/i],
  },
  {
    pointId: "TREND-MERCH-002",
    patterns: [/announcement[-_]bar/i],
    pathPatterns: [/announcement[-_]bar/i],
  },
  {
    pointId: "TREND-MERCH-003",
    patterns: [/countdown/i],
  },
  {
    pointId: "TREND-MERCH-004",
    patterns: [/back[-_]in[-_]stock/i, /inventory_quantity/i, /low[-_]stock/i],
  },
  {
    pointId: "TREND-MERCH-005",
    patterns: [/cart_level_discount_applications/i, /discount_allocations/i, /discount[-_]code/i],
  },
  {
    pointId: "TREND-MERCH-006",
    // Plain /bundle/ also matches "CSS bundle size" and "bundled assets" —
    // same exclusion used when mining release notes (scripts/research/topics.mjs).
    patterns: [/\bbundles?\b(?![- ](size|split))/i, /bundle[-_](section|product|builder)/i],
    pathPatterns: [/bundle/i],
  },
  {
    pointId: "TREND-MERCH-007",
    patterns: [/metafields\.reviews\.rating/i, /AggregateRating/i, /product[-_]review/i, /star[-_]rating/i],
  },
  {
    pointId: "TREND-MERCH-008",
    patterns: [/wishlist/i, /wish[-_]list/i, /save[-_]for[-_]later/i],
  },

  // --- Theme Customization ---------------------------------------------
  {
    pointId: "TREND-CUSTOM-001",
    patterns: [/font_picker/i, /type_scale/i],
  },
  {
    pointId: "TREND-CUSTOM-002",
    patterns: [/color_scheme_group/i, /color_scheme\b/i],
  },
  {
    pointId: "TREND-CUSTOM-003",
    patterns: [/["']@theme["']/i, /["']@app["']/i],
    pathPatterns: [/^blocks\//i],
  },
  {
    pointId: "TREND-CUSTOM-004",
    patterns: [/sticky[-_]?(header|cart|bar|atc|add[-_]to[-_]cart)/i],
  },
  {
    pointId: "TREND-CUSTOM-005",
    patterns: [/customElements\.define/i, /disconnectedCallback/i],
  },

  // --- Product Discovery -------------------------------------------------
  {
    pointId: "TREND-DISCOVERY-001",
    patterns: [/swatch\.color/i, /swatch\.image/i, /presentation\.type/i, /\bswatch\b/i],
  },
  {
    pointId: "TREND-DISCOVERY-002",
    patterns: [/mega[-_]menu/i],
    pathPatterns: [/mega[-_]menu/i],
  },
  {
    pointId: "TREND-DISCOVERY-003",
    patterns: [/\/search\/suggest/i, /predictive[-_]search/i],
  },
  {
    pointId: "TREND-DISCOVERY-004",
    patterns: [/collection\.filters/i, /filter\.type/i],
  },
  {
    pointId: "TREND-DISCOVERY-005",
    patterns: [/variant[-_]picker/i, /variant[-_]selector/i],
  },
  {
    pointId: "TREND-DISCOVERY-006",
    patterns: [/infinite[-_]scroll/i, /load[-_]more/i],
  },
  {
    pointId: "TREND-DISCOVERY-007",
    patterns: [/store[-_]locator/i, /pickup[-_]availability/i],
  },

  // --- Cart & Checkout -----------------------------------------------------
  {
    pointId: "TREND-CART-001",
    patterns: [/cart[-_]drawer/i, /drawer[-_]cart/i],
    pathPatterns: [/cart-drawer/i],
  },
  {
    pointId: "TREND-CART-002",
    patterns: [/content_for_additional_checkout_buttons/i, /payment_button/i],
  },
  {
    pointId: "TREND-CART-003",
    patterns: [/free[-_]shipping/i, /shipping[-_]calculator/i],
  },
  {
    pointId: "TREND-CART-004",
    patterns: [/recipient-form/i, /properties\[Recipient/i, /recipient_form/i],
  },

  // --- Platform Integration ------------------------------------------------
  {
    pointId: "TREND-PLATFORM-001",
    // Bare "metafields" is used almost universally even without metaobject
    // content, so this leans on the rarer, more specific signals instead.
    patterns: [/metaobjects\./i, /dynamic[-_ ]source/i, /metafields\.custom\./i],
  },
  {
    pointId: "TREND-PLATFORM-002",
    patterns: [/combined[-_]listing/i],
  },
  {
    pointId: "TREND-PLATFORM-003",
    patterns: [/quantity_price_breaks/i, /quantity_rule/i],
  },
  {
    pointId: "TREND-PLATFORM-004",
    patterns: [/quick[-_]order[-_]list/i],
    pathPatterns: [/quick[-_]order/i],
  },
  {
    pointId: "TREND-PLATFORM-005",
    patterns: [/customer\.b2b\?/i, /company_location/i, /company_account/i],
  },
  {
    pointId: "TREND-PLATFORM-006",
    patterns: [/account\.shopify\.com/i, /new[-_]customer[-_]account/i],
  },
  {
    pointId: "TREND-PLATFORM-007",
    patterns: [/selling_plan_groups/i, /selling_plan\b/i],
  },
  {
    pointId: "TREND-PLATFORM-008",
    patterns: [/storefront[-_]events?/i, /storefront[-_]actions?/i, /agent[-_]cart/i, /ai[-_]agent/i],
  },

  // --- Internationalization ------------------------------------------------
  {
    pointId: "TREND-I18N-001",
    // More than just en.default.json is the actual signal for
    // "multi-language storefront", not the presence of the `t:` filter,
    // which every Shopify theme uses regardless of translation coverage.
    predicate(files) {
      const extraLocales = files.filter(
        (f) => /^locales\/[a-z]{2}(-[a-z]{2})?\.json$/i.test(f.path) && !/^locales\/en\.default\.json$/i.test(f.path)
      );
      return extraLocales.length > 0 ? extraLocales.slice(0, 3) : null;
    },
  },
  {
    pointId: "TREND-I18N-002",
    patterns: [/country_option_tags/i, /language_option_tags/i],
  },
  {
    pointId: "TREND-I18N-003",
    patterns: [/margin-inline/i, /inset-inline/i, /padding-inline/i],
  },

  // --- Accessibility & Performance -------------------------------------
  {
    pointId: "TREND-A11Y-001",
    patterns: [/aria-live/i, /role=["']dialog["']/i, /focus[-_]trap/i, /trapFocus/i],
  },
  {
    pointId: "TREND-PERF-001",
    patterns: [/fetchpriority/i, /loading=["']lazy["']/i, /<script[^>]*\bdefer\b/i],
  },
  {
    pointId: "TREND-PERF-002",
    patterns: [/manifest\.json/i, /service-worker/i, /serviceWorker/i],
  },

  // --- SEO & AEO -------------------------------------------------------
  {
    pointId: "TREND-SEO-001",
    patterns: [/application\/ld\+json/i, /schema\.org/i],
  },

  // --- Trust & Compliance ------------------------------------------------
  {
    pointId: "TREND-TRUST-001",
    patterns: [/form\s+['"]customer['"]/i, /contact\[email\]/i, /newsletter/i],
  },
  {
    pointId: "TREND-TRUST-002",
    patterns: [/age[-_]verif/i, /age[-_]gate/i],
  },
  {
    pointId: "TREND-TRUST-003",
    patterns: [/customerPrivacy/i, /cookie[-_]consent/i, /consent[-_]banner/i],
  },
  {
    pointId: "TREND-TRUST-004",
    // A bare `| escape` is near-universal in Liquid themes regardless of
    // whether the theme has done any deliberate security work, so this
    // looks for the rarer traces of actual hardening instead.
    patterns: [/\bxss\b/i, /sanitiz/i, /content-security-policy/i, /csp[-_ ]?nonce/i],
  },

  // --- Round 2 (2026-09-11) — see topics.mjs for the corresponding
  // release-note-mining regex each of these pairs with.
  {
    pointId: "TREND-DISCOVERY-008",
    patterns: [/quick[-_ ]?view/i, /quick[-_ ]?add/i, /quick[-_ ]?buy/i],
    pathPatterns: [/quick[-_ ]?(view|add|buy)/i],
  },
  {
    pointId: "TREND-MERCH-009",
    patterns: [/social[-_ ]?(media[-_ ]?)?icons?/i, /follow[-_ ]?button/i],
  },
  {
    pointId: "TREND-CUSTOM-006",
    patterns: [/collapsible[-_ ]?content/i, /accordion/i],
    pathPatterns: [/accordion/i, /collapsible/i],
  },
  {
    pointId: "TREND-CUSTOM-007",
    patterns: [/transparent[-_ ]?header/i, /header[-_ ]?overlay/i],
  },
  {
    pointId: "TREND-MERCH-010",
    patterns: [/product[-_ ]?badge/i, /custom[-_ ]?badge/i, /sale[-_ ]?badge/i],
  },
  {
    pointId: "TREND-TRUST-005",
    patterns: [/payment[-_ ]?icons?/i],
  },
  {
    pointId: "TREND-TRUST-006",
    patterns: [/policy[-_ ]?link/i],
  },
  {
    pointId: "TREND-MEDIA-005",
    patterns: [/featured[-_ ]?blog/i, /blog[-_ ]?(post|article)s?[-_ ]?section/i, /blog[-_ ]?block/i],
    pathPatterns: [/featured-blog/i],
  },

  // --- Native capabilities (2026-09-11) — these detect exact Liquid
  // object/tag/filter names rather than natural-language release-note
  // phrasing, so precision is much higher than the trend detectors above:
  // a theme either calls `color_contrast` somewhere or it doesn't.
  {
    pointId: "NATIVE-SEO-001",
    pathPatterns: [/^templates\/(llms(-full)?\.txt|agents\.md)\.liquid$/i],
    patterns: [/\bagents\.(store_name|store_url|ucp_discovery_url|mcp_endpoint_url|sitemap_url)\b/i],
  },
  {
    pointId: "NATIVE-SEO-002",
    pathPatterns: [/^templates\/robots\.txt\.liquid$/i],
    patterns: [/robots\.default_groups/i, /group\.user_agent/i, /group\.sitemap/i],
  },
  {
    // Only catches a theme's own hand-built hreflang loop — the automatic
    // default is injected by Shopify's platform via content_for_header,
    // never present in the theme's own source to grep for.
    pointId: "NATIVE-SEO-003",
    patterns: [/hreflang/i],
  },
  {
    pointId: "NATIVE-SEO-004",
    patterns: [/canonical_url/i],
  },
  {
    pointId: "NATIVE-CART-001",
    patterns: [/payment_terms/i],
  },
  {
    pointId: "NATIVE-TRUST-001",
    patterns: [/unit_price_measurement/i, /unit_price_with_measurement/i, /\.unit_price\b/i],
  },
  {
    pointId: "NATIVE-CART-002",
    patterns: [/properties\[/i, /line_item\.properties/i, /\bcart\.note\b/i],
  },
  {
    pointId: "NATIVE-CART-003",
    pathPatterns: [/^templates\/gift_card\.liquid$/i],
    patterns: [/gift_card\.pass_url/i, /gift_card\.balance/i],
  },
  {
    pointId: "NATIVE-CUSTOM-001",
    pathPatterns: [/^templates\/password\.liquid$/i],
    patterns: [/storefront_password/i, /password_message/i],
  },
  {
    pointId: "NATIVE-PLATFORM-001",
    patterns: [/form\s+['"]contact['"]/i],
  },
  {
    pointId: "NATIVE-MEDIA-001",
    patterns: [/new_comment/i, /blog\.moderated\?/i, /comments_enabled\?/i],
  },
  {
    pointId: "NATIVE-PLATFORM-002",
    patterns: [/metafield_tag/i],
  },
  {
    pointId: "NATIVE-A11Y-001",
    patterns: [/color_contrast/i],
  },
  {
    pointId: "NATIVE-PERF-001",
    patterns: [/image_url/i],
  },
];
