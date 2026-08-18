import { describe, expect, it } from "vitest";
import { getPageLabel } from "./pageLabel";

describe("getPageLabel", () => {
  it("maps well-known top-level templates to their storefront page name", () => {
    expect(getPageLabel("templates/index.json")).toBe("Home page");
    expect(getPageLabel("templates/product.json")).toBe("Product page");
    expect(getPageLabel("templates/collection.json")).toBe("Collection page");
    expect(getPageLabel("templates/cart.json")).toBe("Cart page");
    expect(getPageLabel("templates/search.json")).toBe("Search results page");
    expect(getPageLabel("templates/404.json")).toBe("404 error page");
  });

  it("resolves named alternate templates to a more specific label than the generic base", () => {
    expect(getPageLabel("templates/page.contact.json")).toBe("Contact page");
    expect(getPageLabel("templates/page.json")).toBe("Page");
  });

  it("falls back to the base template name for arbitrary/custom alternate templates", () => {
    expect(getPageLabel("templates/product.featured.json")).toBe("Product page");
    expect(getPageLabel("templates/collection.deluxe.json")).toBe("Collection page");
  });

  it("handles legacy .liquid templates the same as .json ones", () => {
    expect(getPageLabel("templates/index.liquid")).toBe("Home page");
  });

  it("maps known customer account templates", () => {
    expect(getPageLabel("templates/customers/account.liquid")).toBe("Customer account page");
    expect(getPageLabel("templates/customers/login.liquid")).toBe("Customer login page");
  });

  it("falls back to a generic label for an unrecognized customer template", () => {
    expect(getPageLabel("templates/customers/some_custom_template.liquid")).toBe("Customer account pages");
  });

  it("labels the layout as applying to every page", () => {
    expect(getPageLabel("layout/theme.liquid")).toBe("Every page (layout)");
  });

  it("returns null for sections, snippets, and other non-template paths that aren't tied to one specific page", () => {
    expect(getPageLabel("sections/header.liquid")).toBeNull();
    expect(getPageLabel("snippets/product-card.liquid")).toBeNull();
    expect(getPageLabel("assets/theme.css")).toBeNull();
    expect(getPageLabel("config/settings_schema.json")).toBeNull();
  });

  it("returns null for a completely unrecognized template name", () => {
    expect(getPageLabel("templates/some-totally-custom-template.json")).toBeNull();
  });
});
