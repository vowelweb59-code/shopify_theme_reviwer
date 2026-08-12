// Theme-wide "is this Shopify feature implemented at all" checks, added
// 2026-08-12 for the requirements seeded from real Theme Store review
// feedback (see scripts/seed-requirements.ts, SHOPIFY-FEATURES-*).
//
// These are presence heuristics, not certainties: each one greps the whole
// theme for the specific Liquid object/filter/tag Shopify's own docs use to
// implement the feature. A theme could satisfy the underlying requirement
// through some other valid pattern this doesn't recognize, so severity is
// capped at "medium" and every finding is worded as "no reference found",
// never "this is missing" — the false-positive risk is real and inherent to
// grepping for absence rather than proving it.
import type { Rule, Severity } from "@/lib/audit/rules";

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";

type PresenceCheck = {
  ruleId: string;
  requirementId: string;
  title: string;
  description: string;
  /** Capped at "medium" — see file header. */
  severity: Extract<Severity, "medium" | "low">;
  /** Satisfied if ANY pattern matches ANY liquid file's raw text. */
  patterns: RegExp[];
  findingWhenMissing: string;
  recommendation: string;
};

function themeWidePresenceRule(check: PresenceCheck): Rule {
  return {
    ruleId: check.ruleId,
    requirementId: check.requirementId,
    category: "Theme Store Compliance",
    defaultSeverity: check.severity,
    title: check.title,
    description: check.description,
    sourceReference: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    check({ files }) {
      const liquidFiles = files.filter((f) => f.fileType === "liquid");
      const found = liquidFiles.some((f) => check.patterns.some((re) => re.test(f.rawText)));
      if (found) return [];

      const anchor = liquidFiles.find((f) => f.path.startsWith("layout/"))?.path ?? liquidFiles[0]?.path ?? "layout/theme.liquid";
      return [
        {
          filePath: anchor,
          category: "Theme Store Compliance" as const,
          severity: check.severity,
          finding: check.findingWhenMissing,
          recommendation: check.recommendation,
        },
      ];
    },
  };
}

const CHECKS: PresenceCheck[] = [
  {
    ruleId: "SHOPIFY-FEATURES-CHECKOUT-BTN-001",
    requirementId: "SHOPIFY-FEATURES-CHECKOUT-BTN-001",
    title: "Dynamic/accelerated checkout buttons",
    description: "Product and cart pages should include Shopify's dynamic/accelerated checkout buttons.",
    severity: "medium",
    patterns: [/\bpayment_button\b/, /\bcontent_for_additional_checkout_buttons\b/],
    findingWhenMissing:
      "No reference to the payment_button filter or content_for_additional_checkout_buttons was found anywhere in the theme — dynamic/accelerated checkout buttons may not be implemented on the product or cart page.",
    recommendation: "Render {{ form | payment_button }} in the product form, and output {{ content_for_additional_checkout_buttons }} on the cart page.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-SOCIAL-IMAGE-001",
    requirementId: "SHOPIFY-FEATURES-SOCIAL-IMAGE-001",
    title: "page_image object for social sharing",
    description: "Theme should use the page_image object so shared links show a thumbnail on social media.",
    severity: "medium",
    patterns: [/\bpage_image\b/],
    findingWhenMissing: "No reference to the page_image object was found anywhere in the theme.",
    recommendation: "Use {{ page_image | image_url: ... }} in the social-sharing meta tags (e.g. og:image).",
  },
  {
    ruleId: "SHOPIFY-FEATURES-NEWSLETTER-001",
    requirementId: "SHOPIFY-FEATURES-NEWSLETTER-001",
    title: "Newsletter signup form",
    description: "Theme should include a newsletter signup so merchants can collect customer emails.",
    severity: "medium",
    patterns: [/\{%-?\s*form\s+['"]customer['"][\s\S]{0,400}newsletter/i, /newsletter[\s\S]{0,400}\{%-?\s*form\s+['"]customer['"]/i],
    findingWhenMissing: "No customer form referencing \"newsletter\" was found anywhere in the theme.",
    recommendation: "Add a {% form 'customer' %} with a hidden contact[tags] value of \"newsletter\".",
  },
  {
    ruleId: "SHOPIFY-FEATURES-PICKUP-001",
    requirementId: "SHOPIFY-FEATURES-PICKUP-001",
    title: "Pickup availability on the product page",
    description: "Product page should display local pickup availability using variant.store_availabilities.",
    severity: "medium",
    patterns: [/\bstore_availabilities\b/],
    findingWhenMissing: "No reference to variant.store_availabilities was found anywhere in the theme.",
    recommendation: "Loop over {{ variant.store_availabilities }} to display pickup availability on the product page.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-RELATED-PRODUCTS-001",
    requirementId: "SHOPIFY-FEATURES-RELATED-PRODUCTS-001",
    title: "Related product recommendations",
    description: "Product pages should show related product recommendations via Shopify's recommendations endpoint.",
    severity: "low",
    patterns: [/\bproduct_recommendations_url\b/],
    findingWhenMissing: "No reference to routes.product_recommendations_url was found anywhere in the theme.",
    recommendation: "Fetch {{ routes.product_recommendations_url }} to render a related-products section.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-COMPLEMENTARY-001",
    requirementId: "SHOPIFY-FEATURES-COMPLEMENTARY-001",
    title: "Complementary product recommendations",
    description: "Product pages should show complementary product recommendations (intent=complementary).",
    severity: "low",
    patterns: [/\bcomplementary\b/i],
    findingWhenMissing: "No reference to \"complementary\" products was found anywhere in the theme.",
    recommendation: "Fetch routes.product_recommendations_url with intent=complementary to render complementary products.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-RICH-MEDIA-001",
    requirementId: "SHOPIFY-FEATURES-RICH-MEDIA-001",
    title: "Rich product media (3D/video)",
    description: "Product template/forms should support rich media via model_viewer_tag/external_video_tag/video_tag.",
    severity: "medium",
    patterns: [/\bmodel_viewer_tag\b/, /\bexternal_video_tag\b/, /\bvideo_tag\b/, /\bmedia_tag\b/],
    findingWhenMissing: "No reference to model_viewer_tag, external_video_tag, video_tag, or media_tag was found anywhere in the theme.",
    recommendation: "Use Shopify's media filters (model_viewer_tag, external_video_tag, video_tag) to render rich product media.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-SELLING-PLANS-001",
    requirementId: "SHOPIFY-FEATURES-SELLING-PLANS-001",
    title: "Selling plans shown in the cart",
    description: "Cart/order pages should display the selected selling plan for subscription line items.",
    severity: "medium",
    patterns: [/\bselling_plan_allocation\b/, /\bselling_plan_groups\b/],
    findingWhenMissing: "No reference to selling_plan_allocation or selling_plan_groups was found anywhere in the theme.",
    recommendation: "Display line_item.selling_plan_allocation on the cart and order pages for subscription products.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-UNIT-PRICING-001",
    requirementId: "SHOPIFY-FEATURES-UNIT-PRICING-001",
    title: "Unit pricing",
    description: "Collection, product, and cart pages should display unit pricing where applicable.",
    severity: "medium",
    patterns: [/\bunit_price\b/],
    findingWhenMissing: "No reference to unit_price was found anywhere in the theme.",
    recommendation: "Display variant.unit_price and variant.unit_price_measurement on the collection, product, and cart pages.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-VARIANT-IMAGES-001",
    requirementId: "SHOPIFY-FEATURES-VARIANT-IMAGES-001",
    title: "Variant image support",
    description: "Product media should update to the selected variant's own image.",
    severity: "medium",
    patterns: [/variant\.featured_image\b/, /variant\.image\b/],
    findingWhenMissing: "No reference to variant.featured_image or variant.image was found anywhere in the theme.",
    recommendation: "Use variant.featured_image to swap the displayed image when a variant with its own image is selected.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-FOLLOW-SHOP-001",
    requirementId: "SHOPIFY-FEATURES-FOLLOW-SHOP-001",
    title: "Follow on Shop button",
    description: "Theme should include a Follow on Shop button using the login_button filter.",
    severity: "low",
    patterns: [/\blogin_button\b/],
    findingWhenMissing: "No reference to the login_button filter was found anywhere in the theme.",
    recommendation: "Render {{ shop | login_button }} to add the Follow on Shop button.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-SHOP-PAY-INSTALLMENTS-001",
    requirementId: "SHOPIFY-FEATURES-SHOP-PAY-INSTALLMENTS-001",
    title: "Shop Pay Installments banner",
    description: "Product page should include the Shop Pay Installments messaging widget.",
    severity: "low",
    patterns: [/\{%-?\s*payment_terms\b/],
    findingWhenMissing: "No {% payment_terms %} tag was found anywhere in the theme.",
    recommendation: "Add {% payment_terms %} to product.liquid to show the Shop Pay Installments banner.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-ACCOUNT-COMPONENT-001",
    requirementId: "SHOPIFY-FEATURES-ACCOUNT-COMPONENT-001",
    title: "<shopify-account> component in the header",
    description: "Theme header should include the <shopify-account> component.",
    severity: "medium",
    patterns: [/<shopify-account\b/],
    findingWhenMissing: "No <shopify-account> element was found anywhere in the theme.",
    recommendation: "Add the <shopify-account> component to the header, visible on both desktop and mobile.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-COUNTRY-SELECT-001",
    requirementId: "SHOPIFY-FEATURES-COUNTRY-SELECT-001",
    title: "Country/region selector",
    description: "Theme should let customers select their country/region when the merchant sells internationally.",
    severity: "low",
    patterns: [/localization\.available_countries\b/],
    findingWhenMissing: "No reference to localization.available_countries was found anywhere in the theme.",
    recommendation: "Render a country selector from {{ localization.available_countries }} inside a {% form 'localization' %}.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-LANGUAGE-SELECT-001",
    requirementId: "SHOPIFY-FEATURES-LANGUAGE-SELECT-001",
    title: "Language selector",
    description: "Theme should let customers select their preferred language when the merchant sells in multiple languages.",
    severity: "low",
    patterns: [/localization\.available_languages\b/],
    findingWhenMissing: "No reference to localization.available_languages was found anywhere in the theme.",
    recommendation: "Render a language selector from {{ localization.available_languages }} inside a {% form 'localization' %}.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-MULTILEVEL-MENU-001",
    requirementId: "SHOPIFY-FEATURES-MULTILEVEL-MENU-001",
    title: "Multi-level (nested) navigation menus",
    description: "Header navigation should support nested dropdown menus by iterating a link's own .links.",
    severity: "low",
    patterns: [/\bfor\s+\w+\s+in\s+\w+\.links\b/],
    findingWhenMissing: "No loop over a link's own .links (e.g. \"for child_link in link.links\") was found anywhere in the theme.",
    recommendation: "Recurse into link.links when rendering the main menu to support multi-level dropdowns.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-IMAGE-FOCAL-001",
    requirementId: "SHOPIFY-FEATURES-IMAGE-FOCAL-001",
    title: "Image focal point support",
    description: "Theme should respect focal points set on images in the theme editor/admin.",
    severity: "low",
    patterns: [/\bfocal_point\b/],
    findingWhenMissing: "No reference to focal_point was found anywhere in the theme.",
    recommendation: "Use image.presentation.focal_point (e.g. as a CSS object-position) when rendering cropped images.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-SEARCH-BOX-001",
    requirementId: "SHOPIFY-FEATURES-SEARCH-BOX-001",
    title: "Predictive search",
    description: "Theme should include predictive search, not just the full search results page.",
    severity: "medium",
    patterns: [/predictive[-_]search/i],
    findingWhenMissing: "No reference to predictive search was found anywhere in the theme.",
    recommendation: "Implement predictive search (the predictive_search Liquid object / Predictive Search API) alongside the search template.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-FACETED-SEARCH-001",
    requirementId: "SHOPIFY-FEATURES-FACETED-SEARCH-001",
    title: "Faceted search filtering",
    description: "Collection and search pages should support faceted filtering (availability, price, type, vendor, variant options).",
    severity: "medium",
    patterns: [/collection\.filters\b/, /search\.filters\b/],
    findingWhenMissing: "No reference to collection.filters or search.filters was found anywhere in the theme.",
    recommendation: "Render filters from {{ collection.filters }} / {{ search.filters }} on the collection and search pages.",
  },
  {
    ruleId: "SHOPIFY-FEATURES-DISCOUNTS-001",
    requirementId: "SHOPIFY-FEATURES-DISCOUNTS-001",
    title: "Discount amounts shown in the cart",
    description: "Cart page should display discount amounts for individual items and the whole order.",
    severity: "medium",
    patterns: [/\bdiscount_allocations\b/, /\bcart_level_discount_applications\b/],
    findingWhenMissing: "No reference to discount_allocations or cart_level_discount_applications was found anywhere in the theme.",
    recommendation: "Display line_item.discount_allocations and cart.cart_level_discount_applications on the cart page.",
  },
];

export const SHOPIFY_FEATURE_RULES: Rule[] = CHECKS.map(themeWidePresenceRule);
