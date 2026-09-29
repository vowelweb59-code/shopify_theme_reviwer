// Keyboard-interaction checks added 2026-09-29 from the Aspire theme's
// Theme Store rejection (ticket 69870720, Stage 3 accessibility): hover-only
// submenus, extra tab stops on hidden/duplicated content, and focus jumping
// back to the top of the cart drawer after a quantity change. All three are
// behaviours a reviewer finds with a keyboard, so these are static signals
// for the usual code causes, not proof — findings say "likely" and point at
// the exact CSS rule / markup / script responsible.
import { Parser } from "htmlparser2";
import type { Rule, RuleFinding } from "@/lib/audit/rules";
import type { ParsedFile } from "@/lib/theme-parser";
import { buildLineIndex } from "@/lib/theme-parser/lineIndex";
import { collectCssRules, splitSelectorList, type CssRuleSource } from "./cssSources";

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";
const ACCESSIBILITY_BEST_PRACTICES_URL = "https://shopify.dev/docs/storefronts/themes/best-practices/accessibility";

// --- Hover-only dropdown navigation ---------------------------------------

// The revealed element must look like a submenu/dropdown panel — plain
// `.menu__link:hover { opacity: .8 }` link styling is not a reveal.
const SUBMENU_TARGET_RE = /(sub-?menu|dropdown|mega|flyout|child|children|nested|level-?\d|menu__list|menu-list|list-menu|menu-drawer__submenu|header__submenu)/i;
// A selector state a keyboard user can also reach: focus inside the item, a
// native <details open>, or a class/ARIA state that scripts toggle on focus
// or Enter as well as hover.
const KEYBOARD_STATE_RE =
  /:focus-within|:focus\b|:focus-visible|\[open\]|\[aria-expanded|\[data-(open|active|expanded)|[.-](is-)?(open|opened|active|show|shown|visible|expanded|hovered)\b/i;

function isRevealDeclaration(prop: string, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (prop === "display") return v !== "none";
  if (prop === "visibility") return v === "visible";
  if (prop === "opacity") return parseFloat(v) > 0;
  if (prop === "pointer-events") return v !== "none";
  if (prop === "max-height" || prop === "height") return v !== "0" && v !== "0px";
  if (prop === "clip-path" || prop === "clip") return true;
  if (prop === "transform") return v !== "none";
  return false;
}

/** The selector's last compound (what the rule actually styles), with any :hover dropped. */
function targetCompound(part: string): string {
  const compounds = part.split(/\s*[\s>+~]\s*/).filter(Boolean);
  return (compounds[compounds.length - 1] ?? "").replace(/:hover\b/gi, "");
}

function hoverRevealsSubmenu(part: string): boolean {
  if (!/:hover\b/i.test(part)) return false;
  const compounds = part.split(/\s*[\s>+~]\s*/).filter(Boolean);
  const last = compounds[compounds.length - 1] ?? "";
  // `.submenu:hover` only keeps an already-open panel open while the pointer
  // is on it — the reveal is somewhere else. Only an ancestor's :hover opens it.
  if (/:hover\b/i.test(last)) return false;
  // Match class/id names only — `img:first-child` is not a "child" menu.
  const names = (last.match(/[.#][\w-]+/g) ?? []).join(" ");
  return SUBMENU_TARGET_RE.test(names);
}

type HoverReveal = { rule: CssRuleSource; part: string; target: string };

function findHoverOnlyReveals(rules: CssRuleSource[]): HoverReveal[] {
  const keyboardTargets = new Set<string>();
  for (const rule of rules) {
    for (const part of splitSelectorList(rule.selector)) {
      if (KEYBOARD_STATE_RE.test(part) && !/:hover\b/i.test(part)) keyboardTargets.add(targetCompound(part));
    }
  }

  const reveals: HoverReveal[] = [];
  for (const rule of rules) {
    if (!rule.declarations.some((d) => isRevealDeclaration(d.prop, d.value))) continue;
    const parts = splitSelectorList(rule.selector);
    // A selector list that already pairs the hover part with a keyboard
    // state (`.item:hover .sub, .item:focus-within .sub`) is fine.
    if (parts.some((p) => KEYBOARD_STATE_RE.test(p) && !/:hover\b/i.test(p))) continue;
    for (const part of parts) {
      if (!hoverRevealsSubmenu(part)) continue;
      const target = targetCompound(part);
      if (keyboardTargets.has(target)) continue;
      reveals.push({ rule, part, target });
      break; // one finding per CSS rule
    }
  }
  return reveals;
}

const HOVER_LISTENER_RE = /addEventListener\(\s*['"](mouseenter|mouseover|pointerenter|pointerover)['"]/;
const KEYBOARD_LISTENER_RE = /addEventListener\(\s*['"](focusin|focus|focusout|keydown|keyup|keypress)['"]|\bonkeydown\b|\bonfocus\b/;
const MENU_WORD_RE = /sub-?menu|dropdown|mega-?menu|menu[-_]?item|menu__|header[-_]?menu|nav[-_]?item|nav[-_]?link|site-nav|main-nav/i;

function scriptSources(files: ParsedFile[]): { file: ParsedFile; text: string; lineOffset: number }[] {
  const out = [];
  for (const f of files) {
    if (f.fileType === "js") out.push({ file: f, text: f.rawText, lineOffset: 0 });
    else if (f.fileType === "liquid") {
      for (const m of f.rawText.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>|\{%-?\s*javascript\s*-?%\}([\s\S]*?)\{%-?\s*endjavascript\s*-?%\}/gi)) {
        const body = m[1] ?? m[2] ?? "";
        const start = m.index + m[0].indexOf(body);
        out.push({ file: f, text: body, lineOffset: f.rawText.slice(0, start).split("\n").length - 1 });
      }
    }
  }
  return out;
}

function lineInText(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

const hoverOnlyMenuRule: Rule = {
  ruleId: "A11Y-HOVER-ONLY-MENU-001",
  requirementId: "SHOPIFY-A11Y-009",
  category: "Accessibility",
  defaultSeverity: "high",
  title: "Dropdown submenus must open for keyboard users, not only on hover",
  description:
    "A submenu that is revealed only by :hover (in CSS) or a mouseenter/mouseover listener (in JavaScript), with no matching :focus-within, [open], aria-expanded or open-class state and no focus/keydown handler, cannot be reached with a keyboard. A Theme Store rejection reason: \"Navigation submenus only reveal upon hover, rendering hidden menu items unreachable for keyboard users.\"",
  sourceReference: "Shopify Theme Store requirements — Accessibility",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // CSS: a :hover rule whose target looks like a submenu panel and makes it
  // visible (display/visibility/opacity/max-height/transform/clip), when no
  // rule anywhere in the theme reveals the same target through a keyboard-
  // reachable state. JS: a file that wires hover listeners in menu code but
  // no focus/key listener at all. Scans CSS embedded in Liquid too.
  check({ files }) {
    const findings: RuleFinding[] = [];
    for (const { rule, part, target } of findHoverOnlyReveals(collectCssRules(files))) {
      findings.push({
        filePath: rule.filePath,
        lineNumber: rule.line,
        category: "Accessibility",
        severity: "high",
        finding: `"${part}" reveals ${target} on hover only — no :focus-within, [open], aria-expanded or open-class rule for ${target} was found anywhere in the theme, so keyboard users likely can't open this submenu.`,
        recommendation: `Add a keyboard state alongside the hover one, e.g. "${part.replace(/:hover\b/i, ":focus-within")}", or open the submenu from a <details>/<button aria-expanded> toggle.`,
      });
    }

    for (const { file, text, lineOffset } of scriptSources(files)) {
      const hover = HOVER_LISTENER_RE.exec(text);
      if (!hover || !MENU_WORD_RE.test(text) || KEYBOARD_LISTENER_RE.test(text)) continue;
      findings.push({
        filePath: file.path,
        lineNumber: lineOffset + lineInText(text, hover.index),
        category: "Accessibility",
        severity: "high",
        finding: `This menu script opens on "${hover[1]}" but listens for no focus or key events, so keyboard users likely can't open the submenus it controls.`,
        recommendation: "Also open the submenu on focusin (or on Enter/Space on its toggle button, updating aria-expanded), and close it on focusout and Escape.",
      });
    }
    return findings;
  },
};

// --- Focusable content inside hidden or duplicated markup -----------------

const FOCUSABLE_TAGS = new Set(["a", "button", "input", "select", "textarea", "summary", "iframe"]);

function isFocusable(name: string, attribs: Record<string, string>): boolean {
  const tabindex = attribs.tabindex?.trim();
  if (tabindex === "-1") return false;
  if ("disabled" in attribs) return false;
  if (tabindex !== undefined && /^\d+$/.test(tabindex)) return true;
  if (name === "a") return "href" in attribs;
  if (name === "input") return attribs.type?.toLowerCase() !== "hidden";
  return FOCUSABLE_TAGS.has(name);
}

type HiddenFocusable = { line: number; tag: string; containerLine: number };

function findFocusableInsideAriaHidden(rawText: string): HiddenFocusable[] {
  const toLine = buildLineIndex(rawText);
  // One frame per open element: whether it (or an ancestor) is aria-hidden,
  // and whether it (or an ancestor) is inert — inert removes everything
  // inside from the tab order, which is the fix, so it cancels the finding.
  const stack: { name: string; hiddenLine: number | null; inert: boolean }[] = [];
  const found: HiddenFocusable[] = [];
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const parent = stack[stack.length - 1];
        const line = toLine(parser.startIndex);
        const selfHidden = attribs["aria-hidden"]?.trim() === "true";
        const frame = {
          name,
          hiddenLine: parent?.hiddenLine ?? (selfHidden ? line : null),
          inert: (parent?.inert ?? false) || "inert" in attribs,
        };
        // The element carrying aria-hidden itself is covered by
        // A11Y-ARIA-HIDDEN-FOCUS-001; this rule is about its descendants.
        if (parent?.hiddenLine != null && !frame.inert && isFocusable(name, attribs)) {
          found.push({ line, tag: name, containerLine: parent.hiddenLine });
        }
        stack.push(frame);
      },
      onclosetag(name) {
        // Liquid conditionals can leave tags unbalanced; pop back to the
        // matching open tag rather than trusting strict nesting.
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === name) {
            stack.length = i;
            return;
          }
        }
      },
    },
    { recognizeSelfClosing: true, decodeEntities: true }
  );
  parser.write(rawText.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, (m) => m.replace(/[^\n]/g, " ")));
  parser.end();
  return found;
}

const CLONE_ASSIGN_RE = /(?:const|let|var)\s+(\w+)\s*=[^;\n]*?\.cloneNode\(\s*true\s*\)/g;
const REMOVES_FROM_TAB_ORDER_RE = /\binert\b|setAttribute\(\s*['"]tabindex['"]|\.tabIndex\s*=/;

/** A clone kept in a variable, marked aria-hidden, and not removed again (a measuring copy is removed). */
function findHiddenClone(text: string): RegExpMatchArray | null {
  for (const m of text.matchAll(CLONE_ASSIGN_RE)) {
    const v = m[1];
    const hidden = new RegExp(`\\b${v}\\.(setAttribute\\(\\s*['"]aria-hidden['"]|ariaHidden\\s*=)`).test(text);
    const removed = new RegExp(`\\b${v}\\.remove\\(\\)`).test(text);
    if (hidden && !removed) return m;
  }
  return null;
}

const hiddenFocusableRule: Rule = {
  ruleId: "A11Y-HIDDEN-FOCUSABLE-001",
  requirementId: "A11Y-BP-009",
  category: "Accessibility",
  defaultSeverity: "medium",
  title: "Hidden or duplicated content must not leave links in the tab order",
  description:
    "Links, buttons and fields inside an aria-hidden=\"true\" container (a marquee's duplicate track, an off-screen carousel copy, a decorative clone) stay keyboard-focusable: keyboard users land on invisible tab stops with no visible focus. A Theme Store rejection reason: \"navigating past the text section requires multiple tab presses through off-screen product links.\"",
  sourceReference: "Accessibility best practices for Shopify themes",
  sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
  // Markup: nesting-aware scan of each Liquid file for a focusable
  // descendant of an aria-hidden="true" element with no inert and no
  // tabindex="-1". Script: JS that clones nodes with cloneNode(true) and
  // marks them aria-hidden without ever setting inert or tabindex, the usual
  // way a marquee/slider duplicates its links.
  check({ files }) {
    const findings: RuleFinding[] = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      for (const hit of findFocusableInsideAriaHidden(f.rawText)) {
        findings.push({
          filePath: f.path,
          lineNumber: hit.line,
          category: "Accessibility",
          severity: "medium",
          finding: `<${hit.tag}> sits inside an aria-hidden="true" container (line ${hit.containerLine}) but is still keyboard-focusable, so it adds an invisible tab stop.`,
          recommendation: `Add the inert attribute to the aria-hidden container, or tabindex="-1" to each link/button inside it.`,
        });
      }
    }
    for (const { file, text, lineOffset } of scriptSources(files)) {
      if (REMOVES_FROM_TAB_ORDER_RE.test(text)) continue;
      const clone = findHiddenClone(text);
      if (!clone) continue;
      findings.push({
        filePath: file.path,
        lineNumber: lineOffset + lineInText(text, clone.index ?? 0),
        category: "Accessibility",
        severity: "medium",
        finding: "This script clones markup and marks the copy aria-hidden, but never sets inert or tabindex — any links in the copy stay in the tab order as invisible tab stops.",
        recommendation: "Set clone.inert = true (or tabindex=\"-1\" on every focusable element inside the clone) when inserting the duplicate.",
      });
    }
    return findings;
  },
};

// --- Focus reset after a cart/drawer re-render ----------------------------

const CART_REQUEST_RE = /cart\/(change|update|add)(\.js)?\b|cart_(change|update|add)_url|routes\.cart_(change|update|add)/;
const DOM_REPLACE_RE = /\.innerHTML\s*=(?!=)|\.outerHTML\s*=(?!=)|\.replaceWith\(|\.replaceChildren\(/;
const FOCUS_RESTORE_RE = /\bactiveElement\b|\bpreventScroll\b|\bmorph\w*\(/;

const focusResetRule: Rule = {
  ruleId: "A11Y-FOCUS-RESTORE-001",
  requirementId: "SHOPIFY-A11Y-005",
  category: "Accessibility",
  defaultSeverity: "medium",
  title: "Re-rendering the cart must keep keyboard focus where it was",
  description:
    "When a cart update replaces the cart or drawer markup (innerHTML/outerHTML/replaceWith), the focused quantity input or button is destroyed and focus falls back to the page or the drawer's first element. The script must remember the focused control (document.activeElement) and focus its replacement afterwards. A Theme Store rejection reason: \"updating quantity in the cart drawer kicks focus back to the top close button.\"",
  sourceReference: "Shopify Theme Store requirements — Accessibility",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // Per script: sends a cart change/update/add request and replaces DOM with
  // the response, but never reads document.activeElement (the standard way
  // to restore focus, e.g. Dawn's cart.js) and doesn't use a morph/DOM-diff
  // helper (which keeps the focused node, e.g. Horizon).
  check({ files }) {
    const findings: RuleFinding[] = [];
    for (const { file, text, lineOffset } of scriptSources(files)) {
      if (!CART_REQUEST_RE.test(text) || FOCUS_RESTORE_RE.test(text)) continue;
      const replace = DOM_REPLACE_RE.exec(text);
      if (!replace) continue;
      findings.push({
        filePath: file.path,
        lineNumber: lineOffset + lineInText(text, replace.index),
        category: "Accessibility",
        severity: "medium",
        finding:
          "This cart script replaces markup after a cart request but never reads document.activeElement, so keyboard focus is likely lost (dropped to the page, or sent back to the drawer's first control) every time the quantity changes.",
        recommendation:
          "Before replacing the markup, save an identifier of document.activeElement (e.g. its id or name plus the line item key); after the new markup is in, find the matching element and call .focus() on it.",
      });
    }
    return findings;
  },
};

export const ACCESSIBILITY_INTERACTION_RULES: Rule[] = [hoverOnlyMenuRule, hiddenFocusableRule, focusResetRule];
