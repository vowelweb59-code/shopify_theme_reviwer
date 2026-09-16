import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { SHOPIFY_SETTINGS_RULES } from "./settings";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function findingsFor(ruleId: string, theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = SHOPIFY_SETTINGS_RULES.find((r) => r.ruleId === ruleId)!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("SHOPIFY-SETTINGS-NO-PLACEHOLDER-001", () => {
  it("flags a setting default containing Lorem Ipsum text", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": `{% schema %}{"name":"Hero","settings":[{"id":"heading","type":"text","label":"Heading","default":"Lorem ipsum dolor sit amet"}]}{% endschema %}`,
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-SETTINGS-NO-PLACEHOLDER-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("Lorem Ipsum");
  });

  it("does not flag a descriptive default value", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": `{% schema %}{"name":"Hero","settings":[{"id":"heading","type":"text","label":"Heading","default":"Welcome to our store"}]}{% endschema %}`,
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SETTINGS-NO-PLACEHOLDER-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-SETTINGS-LABEL-001", () => {
  it("flags a setting with no label", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": `{% schema %}{"name":"Hero","settings":[{"id":"heading","type":"text"}]}{% endschema %}`,
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-SETTINGS-LABEL-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("heading");
  });

  it("does not flag a setting that has a label", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": `{% schema %}{"name":"Hero","settings":[{"id":"heading","type":"text","label":"Heading"}]}{% endschema %}`,
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SETTINGS-LABEL-001", theme)).toHaveLength(0);
  });

  it("exempts header/paragraph settings, which use content instead of a label", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": `{% schema %}{"name":"Hero","settings":[{"type":"header","content":"Layout"}]}{% endschema %}`,
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SETTINGS-LABEL-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-SETTINGS-SENTENCE-CASE-001", () => {
  it("flags a section name that looks like Title Case", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": `{% schema %}{"name":"Featured Collection"}{% endschema %}`,
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-SETTINGS-SENTENCE-CASE-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("Featured Collection");
  });

  it("does not flag a name already in sentence case", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": `{% schema %}{"name":"Featured collection"}{% endschema %}`,
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SETTINGS-SENTENCE-CASE-001", theme)).toHaveLength(0);
  });

  it("does not flag a single-word name", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": `{% schema %}{"name":"Header"}{% endschema %}`,
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SETTINGS-SENTENCE-CASE-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-COLOR-SYSTEM-001", () => {
  it("flags fewer than 4 color settings theme-wide", () => {
    const theme = buildTestTheme({
      "config/settings_schema.json": JSON.stringify([
        { name: "Colors", settings: [{ type: "color", id: "c1" }, { type: "color", id: "c2" }] },
      ]),
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-COLOR-SYSTEM-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("only 2");
  });

  it("does not flag 4 or more color settings theme-wide", () => {
    const theme = buildTestTheme({
      "config/settings_schema.json": JSON.stringify([
        {
          name: "Colors",
          settings: [
            { type: "color", id: "c1" },
            { type: "color", id: "c2" },
            { type: "color", id: "c3" },
            { type: "color", id: "c4" },
          ],
        },
      ]),
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-COLOR-SYSTEM-001", theme)).toHaveLength(0);
  });

  it("does not flag when there are no color settings at all (likely no schema found)", () => {
    const theme = buildTestTheme({
      "config/settings_schema.json": JSON.stringify([{ name: "Colors", settings: [] }]),
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-COLOR-SYSTEM-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-SOCIAL-OG-TAGS-001", () => {
  it("flags a theme with no Open Graph or Twitter card tags", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "<html><head></head><body></body></html>" });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-SOCIAL-OG-TAGS-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("Open Graph");
    expect(findings[0].finding).toContain("Twitter card");
  });

  it("does not flag when both Open Graph and Twitter card tags are present", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid":
        '<html><head><meta property="og:title" content="Store"><meta name="twitter:card" content="summary"></head><body></body></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SOCIAL-OG-TAGS-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-SOCIAL-PLACEHOLDER-001", () => {
  it("flags a social link setting pre-filled with an example URL", () => {
    const theme = buildTestTheme({
      "config/settings_schema.json": JSON.stringify([
        { name: "Social media", settings: [{ id: "social_facebook_link", type: "text", default: "https://facebook.com/example" }] },
      ]),
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-SOCIAL-PLACEHOLDER-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("social_facebook_link");
  });

  it("does not flag a social link setting left empty", () => {
    const theme = buildTestTheme({
      "config/settings_schema.json": JSON.stringify([
        { name: "Social media", settings: [{ id: "social_facebook_link", type: "text", default: "" }] },
      ]),
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SOCIAL-PLACEHOLDER-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-COLLECTION-002", () => {
  it("flags a collection template missing collection.image and price_varies", () => {
    const theme = buildTestTheme({
      "sections/main-collection.liquid": "<div>{{ collection.title }}</div>",
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-COLLECTION-002", theme);
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.finding).join(" ")).toContain("collection.image");
    expect(findings.map((f) => f.finding).join(" ")).toContain("price_varies");
  });

  it("does not flag a collection template outputting both collection.image and price_varies", () => {
    const theme = buildTestTheme({
      "sections/main-collection.liquid": "<div>{{ collection.image | image_url }} {% if product.price_varies %}From{% endif %}</div>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-COLLECTION-002", theme)).toHaveLength(0);
  });

  it("does not run at all when the theme has no collection-related file", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": "<div>Hero</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-COLLECTION-002", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-BLOG-001", () => {
  it("flags a blog template missing blog.title and using article.content directly", () => {
    const theme = buildTestTheme({
      "sections/main-blog.liquid": "<div>{{ article.content }}</div>",
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-BLOG-001", theme);
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.finding).join(" ")).toContain("blog.title");
    expect(findings.map((f) => f.finding).join(" ")).toContain("excerpt_or_content");
  });

  it("does not flag a blog template outputting blog.title and using article.excerpt_or_content", () => {
    const theme = buildTestTheme({
      "sections/main-blog.liquid": "<div>{{ blog.title }} {{ article.excerpt_or_content }}</div>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-BLOG-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-ARTICLE-001", () => {
  it("flags an article template using article.created_at without article.published_at", () => {
    const theme = buildTestTheme({
      "sections/main-article.liquid": "<time>{{ article.created_at }}</time>",
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-ARTICLE-001", theme);
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.finding).join(" ")).toContain("article.created_at");
    expect(findings.map((f) => f.finding).join(" ")).toContain("article.published_at");
  });

  it("does not flag an article template using article.published_at", () => {
    const theme = buildTestTheme({
      "sections/main-article.liquid": "<time>{{ article.published_at }}</time>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-ARTICLE-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-PAGE-CONTACT-001", () => {
  it("flags a theme with no templates/page.contact alternate template", () => {
    const theme = buildTestTheme({ "templates/page.json": JSON.stringify({ sections: {}, order: [] }) });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-PAGE-CONTACT-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("No templates/page.contact");
  });

  it("does not flag when the contact template exists and outputs page.title/page.content", () => {
    const theme = buildTestTheme({
      "templates/page.contact.json": JSON.stringify({ sections: { main: { type: "page-contact" } }, order: ["main"] }),
      "sections/page-contact.liquid": "<div>{{ page.title }} {{ page.content }}</div>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-PAGE-CONTACT-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-PASSWORD-001", () => {
  it("flags a theme with no templates/password template", () => {
    const theme = buildTestTheme({ "templates/index.json": JSON.stringify({ sections: {}, order: [] }) });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-PASSWORD-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("No templates/password");
  });

  it("flags a password template that never references shop.password_message", () => {
    const theme = buildTestTheme({
      "templates/password.json": JSON.stringify({ sections: { main: { type: "password" } }, order: ["main"] }),
      "sections/password.liquid": "<div>{{ shop.name }}</div>",
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SHOPIFY-PASSWORD-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("shop.password_message");
  });

  it("does not flag a password template that references shop.password_message", () => {
    const theme = buildTestTheme({
      "templates/password.json": JSON.stringify({ sections: { main: { type: "password" } }, order: ["main"] }),
      "sections/password.liquid": "<div>{{ shop.password_message }}</div>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-PASSWORD-001", theme)).toHaveLength(0);
  });
});
