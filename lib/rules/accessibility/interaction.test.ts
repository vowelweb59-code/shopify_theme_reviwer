import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { ACCESSIBILITY_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function findingsFor(ruleId: string, files: Record<string, string>): RuleFinding[] {
  const theme = buildTestTheme(files);
  cleanup = theme.cleanup;
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === ruleId)!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-HOVER-ONLY-MENU-001", () => {
  it("flags a submenu revealed only by :hover in an assets stylesheet", () => {
    const findings = findingsFor("A11Y-HOVER-ONLY-MENU-001", {
      "assets/header.css": ".submenu { display: none; }\n.menu-item:hover .submenu { display: block; }",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(2);
    expect(findings[0].finding).toContain(".submenu");
  });

  it("flags hover-only CSS inside a section's {% stylesheet %}, with the file's own line number", () => {
    const findings = findingsFor("A11Y-HOVER-ONLY-MENU-001", {
      "sections/header.liquid":
        "<nav></nav>\n{% stylesheet %}\n  .header__dropdown { opacity: 0; }\n  #shopify-section-{{ section.id }} .nav-item:hover > .header__dropdown { opacity: 1; visibility: visible; }\n{% endstylesheet %}",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("sections/header.liquid");
    expect(findings[0].lineNumber).toBe(4);
  });

  it("resolves native CSS nesting", () => {
    const findings = findingsFor("A11Y-HOVER-ONLY-MENU-001", {
      "assets/header.css": ".menu-item {\n  &:hover .mega-menu { display: grid; }\n}",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain(".menu-item:hover .mega-menu");
  });

  it("does not flag when the same rule also reveals on :focus-within", () => {
    const findings = findingsFor("A11Y-HOVER-ONLY-MENU-001", {
      "assets/header.css": ".menu-item:hover .submenu, .menu-item:focus-within .submenu { display: block; }",
    });
    expect(findings).toHaveLength(0);
  });

  it("does not flag when another rule reveals the same submenu through an open state", () => {
    const findings = findingsFor("A11Y-HOVER-ONLY-MENU-001", {
      "assets/header.css": ".menu-item:hover .submenu { display: block; }",
      "assets/menu-open.css": ".menu-item.is-open .submenu { display: block; }",
    });
    expect(findings).toHaveLength(0);
  });

  it("ignores hover styling that doesn't reveal a submenu", () => {
    const findings = findingsFor("A11Y-HOVER-ONLY-MENU-001", {
      "assets/header.css": ".menu-item:hover .menu-link { color: red; }\n.card:hover .media > img:first-child { opacity: 1; }",
    });
    expect(findings).toHaveLength(0);
  });

  it("flags a menu script that opens on mouseenter with no focus or key listener", () => {
    const findings = findingsFor("A11Y-HOVER-ONLY-MENU-001", {
      "assets/menu.js": "document.querySelectorAll('.menu-item').forEach((el) => {\n  el.addEventListener('mouseenter', () => el.classList.add('is-open'));\n});",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(2);
  });

  it("does not flag a menu script that also handles focus", () => {
    const findings = findingsFor("A11Y-HOVER-ONLY-MENU-001", {
      "assets/menu.js":
        "el.addEventListener('mouseenter', open); // .menu-item\nel.addEventListener('focusin', open);",
    });
    expect(findings).toHaveLength(0);
  });
});

describe("A11Y-HIDDEN-FOCUSABLE-001", () => {
  it("flags a link inside an aria-hidden duplicate track", () => {
    const findings = findingsFor("A11Y-HIDDEN-FOCUSABLE-001", {
      "sections/scrolling-text.liquid":
        '<div class="marquee">\n  <div class="track"><a href="/products/a">A</a></div>\n  <div class="track" aria-hidden="true">\n    <a href="/products/a">A</a>\n  </div>\n</div>',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(4);
    expect(findings[0].finding).toContain("line 3");
  });

  it("does not flag when the hidden container is inert or its links have tabindex=-1", () => {
    const findings = findingsFor("A11Y-HIDDEN-FOCUSABLE-001", {
      "sections/a.liquid": '<div aria-hidden="true" inert><a href="/x">X</a></div>',
      "sections/b.liquid": '<div aria-hidden="true"><a href="/x" tabindex="-1">X</a><span>text</span></div>',
    });
    expect(findings).toHaveLength(0);
  });

  it("does not flag focusable elements after the hidden container closes", () => {
    const findings = findingsFor("A11Y-HIDDEN-FOCUSABLE-001", {
      "sections/a.liquid": '<div aria-hidden="true"><span>icon</span></div>\n<a href="/x">X</a>',
    });
    expect(findings).toHaveLength(0);
  });

  it("flags a script that keeps an aria-hidden clone without inert or tabindex", () => {
    const findings = findingsFor("A11Y-HIDDEN-FOCUSABLE-001", {
      "assets/marquee.js": "const copy = this.track.cloneNode(true);\ncopy.setAttribute('aria-hidden', 'true');\nthis.append(copy);",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(1);
  });

  it("does not flag an inert clone, or a measuring clone that is removed again", () => {
    expect(
      findingsFor("A11Y-HIDDEN-FOCUSABLE-001", {
        "assets/marquee.js": "const copy = el.cloneNode(true);\ncopy.setAttribute('aria-hidden', 'true');\ncopy.inert = true;",
      })
    ).toHaveLength(0);
    cleanup?.();
    expect(
      findingsFor("A11Y-HIDDEN-FOCUSABLE-001", {
        "assets/fit.js": "const clone = el.cloneNode(true);\nclone.setAttribute('aria-hidden', 'true');\nconst w = clone.offsetWidth;\nclone.remove();",
      })
    ).toHaveLength(0);
  });
});

describe("A11Y-FOCUS-RESTORE-001", () => {
  it("flags a cart script that re-renders without restoring focus", () => {
    const findings = findingsFor("A11Y-FOCUS-RESTORE-001", {
      "assets/cart-drawer.js":
        "async function update(line, qty) {\n  const res = await fetch('/cart/change.js', { method: 'POST' });\n  drawer.innerHTML = await res.text();\n}",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(3);
  });

  it("flags the same pattern in an inline <script> with the Liquid file's line number", () => {
    const findings = findingsFor("A11Y-FOCUS-RESTORE-001", {
      "snippets/cart-drawer.liquid":
        "<div id=\"drawer\"></div>\n<script>\n  fetch('{{ routes.cart_change_url }}').then(r => r.text()).then(html => {\n    drawer.innerHTML = html;\n  });\n</script>",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(4);
  });

  it("does not flag a cart script that saves and restores document.activeElement", () => {
    const findings = findingsFor("A11Y-FOCUS-RESTORE-001", {
      "assets/cart.js":
        "const name = document.activeElement.getAttribute('name');\nfetch('/cart/change.js');\nitems.innerHTML = html;\nitems.querySelector(`[name=\"${name}\"]`).focus();",
    });
    expect(findings).toHaveLength(0);
  });

  it("does not flag non-cart scripts that set innerHTML", () => {
    const findings = findingsFor("A11Y-FOCUS-RESTORE-001", {
      "assets/search.js": "fetch('/search/suggest').then(r => r.text()).then(h => { results.innerHTML = h; });",
    });
    expect(findings).toHaveLength(0);
  });
});

describe("A11Y-OUTLINE-REMOVAL-001 (embedded CSS)", () => {
  it("flags outline: none inside a section's {% stylesheet %} with no focus replacement", () => {
    const findings = findingsFor("A11Y-OUTLINE-REMOVAL-001", {
      "sections/hero.liquid": "<a class=\"hero__link\" href=\"/\">Go</a>\n{% stylesheet %}\n.hero__link { outline: none; }\n{% endstylesheet %}",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(3);
  });

  it("does not flag when the same file styles :focus-visible for that selector", () => {
    const findings = findingsFor("A11Y-OUTLINE-REMOVAL-001", {
      "sections/hero.liquid":
        "<style>\n.hero__link { outline: none; }\n.hero__link:focus-visible { box-shadow: 0 0 0 2px; }\n</style>",
    });
    expect(findings).toHaveLength(0);
  });
});
