// The Shopify ops demo stores whose live theme is tracked. The first one
// is the original store: history rows from before multi-store tracking have
// no `store` field and belong to it.
export const DEMO_STORES = ["theme-store-ops-admin.myshopify.com", "theme-store-ops-breaking.myshopify.com"] as const;

export type DemoStoreDomain = (typeof DEMO_STORES)[number];

export const DEFAULT_DEMO_STORE: DemoStoreDomain = DEMO_STORES[0];

export function demoStoreUrl(store: string): string {
  return `https://${store}/`;
}
