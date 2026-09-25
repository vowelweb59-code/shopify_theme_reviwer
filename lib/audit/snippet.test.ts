import { describe, expect, it } from "vitest";
import { SNIPPET_MAX_LINE_CHARS, capSnippet, capSnippetLine } from "./snippet";

describe("snippet capping", () => {
  it("leaves normal lines alone", () => {
    expect(capSnippetLine("  12 >   {{ product.title }}")).toBe("  12 >   {{ product.title }}");
  });

  it("cuts a minified line and says how much was dropped", () => {
    const line = "a".repeat(SNIPPET_MAX_LINE_CHARS + 500);
    expect(capSnippetLine(line)).toBe(`${"a".repeat(SNIPPET_MAX_LINE_CHARS)}… (+500 chars)`);
  });

  it("caps each line of a stored snippet independently, and is idempotent", () => {
    const snippet = ["1   short", `2 > ${"x".repeat(1000)}`, "3   short"].join("\n");
    const capped = capSnippet(snippet);
    expect(capped.split("\n")).toHaveLength(3);
    expect(capped.split("\n")[0]).toBe("1   short");
    expect(capped.length).toBeLessThan(SNIPPET_MAX_LINE_CHARS + 60);
    expect(capSnippet(capped)).toBe(capped);
  });
});
