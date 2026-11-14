import type { ProjectStatus } from "./constants";

// After a theme is submitted, its status follows where it shows up (owner, 2026-11-14):
//   on either Shopify ops demo store (theme-store-ops-admin / theme-store-ops-breaking) = Under Review,
//   live on the public Shopify Theme Store = Live.
// Both only move a project forward, out of the statuses before them: a project the owner has set to Rejected, Active, On Hold or
// Completed is never touched, and Error Given (Shopify sent errors) is left for the owner unless the theme then goes Live.

/** Statuses a theme can still be in before Shopify has it under review. */
export const BEFORE_REVIEW: readonly string[] = ["planning", "under_designing", "design_completed", "under_development", "theme_uploaded"];
/** Statuses a theme can still be in before it is Live. */
export const BEFORE_LIVE: readonly string[] = [...BEFORE_REVIEW, "under_review", "error_given"];

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A demo store's theme name ("Apollo", "Apollo 1.0.0", "Apollo - Gaming") names this theme: the whole name, or it as the first words. */
export function storeNameMatchesTheme(storeName: string | null | undefined, themeName: string): boolean {
  const s = key(storeName ?? "");
  const t = key(themeName);
  return t.length > 0 && (s === t || s.startsWith(`${t} `));
}

export type StoreFacts = { onOpsStore: boolean; listed: boolean };

/** The status a theme project should move to given where its theme is seen, or null to leave it. */
export function detectReviewStatus(current: string | null, facts: StoreFacts): ProjectStatus | null {
  if (current === null) return null;
  if (facts.listed && BEFORE_LIVE.includes(current)) return "live";
  if (facts.onOpsStore && BEFORE_REVIEW.includes(current)) return "under_review";
  return null;
}
