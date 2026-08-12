import type { Rule } from "@/lib/audit/rules";
import { SHOPIFY_RULES } from "./shopify";
import { ACCESSIBILITY_RULES } from "./accessibility";
import { TECHNICAL_SEO_RULES } from "./technical-seo";
import { TECHNICAL_AEO_RULES } from "./technical-aeo";
import { BUG_RULES } from "./bugs";
import { CROSS_FILE_RULES } from "./cross-file";
import { INTERNAL_RULES } from "./internal";

export const ALL_RULES: Rule[] = [
  ...SHOPIFY_RULES,
  ...ACCESSIBILITY_RULES,
  ...TECHNICAL_SEO_RULES,
  ...TECHNICAL_AEO_RULES,
  ...BUG_RULES,
  ...CROSS_FILE_RULES,
  ...INTERNAL_RULES,
];
