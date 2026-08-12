// Deliberately minimal starter list — only entries verified against an
// official Shopify source are included, rather than guessing at a supposedly
// exhaustive list. Extend as more are confirmed (see
// https://shopify.dev/changelog for deprecation announcements).
export type DeprecatedEntry = {
  token: string;
  referenceType: "object" | "filter" | "tag" | "other";
  replacement: string;
  sourceUrl: string;
};

export const DEPRECATED_LIQUID_REFERENCES: DeprecatedEntry[] = [
  {
    token: "include",
    referenceType: "tag",
    replacement: "render",
    sourceUrl: "https://shopify.dev/changelog/deprecating-the-include-liquid-tag-and-introducing-the-render-tag",
  },
];

export const DEPRECATED_TAG_NAMES = new Set(
  DEPRECATED_LIQUID_REFERENCES.filter((e) => e.referenceType === "tag").map((e) => e.token)
);
export const DEPRECATED_FILTER_NAMES = new Set(
  DEPRECATED_LIQUID_REFERENCES.filter((e) => e.referenceType === "filter").map((e) => e.token)
);
export const DEPRECATED_OBJECT_NAMES = new Set(
  DEPRECATED_LIQUID_REFERENCES.filter((e) => e.referenceType === "object").map((e) => e.token)
);
