import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { SHOPIFY_FEATURE_RULES } from "./features";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function findingsFor(ruleId: string, theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = SHOPIFY_FEATURE_RULES.find((r) => r.ruleId === ruleId)!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("SHOPIFY-FEATURES-ACCOUNT-COMPONENT-001", () => {
  it("flags a theme with no <shopify-account> element anywhere", () => {
    const theme = buildTestTheme({ "sections/header.liquid": "<div>Account</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-ACCOUNT-COMPONENT-001", theme)).toHaveLength(1);
  });

  it("does not flag when <shopify-account> is present", () => {
    const theme = buildTestTheme({ "sections/header.liquid": "<shopify-account></shopify-account>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-ACCOUNT-COMPONENT-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-CHECKOUT-BTN-001", () => {
  it("flags a theme with no payment_button or content_for_additional_checkout_buttons reference", () => {
    const theme = buildTestTheme({ "sections/product-form.liquid": "<button>Checkout</button>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-CHECKOUT-BTN-001", theme)).toHaveLength(1);
  });

  it("does not flag when the payment_button filter is used", () => {
    const theme = buildTestTheme({ "sections/product-form.liquid": "{{ form | payment_button }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-CHECKOUT-BTN-001", theme)).toHaveLength(0);
  });

  it("does not flag when content_for_additional_checkout_buttons is output", () => {
    const theme = buildTestTheme({ "templates/cart.liquid": "{{ content_for_additional_checkout_buttons }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-CHECKOUT-BTN-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-COMPLEMENTARY-001", () => {
  it("flags a theme with no reference to complementary products", () => {
    const theme = buildTestTheme({ "sections/product.liquid": "<div>Related products only</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-COMPLEMENTARY-001", theme)).toHaveLength(1);
  });

  it("does not flag when complementary products are referenced", () => {
    const theme = buildTestTheme({ "sections/product.liquid": "<div>Complementary products</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-COMPLEMENTARY-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-COUNTRY-SELECT-001", () => {
  it("flags a theme with no localization.available_countries reference", () => {
    const theme = buildTestTheme({ "sections/footer.liquid": "<div>Footer</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-COUNTRY-SELECT-001", theme)).toHaveLength(1);
  });

  it("does not flag when localization.available_countries is used", () => {
    const theme = buildTestTheme({
      "sections/footer.liquid": "{% form 'localization' %}{% for country in localization.available_countries %}{% endfor %}{% endform %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-COUNTRY-SELECT-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-DISCOUNTS-001", () => {
  it("flags a theme with no discount_allocations or cart_level_discount_applications reference", () => {
    const theme = buildTestTheme({ "templates/cart.liquid": "<div>Cart</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-DISCOUNTS-001", theme)).toHaveLength(1);
  });

  it("does not flag when line_item.discount_allocations is displayed", () => {
    const theme = buildTestTheme({ "templates/cart.liquid": "{{ line_item.discount_allocations }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-DISCOUNTS-001", theme)).toHaveLength(0);
  });

  it("does not flag when cart.cart_level_discount_applications is displayed", () => {
    const theme = buildTestTheme({ "templates/cart.liquid": "{{ cart.cart_level_discount_applications }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-DISCOUNTS-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-FACETED-SEARCH-001", () => {
  it("flags a theme with no collection.filters or search.filters reference", () => {
    const theme = buildTestTheme({ "templates/collection.liquid": "<div>Collection</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-FACETED-SEARCH-001", theme)).toHaveLength(1);
  });

  it("does not flag when collection.filters is rendered", () => {
    const theme = buildTestTheme({ "templates/collection.liquid": "{% for filter in collection.filters %}{% endfor %}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-FACETED-SEARCH-001", theme)).toHaveLength(0);
  });

  it("does not flag when search.filters is rendered", () => {
    const theme = buildTestTheme({ "templates/search.liquid": "{% for filter in search.filters %}{% endfor %}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-FACETED-SEARCH-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-FOLLOW-SHOP-001", () => {
  it("flags a theme with no login_button filter reference", () => {
    const theme = buildTestTheme({ "sections/footer.liquid": "<div>Footer</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-FOLLOW-SHOP-001", theme)).toHaveLength(1);
  });

  it("does not flag when the login_button filter is used", () => {
    const theme = buildTestTheme({ "sections/footer.liquid": "{{ shop | login_button }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-FOLLOW-SHOP-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-IMAGE-FOCAL-001", () => {
  it("flags a theme with no focal_point reference", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": '<img src="hero.jpg">' });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-IMAGE-FOCAL-001", theme)).toHaveLength(1);
  });

  it("does not flag when focal_point is used", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": "{{ image.presentation.focal_point }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-IMAGE-FOCAL-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-LANGUAGE-SELECT-001", () => {
  it("flags a theme with no localization.available_languages reference", () => {
    const theme = buildTestTheme({ "sections/footer.liquid": "<div>Footer</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-LANGUAGE-SELECT-001", theme)).toHaveLength(1);
  });

  it("does not flag when localization.available_languages is used", () => {
    const theme = buildTestTheme({
      "sections/footer.liquid": "{% form 'localization' %}{% for language in localization.available_languages %}{% endfor %}{% endform %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-LANGUAGE-SELECT-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-MULTILEVEL-MENU-001", () => {
  it("flags a theme with no loop over a link's own .links", () => {
    const theme = buildTestTheme({ "sections/header.liquid": '<nav><a href="/">Home</a></nav>' });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-MULTILEVEL-MENU-001", theme)).toHaveLength(1);
  });

  it("does not flag when the menu recurses into link.links", () => {
    const theme = buildTestTheme({
      "sections/header.liquid": "{% for link in linklist.links %}{% for child_link in link.links %}{% endfor %}{% endfor %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-MULTILEVEL-MENU-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-NEWSLETTER-001", () => {
  it("flags a theme with no customer form referencing newsletter", () => {
    const theme = buildTestTheme({
      "sections/footer.liquid": "{% form 'customer' %}<input name=\"contact[email]\">{% endform %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-NEWSLETTER-001", theme)).toHaveLength(1);
  });

  it("does not flag when a customer form references newsletter", () => {
    const theme = buildTestTheme({
      "sections/footer.liquid":
        "{% form 'customer' %}<input type=\"hidden\" name=\"contact[tags]\" value=\"newsletter\">{% endform %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-NEWSLETTER-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-PICKUP-001", () => {
  it("flags a theme with no variant.store_availabilities reference", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "<div>Pickup</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-PICKUP-001", theme)).toHaveLength(1);
  });

  it("does not flag when variant.store_availabilities is used", () => {
    const theme = buildTestTheme({
      "templates/product.liquid": "{% for availability in variant.store_availabilities %}{% endfor %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-PICKUP-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-RELATED-PRODUCTS-001", () => {
  it("flags a theme with no routes.product_recommendations_url reference", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "<div>Related</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-RELATED-PRODUCTS-001", theme)).toHaveLength(1);
  });

  it("does not flag when routes.product_recommendations_url is fetched", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "{{ routes.product_recommendations_url }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-RELATED-PRODUCTS-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-RICH-MEDIA-001", () => {
  it("flags a theme with no rich-media filter/tag reference", () => {
    const theme = buildTestTheme({ "templates/product.liquid": '<img src="product.jpg">' });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-RICH-MEDIA-001", theme)).toHaveLength(1);
  });

  it("does not flag when model_viewer_tag is used", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "{{ model | model_viewer_tag }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-RICH-MEDIA-001", theme)).toHaveLength(0);
  });

  it("does not flag when external_video_tag is used", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "{{ media | external_video_tag }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-RICH-MEDIA-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-SEARCH-BOX-001", () => {
  it("flags a theme with no predictive search reference", () => {
    const theme = buildTestTheme({ "sections/header.liquid": '<form action="/search"></form>' });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SEARCH-BOX-001", theme)).toHaveLength(1);
  });

  it("does not flag when predictive search is referenced", () => {
    const theme = buildTestTheme({ "sections/header.liquid": '<predictive-search></predictive-search>' });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SEARCH-BOX-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-SELLING-PLANS-001", () => {
  it("flags a theme with no selling-plan reference", () => {
    const theme = buildTestTheme({ "templates/cart.liquid": "<div>Cart</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SELLING-PLANS-001", theme)).toHaveLength(1);
  });

  it("does not flag when line_item.selling_plan_allocation is displayed", () => {
    const theme = buildTestTheme({ "templates/cart.liquid": "{{ line_item.selling_plan_allocation }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SELLING-PLANS-001", theme)).toHaveLength(0);
  });

  it("does not flag when selling_plan_groups is referenced", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "{{ product.selling_plan_groups }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SELLING-PLANS-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-SHOP-PAY-INSTALLMENTS-001", () => {
  it("flags a theme with no {% payment_terms %} tag", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "<div>Product</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SHOP-PAY-INSTALLMENTS-001", theme)).toHaveLength(1);
  });

  it("does not flag when {% payment_terms %} is present", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "{% payment_terms %}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SHOP-PAY-INSTALLMENTS-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-SOCIAL-IMAGE-001", () => {
  it("flags a theme with no page_image reference", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<meta property="og:image">' });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SOCIAL-IMAGE-001", theme)).toHaveLength(1);
  });

  it("does not flag when page_image is used", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "{{ page_image | image_url: width: 1200 }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-SOCIAL-IMAGE-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-UNIT-PRICING-001", () => {
  it("flags a theme with no unit_price reference", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "<div>Price</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-UNIT-PRICING-001", theme)).toHaveLength(1);
  });

  it("does not flag when variant.unit_price is displayed", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "{{ variant.unit_price }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-UNIT-PRICING-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-FEATURES-VARIANT-IMAGES-001", () => {
  it("flags a theme with no variant image reference", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "<div>Gallery</div>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-VARIANT-IMAGES-001", theme)).toHaveLength(1);
  });

  it("does not flag when variant.featured_image is used", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "{{ variant.featured_image | image_url: width: 800 }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-VARIANT-IMAGES-001", theme)).toHaveLength(0);
  });

  it("does not flag when variant.image is used", () => {
    const theme = buildTestTheme({ "templates/product.liquid": "{{ variant.image | image_url: width: 800 }}" });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-FEATURES-VARIANT-IMAGES-001", theme)).toHaveLength(0);
  });
});
