// Idempotent requirements seed — safe to run against a fresh database or
// re-run after edits below (upserts by requirementId, never duplicates).
//
// Every entry here is grounded in real, fetched Shopify/Google documentation
// (see sourceUrl) rather than invented from general knowledge. Internal
// standards are deliberately NOT seeded here — those need to come from the
// team's own actual conventions, not something this script should guess.
//
// Run with: npm run seed:requirements

import { connectToDatabase } from "../lib/db/connect";
import { Requirement, type REQUIREMENT_SOURCE_TYPES } from "../models/requirement";
import type { FINDING_CATEGORIES, FINDING_SEVERITIES } from "../models/finding";

type SourceType = (typeof REQUIREMENT_SOURCE_TYPES)[number];
type Category = (typeof FINDING_CATEGORIES)[number];
type Severity = (typeof FINDING_SEVERITIES)[number];

type SeedRequirement = {
  requirementId: string;
  sourceType: SourceType;
  category: Category;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl?: string;
  severity: Severity;
  notes?: string;
};

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";
const ACCESSIBILITY_BEST_PRACTICES_URL = "https://shopify.dev/docs/storefronts/themes/best-practices/accessibility";
const GOOGLE_PRODUCT_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/product";
const GOOGLE_ORG_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/organization";
const GOOGLE_ARTICLE_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/article";
const GOOGLE_SD_POLICIES_URL = "https://developers.google.com/search/docs/appearance/structured-data/sd-policies";
const SECTION_SCHEMA_URL = "https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema";
const GOOGLE_BREADCRUMB_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/breadcrumb";
const SCHEMA_ORG_WEBSITE_URL = "https://schema.org/WebSite";
const GOOGLE_FAQ_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/faqpage";

const requirements: SeedRequirement[] = [
  // --- Shopify Theme Store Compliance: structure -----------------------
  {
    requirementId: "SHOPIFY-STRUCTURE-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must include all required template files",
    description:
      "Themes must support theme.liquid, gift_card.liquid, JSON templates for 404, article, blog, cart, collection, index, list-collections, page, page.contact, password, product, and search, plus settings_data.json and settings_schema.json config files.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "blocker",
  },
  {
    requirementId: "SHOPIFY-STRUCTURE-002",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "JSON templates must support sections",
    description:
      "All templates must support sections (JSON templates), with the exception of Customer Account pages, Gift Card pages, and Checkout.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-STRUCTURE-003",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must include a Custom Liquid section",
    description:
      "Theme must include a Custom Liquid section with a setting of type `liquid`, available on all templates that support sections — this acts as an app insertion point.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-STRUCTURE-004",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Header and footer must use section groups",
    description:
      "Header and footer sections must be rendered within section groups so merchants can dynamically add, remove, and reorder sections in those areas.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-STRUCTURE-005",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Submission must not include config/markets.json",
    description: "The theme ZIP submitted to the Theme Store must not include config/markets.json.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-STRUCTURE-006",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Main product section must support blocks and app blocks",
    description:
      "Themes must support blocks for all or most elements of the main product section (e.g. price, vendor, description as individual blocks), and must support app blocks (@app) in the main product section and featured product section.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },

  // --- Shopify Theme Store Compliance: code/technical -------------------
  {
    requirementId: "SHOPIFY-CSS-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must not use Sass",
    description: "Themes must not use Sass or include .scss/.scss.liquid files — only native .css/.css.liquid.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-CSS-002",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must not include pre-minified CSS/JS",
    description:
      "Themes must not include minified .css or .js files, with the exception of ES6 and approved third-party libraries — Shopify auto-minifies CSS and ES5-or-lower JS at delivery.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-LIQUID-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must not modify content_for_header",
    description: "Theme must not modify or parse the content_for_header object.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-LIQUID-002",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must use the routes object for dynamic URLs",
    description:
      "Theme must use the `routes` object for generating dynamic storefront URLs (e.g. `routes.root_url`) instead of hardcoded paths like `/`.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-ASSET-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Asset links must be protocol-relative",
    description: "Asset links must use protocol-relative URLs; hard-coding http:// or https:// is not permitted.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-LINKS-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Links to Shopify domains must use rel=nofollow",
    description: "Any link in theme code that points to a Shopify domain must include a rel=\"nofollow\" attribute.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-SEO-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must include the SEO metadata snippet",
    description: "Theme must contain the theme SEO metadata code snippet outputting title, meta description, and canonical URL.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-SEO-002",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must not include a robots.txt.liquid template",
    description: "Themes must not include a robots.txt.liquid template.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },

  // --- Shopify Theme Store Compliance: accessibility (hard requirements) ---
  {
    requirementId: "SHOPIFY-A11Y-001",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "html element must specify a lang attribute",
    description: "The <html> element must specify a `lang` attribute, populated from `request.locale`.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "blocker",
  },
  {
    requirementId: "SHOPIFY-A11Y-002",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "Form inputs must have a matching label",
    description: "Form inputs must have a unique ID, with associated labels using a `for` attribute matching that ID.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-A11Y-003",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "Theme must use valid HTML",
    description: "Themes must be built with valid HTML, verifiable with the W3C HTML checker.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-A11Y-004",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "Text must meet minimum color contrast ratios",
    description:
      "Text color contrast ratio must be at least 4.5:1 for main body content, and 3:1 for larger text (18pt+/14pt+bold) and non-text elements such as borders and icons.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
    notes: "Reliable automated contrast calculation depends on CSS colors being statically resolvable (see Phase 3/4 scope notes on CSS variables).",
  },
  {
    requirementId: "SHOPIFY-A11Y-005",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "Keyboard focus order must match DOM order",
    description: "Keyboard focus order must match DOM order, moving top-to-bottom, left-to-right.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
    notes: "Full verification requires runtime/browser testing; static analysis can only check for obvious tabindex/DOM-order mismatches.",
  },
  {
    requirementId: "SHOPIFY-A11Y-006",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "Touch targets must be at least 24x24 CSS pixels",
    description:
      "Touch targets for pointer inputs must be at least 24 by 24 CSS pixels, with exceptions for inline body text and other documented exception criteria.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-A11Y-007",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "Heading levels must be visually distinct",
    description: "Headings h1-h6 must be visually different from each other.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-PERF-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Minimum Lighthouse performance score of 60",
    description:
      "Theme must average a Lighthouse performance score of at least 60 across product, collection, and home page, on both desktop and mobile.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
    notes: "Requires real browser/Lighthouse execution — explicitly out of scope for the static rule engine (Phases 3-4, 8). Cannot get an automated rule under the current architecture.",
  },
  {
    requirementId: "SHOPIFY-A11Y-008",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "Minimum Lighthouse accessibility score of 90",
    description:
      "Theme must average a Lighthouse accessibility score of at least 90 across product, collection, and home page, on both desktop and mobile.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
    notes: "Requires real browser/Lighthouse execution — explicitly out of scope for the static rule engine (Phases 3-4, 8). Cannot get an automated rule under the current architecture.",
  },

  // --- Shopify Theme Store Compliance: product/cart/collection templates ---
  {
    requirementId: "SHOPIFY-PRODUCT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Product page must render required product fields",
    description:
      "Product page must render product.title (untruncated), variant.price, variant.unit_price, the variant's compare-at price, product.description, and option names/values.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-PRODUCT-002",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Product page must support required buying functions",
    description:
      "Product page must support variant option selection, quantity selection, an Add to cart button (disabled/replaced when sold out), a callback updating price/compare-at-price/sold-out messaging on variant change, and must load the first available variant by default.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-CART-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Cart page must meet functional requirements",
    description:
      "Cart page must include a checkout button that submits the cart form, refresh line-item totals when quantity is updated, allow changing each line item's quantity, and display a message when the cart is empty.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-COLLECTION-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Collection/product grids must meet display requirements",
    description:
      "Product/collection grids must not break due to varying image aspect ratios, must show a Sale badge or compare_at_price_max where appropriate, must support sorting, and must display a message when a collection has no products.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-SCHEMA-001",
    sourceType: "shopify_theme_store",
    category: "Bug",
    title: "{% schema %} tags must contain only valid JSON",
    description:
      "Each section/block can have a single {% schema %} tag, and it must contain only valid JSON — Shopify's own Theme Check linter flags this as an error (SchemaJsonFormat). Malformed schema JSON breaks the section in the theme editor entirely.",
    sourceName: "Shopify: Section schema",
    sourceUrl: SECTION_SCHEMA_URL,
    severity: "blocker",
  },

  // --- Accessibility best practices (not hard Theme Store requirements) ---
  {
    requirementId: "A11Y-BP-001",
    sourceType: "accessibility",
    category: "Accessibility",
    title: "Every image must have an alt attribute",
    description:
      "All <img> elements must have an alt attribute. Decorative images should use an empty alt (\"\") rather than omitting the attribute.",
    sourceName: "Accessibility best practices for Shopify themes",
    sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
    severity: "high",
  },
  {
    requirementId: "A11Y-BP-002",
    sourceType: "accessibility",
    category: "Accessibility",
    title: "Visible, consistent focus indicator",
    description: "A visible, consistent focus indicator must be present on all focusable elements when navigating by keyboard or mouse.",
    sourceName: "Accessibility best practices for Shopify themes",
    sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
    severity: "medium",
  },
  {
    requirementId: "A11Y-BP-003",
    sourceType: "accessibility",
    category: "Accessibility",
    title: "Skip link to main content",
    description: "A visible-on-focus skip link should let keyboard users jump past repeated header/nav content to the main content area.",
    sourceName: "Accessibility best practices for Shopify themes",
    sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
    severity: "low",
  },
  {
    requirementId: "A11Y-BP-004",
    sourceType: "accessibility",
    category: "Accessibility",
    title: "No positive tabindex or autofocus",
    description: "Theme should avoid positive tabindex values and the autofocus attribute, which override the natural, organic focus order.",
    sourceName: "Accessibility best practices for Shopify themes",
    sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
    severity: "medium",
  },
  {
    requirementId: "A11Y-BP-005",
    sourceType: "accessibility",
    category: "Accessibility",
    title: "Sequential heading structure",
    description: "Heading tags (h1-h6) should be used in sequence to convey the logical structure of content, not chosen for visual styling.",
    sourceName: "Accessibility best practices for Shopify themes",
    sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
    severity: "medium",
  },
  {
    requirementId: "A11Y-BP-006",
    sourceType: "accessibility",
    category: "Accessibility",
    title: "aria-expanded on collapsible navigation",
    description: "Collapsible navigation triggers (e.g. dropdown menus) should expose their open/closed state via aria-expanded.",
    sourceName: "Accessibility best practices for Shopify themes",
    sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
    severity: "low",
  },
  {
    requirementId: "A11Y-BP-007",
    sourceType: "accessibility",
    category: "Accessibility",
    title: "Larger touch targets for primary controls",
    description:
      "Primary touch targets (main menu links, form submit buttons, cart/hamburger menu buttons, modal close buttons, variant options) should be at least 44x44 pixels — stricter than the 24x24 Theme Store minimum.",
    sourceName: "Accessibility best practices for Shopify themes",
    sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
    severity: "low",
  },
  {
    requirementId: "A11Y-BP-008",
    sourceType: "accessibility",
    category: "Accessibility",
    title: "Do not remove the focus outline without a visible replacement",
    description:
      "A selector that sets outline: none/0 must have a corresponding :focus or :focus-visible rule providing a visible replacement — removing the browser's default focus indicator with nothing in its place breaks keyboard navigation.",
    sourceName: "Accessibility best practices for Shopify themes",
    sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
    severity: "medium",
  },

  // --- Technical SEO (structural only, general best practice) -----------
  {
    requirementId: "TECH-SEO-H1-001",
    sourceType: "best_practice",
    category: "Technical SEO",
    title: "Exactly one H1 per rendered page",
    description: "Each rendered page/template should have exactly one H1 element identifying the page's main topic.",
    sourceName: "General technical SEO best practice",
    severity: "medium",
  },
  {
    requirementId: "TECH-SEO-HEADING-001",
    sourceType: "best_practice",
    category: "Technical SEO",
    title: "No skipped heading levels",
    description: "Heading hierarchy should not skip levels (e.g. an h2 followed directly by an h4 with no h3).",
    sourceName: "General technical SEO best practice",
    severity: "low",
  },
  {
    requirementId: "TECH-SEO-IMG-001",
    sourceType: "best_practice",
    category: "Technical SEO",
    title: "Images should declare explicit dimensions",
    description: "Images should declare explicit width/height (or aspect-ratio) to prevent layout shift.",
    sourceName: "General technical SEO best practice",
    severity: "medium",
  },
  {
    requirementId: "TECH-SEO-IMG-002",
    sourceType: "best_practice",
    category: "Technical SEO",
    title: "Below-the-fold images should lazy-load",
    description: "Images below the fold should use loading=\"lazy\".",
    sourceName: "General technical SEO best practice",
    severity: "low",
  },
  {
    requirementId: "TECH-PERF-SCRIPT-001",
    sourceType: "best_practice",
    category: "Technical SEO",
    title: "Scripts in <head> should not render-block",
    description: "A <script> with a src, placed in <head>, should use async or defer rather than blocking HTML parsing.",
    sourceName: "General technical performance best practice",
    severity: "medium",
  },
  {
    requirementId: "TECH-PERF-DUPLICATE-ASSET-001",
    sourceType: "best_practice",
    category: "Bug",
    title: "No duplicate script/stylesheet loading within a file",
    description: "The same script src or stylesheet href should not be loaded more than once within the same file.",
    sourceName: "General technical performance best practice",
    severity: "low",
  },

  // --- Technical AEO / structured data (grounded in Google's docs) ------
  {
    requirementId: "TECH-AEO-PRODUCT-001",
    sourceType: "technical_aeo",
    category: "Technical AEO",
    title: "Product templates should include Product JSON-LD",
    description: "Product template pages should include a Product JSON-LD block populated from real Shopify product data, not placeholder values.",
    sourceName: "Google: Intro to Product structured data",
    sourceUrl: GOOGLE_PRODUCT_SD_URL,
    severity: "high",
  },
  {
    requirementId: "TECH-AEO-ORG-001",
    sourceType: "technical_aeo",
    category: "Technical AEO",
    title: "Theme should include Organization JSON-LD",
    description: "Theme should include an Organization JSON-LD block (typically in the layout) identifying the store.",
    sourceName: "Google: Organization structured data",
    sourceUrl: GOOGLE_ORG_SD_URL,
    severity: "medium",
  },
  {
    requirementId: "TECH-AEO-ARTICLE-001",
    sourceType: "technical_aeo",
    category: "Technical AEO",
    title: "Blog/article templates should include Article JSON-LD",
    description: "Blog/article templates should include an Article JSON-LD block.",
    sourceName: "Google: Article structured data",
    sourceUrl: GOOGLE_ARTICLE_SD_URL,
    severity: "medium",
  },
  {
    requirementId: "TECH-AEO-VALID-001",
    sourceType: "technical_aeo",
    category: "Bug",
    title: "JSON-LD blocks must be valid JSON",
    description: "Any JSON-LD block present must parse as valid JSON — a malformed block breaks the structured-data implementation entirely.",
    sourceName: "Google: General structured data guidelines",
    sourceUrl: GOOGLE_SD_POLICIES_URL,
    severity: "blocker",
  },

  // --- Technical AEO: additional schema types -----------------------------
  // Added 2026-08-14 from a schema.org/JSON-LD implementation review of a
  // live Shopify store. That review's site-specific JSON-LD payloads (a
  // particular brand's name/logo/socials) aren't generalizable and weren't
  // added — only the underlying schema *types* it flagged as commonly
  // missing on Shopify stores, verified against current official docs
  // rather than trusted from the source review.
  {
    requirementId: "TECH-AEO-BREADCRUMB-001",
    sourceType: "technical_aeo",
    category: "Technical AEO",
    title: "Non-homepage templates should include BreadcrumbList JSON-LD",
    description:
      "Collection, product, and article templates should include a BreadcrumbList JSON-LD block (at least two ListItems: position, name, item URL) reflecting the page's place in the site hierarchy.",
    sourceName: "Google: Breadcrumb structured data",
    sourceUrl: GOOGLE_BREADCRUMB_SD_URL,
    severity: "medium",
  },
  {
    requirementId: "TECH-AEO-WEBSITE-001",
    sourceType: "technical_aeo",
    category: "Technical AEO",
    title: "Theme should include a sitewide WebSite JSON-LD entity",
    description:
      "Theme should include a WebSite JSON-LD block (name, url) with a stable @id, so other structured data (WebPage, BreadcrumbList, Article) can reference it via isPartOf rather than repeating site identity.",
    sourceName: "schema.org: WebSite",
    sourceUrl: SCHEMA_ORG_WEBSITE_URL,
    severity: "low",
    notes:
      "Not for the sitelinks search box (WebSite + SearchAction) — Google retired that feature in November 2024. The value here is establishing a stable entity other schema can cross-reference, not a SERP feature.",
  },
  {
    requirementId: "TECH-AEO-FAQ-001",
    sourceType: "technical_aeo",
    category: "Technical AEO",
    title: "Pages with FAQ content should include FAQPage JSON-LD",
    description: "A page or section presenting a Q&A/FAQ accordion should mark it up with FAQPage JSON-LD (mainEntity: Question/Answer pairs).",
    sourceName: "Google: FAQPage structured data",
    sourceUrl: GOOGLE_FAQ_SD_URL,
    severity: "low",
    notes:
      "Google discontinued the FAQ rich-result SERP feature (June 2026) — this is no longer worth prioritizing for rich results. Kept at low severity for structural/entity completeness only; downgrade further or drop if that's no longer a priority.",
  },

  // --- Shopify Theme Store Compliance: features & OS 2.0 compatibility ---
  // Added 2026-08-12 from real Shopify Theme Store review feedback the team
  // received on multiple theme submissions (Master Shopify Theme Testing
  // Sheet), cross-checked against the current published requirements page.
  {
    requirementId: "SHOPIFY-FEATURES-DISCOUNTS-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Cart must display discount amounts",
    description:
      "Display discount amounts for individual items and for entire orders in the cart, checkout, and order templates. Discounts must be supported on the Cart page.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-FEATURES-CHECKOUT-BTN-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Dynamic and accelerated checkout buttons required",
    description:
      "Include dynamic checkout buttons and accelerated checkout buttons so customers can check out quickly, on the Product page and Cart page. The branded dynamic/accelerated checkout button colors must not be modified.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-FEATURES-FACETED-SEARCH-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Faceted search filtering on collection and search pages",
    description:
      "Support faceted search filtering so customers can filter on collection and search pages based on product availability, price, type, vendor, and variant options.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-IMAGE-FOCAL-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must support image focal points",
    description: "Theme must support image focal points set by the merchant in the theme editor or Shopify admin.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-SOCIAL-IMAGE-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must expose a page_image object for social sharing",
    description:
      "Add a page_image object for social sharing so merchants can display a thumbnail image when a link to their store is shared on social media (e.g. Facebook, Pinterest).",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-COUNTRY-SELECT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Country/region and currency selector required",
    description:
      "When merchants sell in multiple countries/regions, customers must be able to select their currency and their country or region on the storefront, following Shopify's UX guidelines for the selector.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-LANGUAGE-SELECT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Language selector required for multi-language stores",
    description:
      "When merchants sell in multiple languages, customers must be able to select their preferred language on the storefront, following Shopify's UX guidelines for the selector.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  // Added 2026-08-14 from a review report flagging that some layout
  // elements stay untranslated after switching languages — distinct from
  // REF-LOCALE-KEY-MISSING-001, which only catches a `t:`/`| t` key that's
  // referenced but missing from the locale file. This is about visible
  // text that never goes through translation at all.
  {
    requirementId: "SHOPIFY-LOCALE-HARDCODED-TEXT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Visible storefront text must go through translation, not hardcoded literals",
    description:
      "When a theme supports multiple languages, every visible storefront string (nav labels, buttons, form labels, empty-state messages, etc.) must be rendered through Liquid's `| t` translation filter with a locale file entry, not hardcoded literal text — otherwise switching languages leaves some layout elements untranslated.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
    notes:
      "Distinguishing a genuinely hardcoded, translatable string from an intentional literal (a brand name, an icon-only element, a code identifier) requires judgment a static regex/heuristic can't make reliably without heavy false positives. Requires manually switching the demo store's language and reviewing each layout element, not statically checkable from theme code.",
  },
  {
    requirementId: "SHOPIFY-FEATURES-MULTILEVEL-MENU-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Multi-level (nested) navigation menus required",
    description: "Add nested menus so merchants can create multi-level dropdown menus.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-NEWSLETTER-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Newsletter signup form required",
    description: "Add a newsletter signup so merchants can collect customer email addresses for email marketing campaigns.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-PICKUP-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Pickup availability on the product page",
    description:
      "Add pickup availability to product pages so merchants can display whether a product is available for local pickup without adding it to cart. Must be supported on the Product page.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-RELATED-PRODUCTS-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Related product recommendations on product pages",
    description: "Add a section to product pages that displays an automatically generated list of related product recommendations.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-FEATURES-COMPLEMENTARY-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Complementary product recommendations on product pages",
    description: "Add complementary products to product pages so merchants can display other products that pair well with a product.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-FEATURES-RICH-MEDIA-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Rich product media support",
    description:
      "Support rich product media such as 3D models, embedded videos, and Vimeo/YouTube videos, in the product template, featured product section, and product forms (including quick view). Media must not play simultaneously — an active video must stop when another media item is selected.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-SEARCH-BOX-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Search template and predictive search required",
    description: "Theme must include a search template, and must include predictive search functionality.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-SELLING-PLANS-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Selling plans must be shown in the cart",
    description: "Merchants can create selling plans to offer subscriptions — selected selling plans must be shown to customers in the cart and on customer order pages.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-UNIT-PRICING-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Unit pricing on collection, product, and cart pages",
    description: "Merchants in some regions are required to show unit prices. Unit pricing must be supported on the Collection page, Product page, and Cart page.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-VARIANT-IMAGES-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Variant image association support",
    description: "Theme must support variant images so merchants can associate an image with a product variant, and the associated image must display when that variant is selected.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-FOLLOW-SHOP-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Follow on Shop button required",
    description:
      "Add a Follow on Shop button using the login_button Liquid filter so customers can follow the store in the Shop app. The branded Follow on Shop button colors must not be modified.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FEATURES-SHOP-PAY-INSTALLMENTS-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Shop Pay Installments banner on the product page",
    description: "Add a Shop Pay Installments banner on product.liquid to let customers know they can pay for their order in installments. Must be supported on the Product page.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-FEATURES-ACCOUNT-COMPONENT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "<shopify-account> component required in the header",
    description: "Add the <shopify-account> component to the theme header. It must be visible in both the desktop and mobile header.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },

  // --- Shopify Theme Store Compliance: page-specific requirements --------
  {
    requirementId: "SHOPIFY-PAGE-CONTACT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Page template must support a contact form alternate template",
    description: "The Page template must include an alternate template for a contact form, and must output page.title and page.content.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-COLLECTION-002",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Collection page must output collection.image and handle variable pricing",
    description:
      "Collection page must output collection.image (in addition to collection.title and collection.description), and must use product.price_varies to show a price range (product.price_min – product.price_max) for products with variants at different prices.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-BLOG-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Blog page must output blog.title and article.excerpt_or_content",
    description:
      "Blog page must output blog.title. Each article listed must display article.image, article.title (untruncated, linked), and article.excerpt_or_content — not article.content.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-ARTICLE-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Article page must output required fields and support comments",
    description:
      "Article page must output article.title (untruncated), article.comments, and article.published_at (not article.created_at). Comment pagination is required, and the comment workflow must function without moderation.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-GIFTCARD-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Gift card page must support Apple Wallet and a minimum-size QR code",
    description: "Gift card page must support Apple Wallet, display the gift card code, and show a QR code at least 120px x 120px, alongside the shop's logo or shop.name.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-PASSWORD-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Password page must include shop identity, message, and password entry",
    description: "Password page must include the logo or shop.name, shop.password_message, and a way to enter the storefront's password.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-SEARCH-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Search page must support multiple object types and a no-results message",
    description:
      "Search page must be able to return and display different object types (products, blogs, pages), and must show a clear message when there are no results. Pagination is required.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-404-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "404 page must show a clear message and navigation options",
    description: "The 404 page must display a clear message and provide options for how to proceed, such as a search bar or a link to the homepage.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },

  // --- Shopify Theme Store Compliance: consistency, sections, settings ---
  {
    requirementId: "SHOPIFY-CONSISTENCY-RTE-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "RTE-generated content must be styled consistently across templates",
    description:
      "All rich-text-editor-generated content (headings, blockquotes, lists) must be styled consistently across every template — blog articles, product descriptions, collection descriptions, and standalone pages.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-CONSISTENCY-LICENSE-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Appropriate licenses required for third-party plugins and images",
    description: "The appropriate licenses must be obtained for all third-party plugins and images included in the theme.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
    notes: "Not statically verifiable from theme code — licensing is a legal/process matter, tracked here for completeness of the manual review checklist.",
  },
  {
    requirementId: "SHOPIFY-CONSISTENCY-SCRIPT-HOSTING-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Scripts must be hosted on Shopify's servers, and must not interfere with native features",
    description:
      "Scripts included in theme code must be hosted on Shopify's servers, with the exception of approved third-party libraries. Themes must not include JavaScript or code that interferes with or augments any native Shopify feature, and must not include functionality dependent on an app.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
  },
  {
    requirementId: "SHOPIFY-SECTIONS-SCOPE-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Sections should be scoped with enabled_on/disabled_on",
    description:
      "Use the enabled_on or disabled_on schema attributes to restrict section availability to contextually relevant areas — e.g. keep general-purpose sections out of the Header and Footer section groups. Sections cannot be removed from a section group once the theme is published, so group membership should be chosen carefully.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-SETTINGS-SENTENCE-CASE-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Section, preset, and category names must use sentence case",
    description: "Write section, preset, and category names in sentence case — only the first word and proper nouns (e.g. \"Facebook\") should be capitalized.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-SETTINGS-NO-PLACEHOLDER-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Setting defaults must not use Lorem Ipsum or demo content",
    description:
      "Default setting values for section and block content should indicate how to use the setting — never Lorem Ipsum text or demo-store-specific content used as a generic placeholder.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-SETTINGS-RESOURCE-DEFAULT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Resource-based setting defaults must reference a resource that exists",
    description: "When supplying a default value for a resource-based setting (e.g. a product or collection), the referenced resource must actually exist.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-SETTINGS-LABEL-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Every setting must have a label",
    description: "All theme settings must have a label — none may be left unlabeled.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-SETTINGS-LINKLIST-DEFAULT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Header/footer link_list settings must default to main-menu/footer",
    description: "link_list settings for the header and footer must default to \"main-menu\" and \"footer\" respectively, so navigation renders immediately on install.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-EDITOR-LIVE-PREVIEW-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme editor changes must be reflected in the live preview",
    description: "Changes made in the theme editor must be reflected in the editor preview without requiring a manual save/refresh to see the update.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-FONT-PICKER-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Font settings must use the font_picker type",
    description:
      "All font settings must use the font_picker setting type with a default font selected, using currently available fonts. The theme's CSS must load bold, italic, and bold-italic variants for each font. Custom/uploaded fonts are not accepted.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-COLOR-SYSTEM-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must define a minimum color system with matched background/foreground pairs",
    description:
      "A minimum of 4 colors are required. Every background color setting must include a corresponding foreground color setting, and color settings must use the color setting type.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },

  // --- Shopify Theme Store Compliance: social media -----------------------
  // No prior Social Media section existed in the KB — SHOPIFY-SEO-001 covers
  // the separate SEO metadata snippet (title/description/canonical), not
  // Open Graph/Twitter tags or icon/placeholder requirements.
  {
    requirementId: "SHOPIFY-SOCIAL-OG-TAGS-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must include Open Graph and Twitter card tags",
    description: "Theme must contain Open Graph and Twitter card meta tags so shared links render a rich preview on social platforms.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
  },
  {
    requirementId: "SHOPIFY-SOCIAL-PLACEHOLDER-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Social media setting placeholder text must be left empty",
    description: "Social media URL setting defaults must be left empty rather than pre-filled with placeholder/example URLs.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },
  {
    requirementId: "SHOPIFY-SOCIAL-ICONS-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Theme must offer a set of social media icons",
    description: "Theme must have a set of social media icons for merchants to choose from when linking their social profiles.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
  },

  // --- Shopify Theme Store Compliance: accessibility (additional) --------
  {
    requirementId: "SHOPIFY-A11Y-009",
    sourceType: "shopify_theme_store",
    category: "Accessibility",
    title: "All parts of a page must be keyboard accessible",
    description:
      "Every interactive part of a page must be reachable and operable via keyboard alone, including dropdown/submenu navigation — distinct from focus order or focus visibility, this is about whether an element can be reached at all.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "high",
    notes: "Full verification requires runtime/browser interaction testing; static analysis can only catch obvious structural indicators (e.g. hover-only dropdown triggers with no keyboard handler).",
  },

  // --- Shopify Theme Store Compliance: Design & UX (visual review only) --
  // Added 2026-08-14. These were deliberately left out when the rest of
  // Shopify's Theme Store requirements page was seeded (2026-08-12) — they're
  // editorial/design-taste judgment calls ("professional-quality visuals",
  // "clear page structure"), not deterministically checkable from theme
  // code, and inventing a static heuristic for them would risk exactly the
  // false-positive/false-confidence problem this project has been careful
  // to avoid everywhere else. They're real Theme Store review criteria
  // though, so they belong in the knowledge base as a manual-review
  // checklist — each needs a live demo store or design reference (Figma,
  // screenshots) to actually evaluate, not theme source code.
  {
    requirementId: "SHOPIFY-DESIGN-VISUAL-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Visual design must be professional-quality and use a cohesive color palette",
    description:
      "Images, graphics, and icons must be high-quality, clear, appropriately sized, and consistent. The theme should use a simple, complementary color palette that works together without clashing, with an intentional design that stands apart and targets a specific merchant type/industry.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
    notes: "Editorial/design-taste judgment — requires visual review against a live demo store or design reference, not statically checkable from theme code.",
  },
  {
    requirementId: "SHOPIFY-DESIGN-LAYOUT-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Layout must have a clear, logical structure and stay flexible across content variation",
    description:
      "The design should clearly follow a logical grid structure, use size/color/contrast/position to emphasize key details, and remain visually appealing when content length or quantity varies (short vs. long titles, few vs. many products, etc.).",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
    notes: "Editorial/design-taste judgment — requires visual review against a live demo store or design reference, not statically checkable from theme code.",
  },
  {
    requirementId: "SHOPIFY-DESIGN-CONSISTENCY-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Typography and UI patterns must be visually consistent throughout",
    description:
      "Avoid an abundance of fonts; use complementary font pairings. Buttons, links, and forms should use consistent styles, sizes, colors, and behaviors across the theme, and theme editor settings should be organized in a way that's easy for merchants to use.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "low",
    notes: "Editorial/design-taste judgment — requires visual review against a live demo store or design reference, not statically checkable from theme code.",
  },
  {
    requirementId: "SHOPIFY-DESIGN-UX-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Customer shopping experience must be clear and frictionless",
    description:
      "Customers should be able to easily navigate from homepage to product discovery, product pages, cart, and checkout. The design should thoughtfully guide customers toward relevant products/collections, and key customer actions should be clear, intuitive, and immediately responsive.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
    notes: "Editorial/design-taste judgment — requires interacting with a live demo store, not statically checkable from theme code.",
  },
  {
    requirementId: "SHOPIFY-DESIGN-DEMOSTORE-001",
    sourceType: "shopify_theme_store",
    category: "Theme Store Compliance",
    title: "Demo store must be complete, realistic, and free of placeholder content",
    description:
      "The demo store should use thoughtfully selected products, professional images, and real-life scenarios matching the theme's target industry — every section/feature shown should fit that business type, with no Lorem Ipsum or placeholder text anywhere.",
    sourceName: "Shopify Theme Store requirements",
    sourceUrl: THEME_STORE_REQUIREMENTS_URL,
    severity: "medium",
    notes:
      "Requires reviewing the actual demo store content, not statically checkable from theme code (the ZIP doesn't contain merchant/demo content). Partial automated coverage added 2026-08-14: the live demo-store check (LIVE-IMAGE-RESOLUTION-001) flags images whose source resolution is measurably lower than their rendered size — a narrower, objective check than the full 'professional images, real-life scenarios, no placeholder content' judgment call, which still needs manual review.",
  },
];

async function main() {
  await connectToDatabase();

  let created = 0;
  let updated = 0;

  for (const req of requirements) {
    const existed = await Requirement.exists({ requirementId: req.requirementId });

    await Requirement.findOneAndUpdate(
      { requirementId: req.requirementId },
      {
        $set: {
          sourceType: req.sourceType,
          category: req.category,
          title: req.title,
          description: req.description,
          sourceName: req.sourceName,
          sourceUrl: req.sourceUrl ?? null,
          severity: req.severity,
          notes: req.notes ?? null,
          status: "active",
        },
        $setOnInsert: { ruleStatus: "not_implemented" },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (existed) updated++;
    else created++;
  }

  console.log(`Seed complete: ${created} created, ${updated} updated, ${requirements.length} total.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
