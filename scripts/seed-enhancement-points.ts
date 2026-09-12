// Idempotent enhancement-point seed — safe against a fresh database or a
// re-run after edits (upserts by pointId, never duplicates).
//
// Unlike scripts/seed-requirements.ts, the numbers here are not transcribed
// from documentation: they are measured. scripts/research/harvest-release-notes.mjs
// pulls every theme's release-note history from the Shopify Theme Store, and
// scripts/research/aggregate-release-notes.mjs reduces it to
// data/theme-trend-points.json. This script joins that measured adoption data
// to the hand-written description/auditHint copy below.
//
// A point's status is NEVER overwritten on re-seed: once someone marks a point
// "planned" or "dismissed", re-running the harvest must not silently reset
// that triage decision back to "backlog".
//
// Run with: npm run seed:enhancements

import { readFileSync } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "../lib/db/connect";
import { EnhancementPoint, ENHANCEMENT_CATEGORIES } from "../models/enhancement-point";
import { tierForPercentage } from "../lib/enhancements/tiers";

type Category = (typeof ENHANCEMENT_CATEGORIES)[number];

type TrendData = {
  generatedAt: string;
  source: { name: string; url: string; themesAnalyzed: number; versionsAnalyzed: number; notesAnalyzed: number };
  points: {
    pointId: string;
    name: string;
    category: string;
    adoption: {
      themeCount: number;
      themeTotal: number;
      percentage: number;
      tier: string;
      noteCount: number;
      addedNoteCount: number;
      firstSeen: string | null;
      lastSeen: string | null;
    };
    examples: { theme: string; note: string; version: string | null; date: string | null }[];
  }[];
};

// Hand-written copy per point. `description` says what the capability is and
// what the release notes actually show about it; `auditHint` says what to look
// for in a theme's source when checking whether the theme has it.
const COPY: Record<string, { description: string; auditHint: string }> = {
  "TREND-MEDIA-001": {
    description:
      "Product and gallery sections accept video (native Shopify-hosted, YouTube/Vimeo embeds) and 3D models alongside images, with autoplay, poster frames and click-to-play controls. The most widely shipped capability in the store.",
    auditHint:
      "Check product media sections for `media.media_type` branching, `model-viewer` / `product-model` usage, and `video_tag` or `external_video_url` output. Themes handling only `image` are behind the field.",
  },
  "TREND-MEDIA-002": {
    description:
      "Merchant-controllable image framing: focal-point support so crops keep the subject in frame, configurable aspect ratios per section, and separate desktop/mobile images for art direction.",
    auditHint:
      "Look for `image.presentation.focal_point` in image output, aspect-ratio settings in section schema, and distinct mobile image settings rather than one image scaled at both breakpoints.",
  },
  "TREND-MEDIA-003": {
    description:
      "A draggable slider that wipes between two images to show a before/after comparison. Common in beauty, home-improvement and fitness themes.",
    auditHint: "Look for a comparison/before-after section with two image settings and a drag handle.",
  },
  "TREND-MEDIA-004": {
    description:
      "A size chart or sizing guide surfaced from the product page, usually as a modal fed by a metafield, metaobject or page reference so merchants can vary it per product.",
    auditHint:
      "Check for a size-guide block on the product template and whether its content comes from a metafield/metaobject rather than being hardcoded per theme.",
  },

  "TREND-MERCH-001": {
    description:
      "Shopify's product recommendations and complementary-product APIs, plus a locally tracked recently-viewed list. Second-most-adopted capability in the store.",
    auditHint:
      "Look for `/recommendations/products` section-rendering calls with `intent: related` and `intent: complementary`, and a recently-viewed implementation reading localStorage.",
  },
  "TREND-MERCH-002": {
    description:
      "A dismissible bar above or below the header for promotions and shipping messages, typically supporting multiple rotating messages, per-message links and scheduling.",
    auditHint: "Check for an announcement-bar section with multiple blocks, rotation and a dismiss control that persists.",
  },
  "TREND-MERCH-003": {
    description:
      "Scarcity and urgency cues: countdown timers on products and banners, stock counters and limited-time promo framing. Widely shipped, but the pattern needs care — a countdown that resets on reload is misleading.",
    auditHint:
      "Check any countdown for a real merchant-set end date rather than a per-visit rolling timer, and confirm stock counters read real `inventory_quantity` rather than a random number.",
  },
  "TREND-MERCH-004": {
    description:
      "Inventory state exposed to the shopper: low-stock thresholds, explicit out-of-stock treatment on cards and variant pickers, and back-in-stock notification capture.",
    auditHint:
      "Check that variant pickers mark unavailable combinations rather than hiding them, and that low-stock messaging reads `inventory_quantity` with `inventory_management` respected.",
  },
  "TREND-MERCH-005": {
    description:
      "Display of discount state in the storefront: automatic-discount and script-discount amounts on line items, promo/discount code entry in cart, and sale-price treatment on cards.",
    auditHint:
      "Look for `cart.cart_level_discount_applications` and `line_item.discount_allocations` rendering, plus a discount-code field in the cart or drawer.",
  },
  "TREND-MERCH-006": {
    description:
      "Bundle merchandising — a section or block that presents several products as one buyable set, sometimes with its own pricing display. Distinct from Shopify's native bundles app surface.",
    auditHint: "Check for a bundle section and whether it works with bundle-app line-item properties or is purely presentational.",
  },
  "TREND-MERCH-007": {
    description:
      "Review and rating display: star ratings on product cards and product pages, usually reading the Shopify Product Reviews metafields or a third-party app block.",
    auditHint:
      "Look for `product.metafields.reviews.rating` output and an app-block insertion point for review apps, plus matching `AggregateRating` in structured data.",
  },
  "TREND-MERCH-008": {
    description:
      "Wishlist / saved-items functionality. Notable as a negative signal: of the three themes whose notes mention it, two record REMOVING the feature — one explicitly citing Shopify policy. Treat a built-in wishlist as a review risk, not an enhancement.",
    auditHint:
      "If the theme ships a wishlist, verify it does not rely on storing customer data outside Shopify, which is what appears to have triggered the removals.",
  },

  "TREND-CUSTOM-001": {
    description:
      "Typography controls in the theme editor: font family pickers, and a type scale that lets merchants adjust heading and body sizes independently rather than shipping fixed sizes.",
    auditHint:
      "Check `settings_schema.json` for `font_picker` settings plus size/scale settings wired to CSS custom properties, rather than font sizes hardcoded in stylesheets.",
  },
  "TREND-CUSTOM-002": {
    description:
      "Shopify's `color_scheme` / `color_scheme_group` settings so merchants assign schemes per section, and a dark-mode-capable palette. The modern replacement for a handful of global color settings.",
    auditHint:
      "Look for `color_scheme_group` in `settings_schema.json` and a `color_scheme` setting on sections; global-only color settings are the older pattern.",
  },
  "TREND-CUSTOM-003": {
    description:
      "Theme blocks (reusable, nestable blocks with `blocks: [{ type: '@theme' }]`) and app-block insertion points, letting merchants compose layouts instead of choosing from fixed section variants.",
    auditHint:
      "Check section schemas for `@theme` and `@app` block acceptance and for `blocks/` directory usage; a theme with only fixed local blocks is on the older architecture.",
  },
  "TREND-CUSTOM-004": {
    description:
      "Sticky UI on scroll: sticky header (often with a transparent-over-hero state), sticky add-to-cart bar on product pages, and sticky promo bars.",
    auditHint:
      "Verify sticky elements are merchant-toggleable and do not obscure content or break keyboard focus order; check the sticky header does not cause layout shift on load.",
  },
  "TREND-CUSTOM-005": {
    description:
      "Structuring theme JavaScript as custom elements / web components with proper lifecycle handling, rather than page-load scripts. Release notes show real operational reasons: Safari never supported customized built-ins, and missing `disconnectedCallback` cleanup leaked listeners and observers across section re-renders.",
    auditHint:
      "Look for `customElements.define` with autonomous (not `is=`-extended) elements, and confirm `disconnectedCallback` removes document/window listeners, observers and timers — critical for theme-editor section re-rendering.",
  },

  "TREND-DISCOVERY-001": {
    description:
      "Shopify's native swatch configuration — colour and image swatches driven by the platform's swatch settings and option metafields — rather than each theme inventing its own naming convention for colour options.",
    auditHint:
      "Check for `option.presentation.type == 'swatch'` / `swatch.color` / `swatch.image` usage. Themes matching option values against a hardcoded colour-name list are on the legacy pattern.",
  },
  "TREND-DISCOVERY-002": {
    description:
      "Multi-column dropdown navigation with promotional content and imagery in-menu, driven by the merchant's linklist depth.",
    auditHint: "Check mega-menu markup for correct nested-list semantics and keyboard operability, not just hover-driven reveal.",
  },
  "TREND-DISCOVERY-003": {
    description:
      "Shopify's predictive search API for as-you-type suggestions across products, collections, pages and articles, usually with a debounced request and a results panel.",
    auditHint:
      "Look for `/search/suggest` calls with a `resources[type]` list, debouncing, and an accessible results region (`aria-live`, managed focus).",
  },
  "TREND-DISCOVERY-004": {
    description:
      "Storefront filtering driven by the Search & Discovery app: `collection.filters` rendering including visual filters — colour swatch and image filter values — plus price-range and multi-select behaviour.",
    auditHint:
      "Check the collection template renders `collection.filters` generically (all `filter.type` values, including `boolean` and `price_range`) rather than a hardcoded tag-based filter list.",
  },
  "TREND-DISCOVERY-005": {
    description:
      "Variant selection UI beyond a native select: swatch and button pickers, unavailable-combination handling, and variant changes applied via the Section Rendering API without a full page reload.",
    auditHint:
      "Verify the picker keeps a real form input for the selected variant id, updates URL state, and handles unavailable combinations rather than silently allowing an invalid selection.",
  },
  "TREND-DISCOVERY-006": {
    description:
      "Alternatives to numbered pagination on collections: infinite scroll and explicit load-more buttons, typically via the Section Rendering API.",
    auditHint:
      "Confirm a crawlable/keyboard-reachable fallback exists — infinite scroll with no paginated URLs harms both SEO and accessibility.",
  },
  "TREND-DISCOVERY-007": {
    description:
      "Store locator pages and local pickup availability surfaced on the product page from Shopify's pickup availability API.",
    auditHint: "Look for `pickup-availability` usage on the product form, and whether locator content is metaobject-driven.",
  },

  "TREND-CART-001": {
    description:
      "A slide-out cart drawer instead of (or alongside) a full cart page, updated via the Cart AJAX API. The dominant cart pattern in the store.",
    auditHint:
      "Verify the drawer updates from real `/cart/*.js` responses, keeps the `/cart` page working for no-JS access, and traps focus while open.",
  },
  "TREND-CART-002": {
    description:
      "Accelerated checkout surfaces: Shop Pay and dynamic checkout buttons on the product page and cart, plus checkout-extension awareness.",
    auditHint:
      "Look for `content_for_additional_checkout_buttons` and a `payment_button` in the product form, plus payment-icon display in the footer.",
  },
  "TREND-CART-003": {
    description:
      "Shipping and delivery messaging in the cart: free-shipping progress bars against a merchant-set threshold, delivery-date estimates and shipping calculators.",
    auditHint:
      "Check any free-shipping threshold is currency-aware and reads cart totals in cents — hardcoded thresholds break under Shopify Markets multi-currency.",
  },
  "TREND-CART-004": {
    description:
      "Shopify's gift card recipient form — letting a buyer send a gift card directly to a recipient with a message and send date. Shipped by 89 themes and required for gift-card products to work as intended.",
    auditHint:
      "Check the product form renders the recipient fields (`properties[Recipient email]`, `properties[Recipient name]`, `properties[Message]`, `properties[Send on]`) when `product.gift_card?`, and includes the `recipient-form` control.",
  },

  "TREND-PLATFORM-001": {
    description:
      "Metafield and metaobject-driven content: dynamic sources on section settings, and metaobject-backed sections so merchants extend content without theme edits.",
    auditHint:
      "Look for `dynamic source` support on settings and metaobject rendering; hardcoded content where a metafield would serve is the older pattern.",
  },
  "TREND-PLATFORM-002": {
    description:
      "Combined listings — Shopify's native way to present several products as one listing with a shared option picker. First appeared in release notes in April 2024 and reached 151 themes since. Notes repeatedly tell merchants to migrate off theme-specific 'product variations' blocks to the native feature.",
    auditHint:
      "Check for handling of the combined-listing parent/child relationship in the variant picker, and whether URL and Section Rendering updates keep the correct product in context.",
  },
  "TREND-PLATFORM-003": {
    description:
      "Volume/quantity pricing and quantity rules — tiered price breaks and minimum/maximum/increment constraints, primarily a B2B surface but exposed on standard product pages too.",
    auditHint:
      "Look for `variant.quantity_price_breaks` and `variant.quantity_rule` (min/max/increment) enforcement in the quantity input, not just display.",
  },
  "TREND-PLATFORM-004": {
    description:
      "A quick order list — a table-style bulk-ordering surface letting buyers add many variants with quantities in one action. Primarily B2B.",
    auditHint: "Check for a bulk quantity form posting multiple line items in one cart request, with quantity rules respected.",
  },
  "TREND-PLATFORM-005": {
    description:
      "B2B support: company accounts and locations, location-specific catalogs and pricing, and B2B-aware customer account surfaces.",
    auditHint:
      "Look for `customer.b2b?`, `company_location` handling and catalog-aware pricing; a theme with no B2B branching cannot serve B2B merchants.",
  },
  "TREND-PLATFORM-006": {
    description:
      "Shopify's new customer accounts — passwordless/one-time-code sign-in and the hosted account experience, plus the newer account web components for sign-in and account navigation.",
    auditHint:
      "Check whether the theme links to new customer accounts and whether legacy `/account` templates still hardcode classic login-only assumptions.",
  },
  "TREND-PLATFORM-007": {
    description:
      "Subscriptions / selling plans: selling-plan pickers on the product form, subscription pricing display, and correct line-item rendering for subscription purchases.",
    auditHint:
      "Look for `product.selling_plan_groups` rendering and a `selling_plan` input in the product form; subscription price display should use the selected plan's allocation price.",
  },
  "TREND-PLATFORM-008": {
    description:
      "The newest trend in the dataset, and the clearest future-facing signal: standard Storefront Events & Actions so apps, AI agents and agentic-commerce surfaces can drive cart interactions without page reloads. First appeared 2026-06-14 and reached 28 themes within roughly three months — faster early adoption than any other point here.",
    auditHint:
      "Check whether the theme publishes the standard storefront event contract (page view, product view, cart add/update) and exposes cart actions that work without a reload, so agent-driven interactions do not break.",
  },

  "TREND-I18N-001": {
    description:
      "Full translation coverage via locale files with no hardcoded customer-facing strings, and schema translations so the theme editor itself is localised.",
    auditHint:
      "Grep templates/sections for customer-facing literals that bypass `t:` / `| t`, and confirm `locales/*.schema.json` exists alongside `*.json`.",
  },
  "TREND-I18N-002": {
    description:
      "Shopify Markets support: country/region and language selectors in header or footer, market-aware currency formatting and domain handling.",
    auditHint:
      "Look for `localization` form rendering with `country_option_tags` / `language_option_tags`, and confirm prices use `money` filters rather than manual formatting.",
  },
  "TREND-I18N-003": {
    description:
      "Right-to-left layout support for Arabic, Hebrew and Persian storefronts — direction-aware layout rather than a flipped stylesheet.",
    auditHint:
      "Check for logical CSS properties (`margin-inline-start`, `inset-inline`) instead of left/right, and `dir` set from the request locale.",
  },

  "TREND-A11Y-001": {
    description:
      "Ongoing accessibility work across themes: keyboard focus visibility, focus trapping in drawers and modals, ARIA roles and labels on custom controls, screen-reader announcements for async updates, and contrast fixes. Over half the store has shipped accessibility work in the analysed window.",
    auditHint:
      "This overlaps existing Accessibility requirements — use it as trend evidence, not as a duplicate check. Focus on the recurring release-note themes: focus rings on interactive media, `aria-live` for cart/search updates, and a single coordinated escape/backdrop handler for overlays.",
  },

  "TREND-PERF-001": {
    description:
      "Load-performance work: lazy loading below-the-fold media while eagerly loading the LCP image, deferring non-critical JS, preloading critical assets, and reducing layout shift. Release notes show the common mistake explicitly — lazy-loading top-of-page images, which delays LCP.",
    auditHint:
      "Check the first hero/banner image is NOT `loading=\"lazy\"`, that below-fold images are, that width/height or aspect-ratio are set to prevent CLS, and that scripts are `defer`red.",
  },
  "TREND-PERF-002": {
    description:
      "Progressive-web-app and offline behaviour. Effectively absent from the store — one theme, and only for setting a mobile browser theme colour so PWA splash screens match the palette. Recorded for completeness; not a trend.",
    auditHint: "Low value as an audit point. At most, check for a `theme-color` meta matching the theme background.",
  },

  "TREND-SEO-001": {
    description:
      "Structured data in the theme: Product, Organization/WebSite, BreadcrumbList and Article JSON-LD, kept consistent with rendered page content.",
    auditHint:
      "Overlaps existing Technical SEO requirements. Confirm JSON-LD is emitted per template type, prices and availability match the rendered variant, and there is exactly one Product node per product page.",
  },

  "TREND-TRUST-001": {
    description:
      "Newsletter and email capture surfaces: footer signup, dedicated sections and popups, posting to Shopify's customer form.",
    auditHint:
      "Check the form posts via `form 'customer'` with `contact[email]`, shows success/error states, and that any popup is dismissible and does not trap focus.",
  },
  "TREND-TRUST-002": {
    description:
      "An age-verification gate before storefront access, for age-restricted categories. Shipped by 87 themes.",
    auditHint:
      "Verify the gate is merchant-toggleable, remembers its answer, and is keyboard-accessible — a modal that blocks the page must not also block keyboard users.",
  },
  "TREND-TRUST-003": {
    description:
      "Privacy and consent handling: cookie-consent banners and integration with Shopify's Customer Privacy API so tracking respects consent state.",
    auditHint:
      "Look for `window.Shopify.customerPrivacy` usage rather than a purely cosmetic banner, and confirm analytics/tracking is gated on consent.",
  },
  "TREND-TRUST-004": {
    description:
      "Explicit security fixes in theme code — the harvested notes name cross-site scripting and URL-substring sanitisation issues in theme JavaScript. Rare in release notes (12 themes), which likely reflects under-reporting rather than absence of risk.",
    auditHint:
      "Check merchant-controlled and URL-derived values are escaped on output (`| escape`), that `liquid`-type settings are not injected into script context, and that no code builds URLs by substring matching.",
  },

  // --- Round 2 (2026-09-11): mined deeper from the same corpus rather than
  // a new fetch — see scripts/research/topics.mjs for how each was checked
  // against the original 47 to avoid near-duplicates.
  "TREND-DISCOVERY-008": {
    description:
      "A modal or inline panel that lets a shopper preview or add a product from a collection grid without opening the full product page — 'quick view' shows details in a dialog, 'quick add' skips straight to the cart. The single most widely shipped point in this round.",
    auditHint:
      "Check collection/card templates for a quick-view trigger that fetches the product via the Section Rendering API (not a full navigation), and that the resulting dialog is keyboard-operable and returns focus to the trigger on close.",
  },
  "TREND-MERCH-009": {
    description:
      "Configurable social platform icons (Instagram, Facebook, LinkedIn, TikTok, etc.) in the header, footer, or a dedicated block — distinct from newsletter capture, this is about linking out to the brand's own social presence.",
    auditHint:
      "Check social icon settings support the platforms merchants actually use today (TikTok, Threads), each icon has an accessible name (not just an SVG with no label), and links open in a way that doesn't strand the shopper mid-checkout.",
  },
  "TREND-CUSTOM-006": {
    description:
      "Accordion-style collapsible content — product details/shipping/returns tabs, FAQ sections, collapsible navigation — implemented as a real expand/collapse block rather than everything shown at once.",
    auditHint:
      "Check the expand/collapse control is a real `<button>` (or `<details>`) with `aria-expanded` reflecting state, not a `div` with only a click handler, and that content is reachable by keyboard.",
  },
  "TREND-CUSTOM-007": {
    description:
      "A header that renders transparent/see-through over the hero image and becomes solid on scroll or on non-hero pages, sometimes with a glass-blur backdrop effect. Distinct from a *sticky* header (which is about staying fixed in place, not about starting transparent).",
    auditHint:
      "Check the header's contrast is still sufficient in its transparent state against varied hero imagery (a merchant-uploaded dark or busy image can make transparent nav text illegible), and that the solid/transparent transition doesn't cause layout shift.",
  },
  "TREND-MERCH-010": {
    description:
      "Configurable badges on product cards — sale, new, bestseller, sold-out, custom text — usually with merchant control over which show and in what priority when several would apply at once.",
    auditHint:
      "Check badge priority is deterministic when multiple badges could apply to the same product (e.g. both on sale and sold out), and that badge text/color isn't the only signal — sighted-only color coding fails a colorblind shopper.",
  },
  "TREND-TRUST-005": {
    description:
      "Static payment-method icons (Visa, Mastercard, PayPal, Shop Pay, etc.) displayed in the footer or cart as a trust signal — distinct from the actual accelerated-checkout buttons that let a shopper pay with one tap.",
    auditHint:
      "Check the icon set is configurable rather than hardcoded (a merchant not offering a shown method is misleading), and that icons carry accessible alt text rather than being purely decorative images with no label.",
  },
  "TREND-TRUST-006": {
    description:
      "A setting that automatically links a store's Shopify-generated policy pages (refund, privacy, terms of service, shipping) in the footer, rather than requiring the merchant to manually add each link.",
    auditHint:
      "Check the setting reads Shopify's actual policy objects (`shop.policies`) rather than requiring the merchant to paste in URLs by hand, and that a policy with no content set doesn't render a dead link.",
  },
  "TREND-MEDIA-005": {
    description:
      "A dedicated section/block that surfaces blog content outside the blog template itself — most often a 'Featured blog' section on the homepage — rather than leaving articles undiscoverable unless a shopper navigates directly to /blogs.",
    auditHint:
      "Check the section pulls real article data (title, excerpt, image, published date) from a merchant-selected blog rather than static placeholder content, and that it's usable when the selected blog has zero or one article.",
  },
};

async function main() {
  const dataPath = path.join(process.cwd(), "data", "theme-trend-points.json");
  const data: TrendData = JSON.parse(readFileSync(dataPath, "utf8"));

  await connectToDatabase();

  const missingCopy: string[] = [];
  let created = 0;
  let updated = 0;

  for (const point of data.points) {
    // NATIVE-* ids in this file are expected and intentional: native
    // capabilities are documentation-sourced (data/native-capabilities.json,
    // scripts/seed-native-capabilities.ts) but can ALSO have their
    // release-note adoption measured by this same aggregation pipeline —
    // this script only owns TREND-* points, so it skips those silently
    // rather than treating them as a gap that needs COPY written here.
    if (point.pointId.startsWith("NATIVE-")) continue;

    const copy = COPY[point.pointId];
    if (!copy) {
      missingCopy.push(point.pointId);
      continue;
    }
    if (!ENHANCEMENT_CATEGORIES.includes(point.category as Category)) {
      throw new Error(`${point.pointId}: unknown category "${point.category}"`);
    }

    const existed = await EnhancementPoint.exists({ pointId: point.pointId });

    // $setOnInsert on `status` keeps existing triage decisions intact.
    await EnhancementPoint.findOneAndUpdate(
      { pointId: point.pointId },
      {
        $set: {
          name: point.name,
          category: point.category,
          description: copy.description,
          auditHint: copy.auditHint,
          // Explicit even though it's the schema default — this backfills
          // `source` onto every document seeded before native-capability
          // points existed, since Mongoose defaults only apply to documents
          // that are actually written, not retroactively to ones already
          // in the database.
          source: "theme-store-trend",
          // Recomputed from the percentage rather than taking the research
          // script's `tier` field, so lib/enhancements/tiers.ts stays the
          // only place the thresholds are defined.
          adoptionTier: tierForPercentage(point.adoption.percentage),
          themeCount: point.adoption.themeCount,
          themeTotal: point.adoption.themeTotal,
          adoptionPercentage: point.adoption.percentage,
          noteCount: point.adoption.noteCount,
          addedNoteCount: point.adoption.addedNoteCount,
          firstSeen: point.adoption.firstSeen,
          lastSeen: point.adoption.lastSeen,
          examples: point.examples,
          sourceName: data.source.name,
          sourceUrl: data.source.url,
        },
        $setOnInsert: { status: "backlog" },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (existed) updated++;
    else created++;
  }

  console.log(`Enhancement points seeded: ${created} created, ${updated} updated.`);
  console.log(
    `Source: ${data.source.themesAnalyzed} themes, ${data.source.versionsAnalyzed} versions, ` +
      `${data.source.notesAnalyzed} release notes (harvested ${data.generatedAt.slice(0, 10)}).`
  );

  if (missingCopy.length) {
    console.warn(`\nSKIPPED — no description/auditHint copy for: ${missingCopy.join(", ")}`);
    console.warn("Add them to COPY in this file, then re-run.");
  }

  const orphaned = Object.keys(COPY).filter((id) => !data.points.some((p) => p.pointId === id));
  if (orphaned.length) {
    console.warn(`\nCopy present but no longer in the dataset: ${orphaned.join(", ")}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
