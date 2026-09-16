import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { INTERNAL_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function axisDuplicateFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = INTERNAL_RULES.find((r) => r.ruleId === "INTERNAL-SECTION-AXIS-DUPLICATE-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("INTERNAL-SECTION-AXIS-DUPLICATE-001", () => {
  it("flags two same-type sections that both organize by recency/popularity, despite different wording", () => {
    const theme = buildTestTheme({
      "templates/index.json": JSON.stringify({
        sections: {
          "new-arrivals": { type: "featured-collection", settings: { heading: "New Arrivals" } },
          "hot-picks": { type: "featured-collection", settings: { heading: "Trending Now" } },
        },
        order: ["new-arrivals", "hot-picks"],
      }),
    });
    cleanup = theme.cleanup;
    const findings = axisDuplicateFindings(theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("recency/popularity");
  });

  // Regression case straight from the user's own example: "shop by brand"
  // and "shop by age" are both collection sections, but organize around
  // genuinely different customer jobs — this must never be flagged.
  it("does not flag two same-type sections organizing by different axes (brand vs. age)", () => {
    const theme = buildTestTheme({
      "templates/index.json": JSON.stringify({
        sections: {
          "by-brand": { type: "featured-collection", settings: { heading: "Shop by Brand" } },
          "by-age": { type: "featured-collection", settings: { heading: "Shop by Age" } },
        },
        order: ["by-brand", "by-age"],
      }),
    });
    cleanup = theme.cleanup;
    expect(axisDuplicateFindings(theme)).toHaveLength(0);
  });

  it("does not flag when heading text doesn't match any known merchandising axis", () => {
    const theme = buildTestTheme({
      "templates/index.json": JSON.stringify({
        sections: {
          a: { type: "featured-collection", settings: { heading: "Our Favorites" } },
          b: { type: "featured-collection", settings: { heading: "Editor's Picks" } },
        },
        order: ["a", "b"],
      }),
    });
    cleanup = theme.cleanup;
    expect(axisDuplicateFindings(theme)).toHaveLength(0);
  });

  it("does not flag a single section with no duplicate", () => {
    const theme = buildTestTheme({
      "templates/index.json": JSON.stringify({
        sections: { a: { type: "featured-collection", settings: { heading: "New Arrivals" } } },
        order: ["a"],
      }),
    });
    cleanup = theme.cleanup;
    expect(axisDuplicateFindings(theme)).toHaveLength(0);
  });

  it("does not flag two sections of different types even on the same axis", () => {
    const theme = buildTestTheme({
      "templates/index.json": JSON.stringify({
        sections: {
          a: { type: "featured-collection", settings: { heading: "New Arrivals" } },
          b: { type: "product-list", settings: { heading: "Trending Now" } },
        },
        order: ["a", "b"],
      }),
    });
    cleanup = theme.cleanup;
    expect(axisDuplicateFindings(theme)).toHaveLength(0);
  });

  it("classifies via a collection handle when there's no heading text", () => {
    const theme = buildTestTheme({
      "templates/index.json": JSON.stringify({
        sections: {
          a: { type: "featured-collection", settings: { collection: "new-arrivals" } },
          b: { type: "featured-collection", settings: { collection: "best-sellers" } },
        },
        order: ["a", "b"],
      }),
    });
    cleanup = theme.cleanup;
    expect(axisDuplicateFindings(theme)).toHaveLength(1);
  });

  it("ignores non-merchandising section types entirely", () => {
    const theme = buildTestTheme({
      "templates/index.json": JSON.stringify({
        sections: {
          a: { type: "rich-text", settings: { heading: "New Arrivals" } },
          b: { type: "rich-text", settings: { heading: "Trending Now" } },
        },
        order: ["a", "b"],
      }),
    });
    cleanup = theme.cleanup;
    expect(axisDuplicateFindings(theme)).toHaveLength(0);
  });
});
