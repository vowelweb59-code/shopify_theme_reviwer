import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { ACCESSIBILITY_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function outlineFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-OUTLINE-REMOVAL-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-OUTLINE-REMOVAL-001", () => {
  it("flags outline removal with no focus replacement anywhere in the file", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".btn { outline: none; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(outlineFindings(theme)).toHaveLength(1);
  });

  it("does not flag when a separate :focus rule on the same selector provides a replacement", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".btn { outline: 0; } .btn:focus { box-shadow: 0 0 0 2px blue; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(outlineFindings(theme)).toHaveLength(0);
  });

  // Regression test: found auditing Shopify's own Dawn theme. The removal
  // can be declared directly inside its own :focus rule (not a separate
  // plain-selector rule) while a sibling :focus-visible rule supplies the
  // real replacement — the removal's own selector must be pseudo-class-
  // stripped the same way the candidate replacements are, or this valid
  // pattern is misread as having no replacement at all.
  it("does not flag outline:none set inside the :focus rule itself when :focus-visible supplies a replacement", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".btn:focus { outline: none; } .btn:focus-visible { outline: 2px solid blue; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(outlineFindings(theme)).toHaveLength(0);
  });

  it("formats a multi-line compound selector as a single line in the finding message", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".a:hover.a:after,\n.b:hover.b:after {\n  outline: none;\n}",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    const findings = outlineFindings(theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).not.toContain("\n");
  });
});

function focusOrderFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-TABINDEX-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-TABINDEX-001", () => {
  it("flags a plain autofocus attribute (page-load focus theft)", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "<input autofocus>" });
    cleanup = theme.cleanup;
    expect(focusOrderFindings(theme)).toHaveLength(1);
  });

  // Regression test: found auditing a real theme (Splash), whose contact
  // form uses <h2 tabindex="-1" autofocus> to shift focus to a
  // success/error status message after submission — a standard, deliberate
  // accessibility technique, not the page-load focus-theft anti-pattern
  // this rule targets. Flagging it would tell a developer to remove
  // something that makes the theme *more* accessible, not less.
  it("does not flag autofocus paired with tabindex=\"-1\" (focus management for a dynamic status message)", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<h2 tabindex="-1" autofocus>Submitted successfully</h2>',
    });
    cleanup = theme.cleanup;
    expect(focusOrderFindings(theme)).toHaveLength(0);
  });

  it("still flags a positive tabindex value", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<div tabindex="3"></div>' });
    cleanup = theme.cleanup;
    const findings = focusOrderFindings(theme);
    expect(findings.some((f) => f.finding.includes("tabindex"))).toBe(true);
  });
});

function ariaHiddenFocusFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-ARIA-HIDDEN-FOCUS-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-ARIA-HIDDEN-FOCUS-001", () => {
  it("flags a link that is aria-hidden but still keyboard-focusable", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<a href="/cart" aria-hidden="true">Cart</a>' });
    cleanup = theme.cleanup;
    expect(ariaHiddenFocusFindings(theme)).toHaveLength(1);
  });

  it("does not flag a link that is aria-hidden and removed from the tab order", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<a href="/cart" aria-hidden="true" tabindex="-1">Cart</a>' });
    cleanup = theme.cleanup;
    expect(ariaHiddenFocusFindings(theme)).toHaveLength(0);
  });

  it("does not flag a link with no aria-hidden at all", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<a href="/cart">Cart</a>' });
    cleanup = theme.cleanup;
    expect(ariaHiddenFocusFindings(theme)).toHaveLength(0);
  });

  it("flags an aria-hidden button that remains focusable", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<button aria-hidden="true">Submit</button>' });
    cleanup = theme.cleanup;
    expect(ariaHiddenFocusFindings(theme)).toHaveLength(1);
  });

  it("does not flag an aria-hidden button that is also disabled (already unreachable)", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<button aria-hidden="true" disabled>Submit</button>' });
    cleanup = theme.cleanup;
    expect(ariaHiddenFocusFindings(theme)).toHaveLength(0);
  });

  it("flags an aria-hidden input that remains focusable", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<input aria-hidden="true" name="email">' });
    cleanup = theme.cleanup;
    expect(ariaHiddenFocusFindings(theme)).toHaveLength(1);
  });

  it("flags a generic role-based interactive element that is aria-hidden with an explicit tabindex", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<div role="button" tabindex="0" aria-hidden="true">Toggle</div>' });
    cleanup = theme.cleanup;
    expect(ariaHiddenFocusFindings(theme)).toHaveLength(1);
  });

  it("does not flag a generic interactive element that is aria-hidden with tabindex=-1", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": '<div role="button" tabindex="-1" aria-hidden="true">Toggle</div>' });
    cleanup = theme.cleanup;
    expect(ariaHiddenFocusFindings(theme)).toHaveLength(0);
  });
});

function reducedMotionFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-REDUCED-MOTION-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-REDUCED-MOTION-001", () => {
  it("flags meaningful CSS animation with no prefers-reduced-motion accommodation anywhere", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".hero { transition: transform 0.6s ease; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(reducedMotionFindings(theme)).toHaveLength(1);
  });

  it("does not flag when a prefers-reduced-motion media query exists, even in a different file", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".hero { transition: transform 0.6s ease; }",
      "assets/base.css": "@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(reducedMotionFindings(theme)).toHaveLength(0);
  });

  it("does not flag a theme with no meaningful animation at all", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".hero { transition: none; color: red; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(reducedMotionFindings(theme)).toHaveLength(0);
  });
});

function skipLinkFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-SKIP-LINK-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-SKIP-LINK-001", () => {
  it("flags a layout with no skip link anywhere", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "<html><body><header></header></body></html>" });
    cleanup = theme.cleanup;
    expect(skipLinkFindings(theme)).toHaveLength(1);
  });

  it("does not flag when a skip-to-content link exists", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><body><a href="#MainContent">Skip to content</a></body></html>',
    });
    cleanup = theme.cleanup;
    expect(skipLinkFindings(theme)).toHaveLength(0);
  });

  it("does not flag when the skip link lives in a snippet, not the layout", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><body>{% render 'skip-link' %}</body></html>",
      "snippets/skip-link.liquid": '<a href="#MainContent">Skip to main content</a>',
    });
    cleanup = theme.cleanup;
    expect(skipLinkFindings(theme)).toHaveLength(0);
  });
});

function ariaExpandedFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-ARIA-EXPANDED-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-ARIA-EXPANDED-001", () => {
  it("flags a dropdown trigger with aria-controls but no aria-expanded", () => {
    const theme = buildTestTheme({
      "sections/header.liquid": '<button aria-controls="submenu-1">Shop</button>',
    });
    cleanup = theme.cleanup;
    expect(ariaExpandedFindings(theme)).toHaveLength(1);
  });

  it("does not flag when aria-expanded is present alongside aria-controls", () => {
    const theme = buildTestTheme({
      "sections/header.liquid": '<button aria-controls="submenu-1" aria-expanded="false">Shop</button>',
    });
    cleanup = theme.cleanup;
    expect(ariaExpandedFindings(theme)).toHaveLength(0);
  });

  it("does not flag an element with neither attribute", () => {
    const theme = buildTestTheme({ "sections/header.liquid": "<button>Shop</button>" });
    cleanup = theme.cleanup;
    expect(ariaExpandedFindings(theme)).toHaveLength(0);
  });
});

function clickNoKeyboardFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-CLICK-NO-KEYBOARD-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-CLICK-NO-KEYBOARD-001", () => {
  it("flags a div with a click handler and no tabindex", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": '<div onclick="doThing()">Click me</div>' });
    cleanup = theme.cleanup;
    expect(clickNoKeyboardFindings(theme)).toHaveLength(1);
  });

  it("does not flag a div with a click handler that also has a tabindex", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": '<div onclick="doThing()" tabindex="0">Click me</div>' });
    cleanup = theme.cleanup;
    expect(clickNoKeyboardFindings(theme)).toHaveLength(0);
  });

  it("does not flag a real <button> with a click handler", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": '<button onclick="doThing()">Click me</button>' });
    cleanup = theme.cleanup;
    expect(clickNoKeyboardFindings(theme)).toHaveLength(0);
  });
});

function cssOrderFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-CSS-ORDER-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-CSS-ORDER-001", () => {
  it("flags a non-zero order value", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".nav-item { order: 2; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(cssOrderFindings(theme)).toHaveLength(1);
  });

  it("does not flag order: 0 (the default, a no-op)", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".nav-item { order: 0; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(cssOrderFindings(theme)).toHaveLength(0);
  });

  it("does not flag a file with no order declarations", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".nav-item { display: flex; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(cssOrderFindings(theme)).toHaveLength(0);
  });
});
