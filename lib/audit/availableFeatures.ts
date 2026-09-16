// Shopify's own Theme Store "optional features" checklist (the merchant-
// facing feature-selection list), as a fixed catalog independent of the
// EnhancementPoint collection's own category/adoption-tier organization.
// Detection is NOT new code: it reuses whichever EnhancementPoint(s)
// already cover a given feature — `pointIds` names them, and this run's
// AuditRun.enhancementDetections' `detected` boolean (OR'd across every
// listed pointId) decides the status shown for it. An empty `pointIds`
// means no detector exists for that exact feature yet — shown as "not yet
// checked", never silently omitted or guessed at, and never shown as
// "not detected" (which would claim a real check ran and failed).
//
// Mappings here are deliberately conservative: a feature only lists a
// pointId when the two titles genuinely describe the same capability, not
// merely a related one — see each item's `note` for anything approximate.
// New, unmapped features get a real EnhancementPoint + detector in a later
// pass rather than a guessed pattern now.

export type AvailableFeature = {
  id: string;
  label: string;
  category: string;
  pointIds: string[];
  note?: string;
};

export const AVAILABLE_FEATURES: AvailableFeature[] = [
  // --- Cart & merchandising ---
  { id: "pre-order", label: "Pre-order", category: "Cart & merchandising", pointIds: [] },
  { id: "cart-notes", label: "Cart notes", category: "Cart & merchandising", pointIds: [] },
  { id: "gift-wrapping", label: "Gift wrapping", category: "Cart & merchandising", pointIds: [] },
  { id: "in-store-pickups", label: "In-store pickups", category: "Cart & merchandising", pointIds: ["TREND-DISCOVERY-007"] },
  { id: "quick-buy", label: "Quick buy", category: "Cart & merchandising", pointIds: ["TREND-DISCOVERY-008"] },
  { id: "sign-in-with-shop", label: "Sign in with Shop", category: "Cart & merchandising", pointIds: [] },
  { id: "slide-out-cart", label: "Slide-out cart", category: "Cart & merchandising", pointIds: ["TREND-CART-001"] },
  {
    id: "sticky-cart",
    label: "Sticky cart",
    category: "Cart & merchandising",
    pointIds: ["TREND-CUSTOM-004"],
    note: "Detector covers sticky headers/bars/add-to-cart together, not sticky-cart specifically.",
  },
  {
    id: "cross-selling",
    label: "Cross-selling",
    category: "Cart & merchandising",
    pointIds: ["TREND-MERCH-001"],
    note: "Detector covers recommendations + recently viewed together.",
  },
  { id: "quick-view", label: "Quick view", category: "Cart & merchandising", pointIds: ["TREND-DISCOVERY-008"] },
  { id: "recently-viewed", label: "Recently viewed", category: "Cart & merchandising", pointIds: ["TREND-MERCH-001"] },
  { id: "recommended-products", label: "Recommended products", category: "Cart & merchandising", pointIds: ["TREND-MERCH-001"] },
  { id: "stock-counter", label: "Stock counter", category: "Cart & merchandising", pointIds: ["TREND-MERCH-004"] },
  { id: "quantity-pricing", label: "Quantity pricing (Shopify Plus)", category: "Cart & merchandising", pointIds: ["TREND-PLATFORM-003"] },
  { id: "quick-order-list", label: "Quick order list", category: "Cart & merchandising", pointIds: ["TREND-PLATFORM-004"] },
  { id: "back-in-stock-alert", label: "Back-in-stock alert", category: "Cart & merchandising", pointIds: ["TREND-MERCH-004"] },

  // --- Content & promotion ---
  { id: "customizable-contact-form", label: "Customizable contact form", category: "Content & promotion", pointIds: ["NATIVE-PLATFORM-001"] },
  { id: "blogs", label: "Blogs", category: "Content & promotion", pointIds: [], note: "Blog template structure is checked separately as a static Theme Store Compliance rule, not here." },
  { id: "countdown-timer", label: "Countdown timer", category: "Content & promotion", pointIds: ["TREND-MERCH-003"] },
  { id: "in-menu-promos", label: "In-menu promos", category: "Content & promotion", pointIds: [] },
  { id: "press-coverage", label: "Press coverage", category: "Content & promotion", pointIds: [] },
  { id: "product-badges", label: "Product badges", category: "Content & promotion", pointIds: ["TREND-MERCH-010"] },
  {
    id: "promo-banners",
    label: "Promo banners",
    category: "Content & promotion",
    pointIds: ["TREND-MERCH-002"],
    note: "Mapped to the announcement-bar detector — the closest existing match, not an exact one.",
  },
  { id: "promo-popups", label: "Promo popups", category: "Content & promotion", pointIds: [] },
  { id: "promo-tiles", label: "Promo tiles", category: "Content & promotion", pointIds: [] },

  // --- Trust & localization ---
  { id: "age-verifier", label: "Age verifier", category: "Trust & localization", pointIds: ["TREND-TRUST-002"] },
  {
    id: "faq-page",
    label: "FAQ page",
    category: "Trust & localization",
    pointIds: ["TREND-CUSTOM-006"],
    note: "Mapped to the accordion/collapsible-content detector — FAQ pages typically use this pattern.",
  },
  {
    id: "trust-badges",
    label: "Trust badges",
    category: "Trust & localization",
    pointIds: ["TREND-TRUST-005"],
    note: "Detector only covers payment-method icons specifically, a narrower thing than trust badges generally.",
  },
  { id: "eu-translations", label: "EU translations (EN, FR, IT, DE, ES)", category: "Trust & localization", pointIds: ["TREND-I18N-001"] },
  { id: "right-to-left", label: "Right-to-left", category: "Trust & localization", pointIds: ["TREND-I18N-003"] },

  // --- Media ---
  { id: "high-resolution-images", label: "High-resolution images", category: "Media", pointIds: [], note: "Checked separately via a live per-image resolution check, not this system." },
  {
    id: "image-galleries",
    label: "Image galleries",
    category: "Media",
    pointIds: ["TREND-MEDIA-001"],
    note: "Detector covers video/3D media in galleries, not plain image galleries specifically.",
  },
  { id: "image-hotspot", label: "Image hotspot", category: "Media", pointIds: [] },
  { id: "image-rollover", label: "Image rollover", category: "Media", pointIds: [] },
  { id: "image-zoom", label: "Image zoom", category: "Media", pointIds: [] },
  { id: "before-after-image-slider", label: "Before/after image slider", category: "Media", pointIds: ["TREND-MEDIA-003"] },
  { id: "lookbooks", label: "Lookbooks", category: "Media", pointIds: [] },
  { id: "slideshow", label: "Slideshow", category: "Media", pointIds: [] },

  // --- Product page ---
  { id: "color-swatches", label: "Color swatches", category: "Product page", pointIds: ["TREND-DISCOVERY-001"] },
  { id: "combined-listing", label: "Combined listing", category: "Product page", pointIds: ["TREND-PLATFORM-002"] },
  { id: "ingredients-nutritional-information", label: "Ingredients or nutritional information", category: "Product page", pointIds: [] },
  { id: "product-options", label: "Product options", category: "Product page", pointIds: ["TREND-DISCOVERY-005"] },
  {
    id: "product-tabs",
    label: "Product tabs",
    category: "Product page",
    pointIds: ["TREND-CUSTOM-006"],
    note: "Mapped to the accordion/collapsible-content detector — product tabs typically use this pattern.",
  },
  { id: "product-videos", label: "Product videos", category: "Product page", pointIds: ["TREND-MEDIA-001"] },
  { id: "shipping-delivery-information", label: "Shipping/delivery information", category: "Product page", pointIds: ["TREND-CART-003"] },
  { id: "size-chart", label: "Size chart", category: "Product page", pointIds: ["TREND-MEDIA-004"] },
  { id: "usage-information", label: "Usage information", category: "Product page", pointIds: [] },

  // --- Navigation & browsing ---
  { id: "animation", label: "Animation", category: "Navigation & browsing", pointIds: [] },
  { id: "back-to-top-button", label: "Back-to-top button", category: "Navigation & browsing", pointIds: [] },
  { id: "breadcrumbs", label: "Breadcrumbs", category: "Navigation & browsing", pointIds: [], note: "Breadcrumb JSON-LD structured data is checked separately as a static SEO/AEO rule; visible breadcrumb navigation isn't checked here." },
  { id: "collection-page-navigation", label: "Collection page navigation", category: "Navigation & browsing", pointIds: ["TREND-DISCOVERY-004"] },
  { id: "enhanced-search", label: "Enhanced search", category: "Navigation & browsing", pointIds: ["TREND-DISCOVERY-003"] },
  { id: "infinite-scroll", label: "Infinite scroll", category: "Navigation & browsing", pointIds: ["TREND-DISCOVERY-006"] },
  { id: "mega-menu", label: "Mega menu", category: "Navigation & browsing", pointIds: ["TREND-DISCOVERY-002"] },
  { id: "product-filtering-and-sorting", label: "Product filtering and sorting", category: "Navigation & browsing", pointIds: ["TREND-DISCOVERY-004"] },
  { id: "sticky-header", label: "Sticky header", category: "Navigation & browsing", pointIds: ["TREND-CUSTOM-004"] },
  { id: "swatch-filters", label: "Swatch filters", category: "Navigation & browsing", pointIds: ["TREND-DISCOVERY-001", "TREND-DISCOVERY-004"] },

  // --- Account ---
  {
    id: "account-menu",
    label: "Account menu",
    category: "Account",
    pointIds: ["TREND-PLATFORM-006"],
    note: "Mapped to the new-customer-accounts detector, the closest existing match.",
  },
];

export type FeatureStatus = "detected" | "not_detected" | "not_checked";

/** `detections` is a run's AuditRun.enhancementDetections (pointId -> detected). */
export function featureStatus(feature: AvailableFeature, detections: Map<string, boolean>): FeatureStatus {
  if (feature.pointIds.length === 0) return "not_checked";
  const relevant = feature.pointIds.map((id) => detections.get(id)).filter((v): v is boolean => v !== undefined);
  if (relevant.length === 0) return "not_checked";
  return relevant.some(Boolean) ? "detected" : "not_detected";
}
