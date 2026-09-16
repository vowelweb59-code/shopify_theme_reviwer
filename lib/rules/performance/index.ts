import type { Rule } from "@/lib/audit/rules";

const IMAGE_DIMENSIONS_URL = "https://web.dev/articles/optimize-cls#images_without_dimensions";
const RENDER_BLOCKING_RESOURCES_URL = "https://web.dev/articles/render-blocking-resources";

const imageDimensionsRule: Rule = {
  ruleId: "PERF-IMG-DIMENSIONS-001",
  requirementId: "PERF-BP-001",
  category: "Performance",
  defaultSeverity: "medium",
  title: "Images should specify explicit width and height",
  description:
    "An <img>/<source> with no width and height (and no aspect-ratio reservation) gives the browser no size to lay out before the image loads, causing a layout shift (a Cumulative Layout Shift regression) once it does.",
  sourceReference: "web.dev: Optimize Cumulative Layout Shift",
  sourceUrl: IMAGE_DIMENSIONS_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const img of f.images) {
        if (!img.hasWidth || !img.hasHeight) {
          const missing = [!img.hasWidth && "width", !img.hasHeight && "height"].filter(Boolean).join(" and ");
          findings.push({
            filePath: f.path,
            lineNumber: img.line,
            category: "Performance" as const,
            severity: "medium" as const,
            finding: `<${img.tag ?? "img"}>${img.src ? ` (src: ${img.src})` : ""} is missing ${missing} — the browser can't reserve layout space for it before it loads.`,
            recommendation: "Add explicit width and height attributes (or a CSS aspect-ratio) so the image doesn't shift surrounding content when it loads.",
          });
        }
      }
    }
    return findings;
  },
};

const renderBlockingScriptRule: Rule = {
  ruleId: "PERF-RENDER-BLOCKING-SCRIPT-001",
  requirementId: "PERF-BP-002",
  category: "Performance",
  defaultSeverity: "high",
  title: "External scripts in <head> should not block rendering",
  description:
    "An external <script src=\"...\"> placed in <head> without async, defer, or type=\"module\" blocks HTML parsing until it downloads and executes, delaying first render.",
  sourceReference: "web.dev: Eliminate render-blocking resources",
  sourceUrl: RENDER_BLOCKING_RESOURCES_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const script of f.scripts) {
        if (script.location !== "head") continue;
        if (!script.src) continue; // inline scripts are a different concern (see PERF-LARGE-INLINE-001)
        if (script.async || script.defer || script.type === "module") continue;
        findings.push({
          filePath: f.path,
          lineNumber: script.line,
          category: "Performance" as const,
          severity: "high" as const,
          finding: `A <script src="${script.src}"> in <head> has no async, defer, or type="module" — it blocks HTML parsing until it downloads and runs.`,
          recommendation: 'Add the async or defer attribute (or load it as type="module") so this script no longer blocks rendering.',
        });
      }
    }
    return findings;
  },
};

export const PERFORMANCE_RULES: Rule[] = [imageDimensionsRule, renderBlockingScriptRule];
