// Classifies Shopify App Store categories by the stage of the merchant's journey the app makes easier —
// not by Shopify's own tree. A merchant's life has seven stages; every App Store category (the "job" an
// app does) is placed in the stage where its need is felt. An app listed in categories of several
// stages belongs to each of them.
//
// The mapping is by slug prefix, most specific first, so a new sub-category Shopify adds lands in its
// parent's stage until it is given its own line here. Edit the table to move a category.

export const STAGES = [
  { key: "source", label: "Find & source products", question: "What will I sell, and who supplies it?" },
  { key: "build", label: "Build & launch the store", question: "How do I set the store up and list what I sell?" },
  { key: "attract", label: "Attract visitors", question: "How do people find the store?" },
  { key: "convert", label: "Turn visitors into buyers", question: "How do I get more of them to check out?" },
  { key: "fulfil", label: "Fulfil & deliver orders", question: "How do orders reach the customer, and come back if needed?" },
  { key: "retain", label: "Keep customers coming back", question: "How do I make a buyer buy again?" },
  { key: "scale", label: "Run & scale the business", question: "How do I run it with less effort, and grow past one market?" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

// Longest matching prefix wins.
const STAGE_BY_PREFIX: [string, StageKey][] = [
  ["finding-products", "source"],

  ["store-design", "build"],
  ["store-design-site-optimization", "attract"], // SEO and speed
  ["store-design-search-and-navigation", "convert"],
  ["store-design-product-display", "convert"],
  ["store-design-notifications", "convert"],
  ["store-design-internationalization", "scale"],
  ["selling-products", "build"],
  ["selling-products-pricing", "convert"],
  ["selling-products-payments", "convert"],
  ["selling-products-payments-subscriptions", "retain"],
  ["background-images", "build"],

  ["marketing-and-conversion", "attract"],
  ["marketing-and-conversion-advertising", "attract"],
  ["marketing-and-conversion-marketing-email-marketing", "retain"],
  ["marketing-and-conversion-customer-loyalty", "retain"],
  ["marketing-and-conversion-checkout", "convert"],
  ["marketing-and-conversion-gifts", "convert"],
  ["marketing-and-conversion-promotions", "convert"],
  ["marketing-and-conversion-social-trust", "convert"],
  ["marketing-and-conversion-upsell-and-bundles", "convert"],
  ["sales-channels", "attract"],
  ["sales-channels-selling-in-person", "scale"],

  ["orders-and-shipping", "fulfil"],

  ["store-management", "scale"],
  ["store-management-support", "retain"],
  ["support", "retain"],
];

export function stageOfCategory(slug: string): StageKey {
  let best: [string, StageKey] | null = null;
  for (const entry of STAGE_BY_PREFIX) {
    if ((slug === entry[0] || slug.startsWith(`${entry[0]}-`)) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best?.[1] ?? "scale";
}

/** The distinct stages an app's categories put it in, in lifecycle order. An app with no known category has none. */
export function stagesOfApp(categories: string[]): StageKey[] {
  const set = new Set(categories.map(stageOfCategory));
  return STAGES.map((s) => s.key).filter((k) => set.has(k));
}
