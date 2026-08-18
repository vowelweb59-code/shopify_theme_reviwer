// Translates a theme file path into the storefront page a merchant would
// actually recognize — e.g. "templates/index.json" -> "Home page". Added
// because raw file paths (especially for cross-file/composed findings,
// which can point at a technical.json template) told a merchant nothing
// about which page of their store an issue affects.
//
// Exact names first (so named alternate templates like "page.contact"
// resolve to something more specific than generic "Page"), falling back
// to the first path segment for arbitrary/custom alternate templates
// (e.g. "product.deluxe" -> "product" -> "Product page").
const EXACT_TEMPLATE_LABELS: Record<string, string> = {
  index: "Home page",
  product: "Product page",
  collection: "Collection page",
  "list-collections": "All collections page",
  page: "Page",
  "page.contact": "Contact page",
  blog: "Blog page",
  article: "Blog article page",
  cart: "Cart page",
  search: "Search results page",
  "404": "404 error page",
  password: "Password page",
  gift_card: "Gift card page",
  "customers/account": "Customer account page",
  "customers/login": "Customer login page",
  "customers/register": "Customer registration page",
  "customers/order": "Customer order page",
  "customers/reset_password": "Password reset page",
  "customers/activate_account": "Account activation page",
  "customers/addresses": "Customer addresses page",
};

const BASE_TEMPLATE_LABELS: Record<string, string> = {
  index: "Home page",
  product: "Product page",
  collection: "Collection page",
  "list-collections": "All collections page",
  page: "Page",
  blog: "Blog page",
  article: "Blog article page",
  cart: "Cart page",
  search: "Search results page",
  "404": "404 error page",
  password: "Password page",
  gift_card: "Gift card page",
  customers: "Customer account pages",
};

/**
 * Returns a merchant-friendly page name for a theme file path, or null
 * when the path isn't confidently tied to one specific page (sections,
 * snippets, and assets can be shared across many pages — guessing which
 * one would be misleading, so this deliberately only handles templates
 * and the layout).
 */
export function getPageLabel(filePath: string): string | null {
  if (filePath.startsWith("layout/")) return "Every page (layout)";
  if (!filePath.startsWith("templates/")) return null;

  const withoutExt = filePath.slice("templates/".length).replace(/\.(json|liquid)$/i, "");
  if (EXACT_TEMPLATE_LABELS[withoutExt]) return EXACT_TEMPLATE_LABELS[withoutExt];

  const base = withoutExt.split(".")[0].split("/")[0];
  return BASE_TEMPLATE_LABELS[base] ?? null;
}
