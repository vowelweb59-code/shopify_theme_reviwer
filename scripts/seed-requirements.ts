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
