// Theme Store industry collections (themes.shopify.com `industry[]` values),
// shared by the ranking tab's Collection filter and the Sales page's
// category mapping.
export const INDUSTRIES = [
  { label: "Art", slug: "art" },
  { label: "Auto", slug: "auto" },
  { label: "Bags", slug: "bags" },
  { label: "Beauty", slug: "beauty" },
  { label: "Clothing", slug: "clothing" },
  { label: "Electronics", slug: "electronics" },
  { label: "Entertainment", slug: "entertainment" },
  { label: "Food and drink", slug: "food-and-drink" },
  { label: "Garden", slug: "garden" },
  { label: "Hardware", slug: "hardware" },
  { label: "Home", slug: "home" },
  { label: "Jewelry and accessories", slug: "jewelry-and-accessories" },
  { label: "Kids", slug: "kids" },
  { label: "Office", slug: "office" },
  { label: "Pets", slug: "pets" },
  { label: "Services", slug: "services" },
  { label: "Shoes", slug: "shoes" },
  { label: "Sports", slug: "sports" },
  { label: "Toys", slug: "toys" },
  { label: "Wellness", slug: "wellness" },
];

export function industryLabel(slug: string | null | undefined): string {
  if (!slug) return "Uncategorized";
  return INDUSTRIES.find((i) => i.slug === slug)?.label ?? slug;
}
