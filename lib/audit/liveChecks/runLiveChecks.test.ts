import { beforeEach, describe, expect, it, vi } from "vitest";
import { runLiveChecksForPresets } from "./runLiveChecks";
import type { PageFacts } from "./fetchPageFacts";

const { fetchPageFactsMock } = vi.hoisted(() => ({ fetchPageFactsMock: vi.fn() }));
vi.mock("./fetchPageFacts", () => ({ fetchPageFacts: fetchPageFactsMock }));

function facts(overrides: Partial<PageFacts> = {}): PageFacts {
  return {
    url: "https://example.com",
    jsonLdTypes: ["Organization", "WebSite"],
    canonical: "https://example.com/",
    metaDescription: "A store",
    sectionIds: ["header"],
    firstProductLink: null,
    ...overrides,
  };
}

describe("runLiveChecksForPresets", () => {
  beforeEach(() => {
    fetchPageFactsMock.mockReset();
  });

  it("returns structural findings and no errors for a reachable preset with no product link", async () => {
    fetchPageFactsMock.mockResolvedValueOnce(facts({ jsonLdTypes: [] }));
    const result = await runLiveChecksForPresets([{ label: "Main", url: "https://example.com" }]);
    expect(result.errors).toEqual([]);
    expect(result.findings.every((f) => f.presetLabel === "Main")).toBe(true);
    expect(result.findings.map((f) => f.ruleId)).toContain("LIVE-JSONLD-ORG-001");
  });

  it("also checks the product page when the homepage links to one", async () => {
    fetchPageFactsMock
      .mockResolvedValueOnce(facts({ firstProductLink: "https://example.com/products/a" }))
      .mockResolvedValueOnce(facts({ url: "https://example.com/products/a", jsonLdTypes: [] }));
    const result = await runLiveChecksForPresets([{ label: "Main", url: "https://example.com" }]);
    expect(fetchPageFactsMock).toHaveBeenCalledTimes(2);
    expect(result.findings.map((f) => f.ruleId)).toContain("LIVE-JSONLD-PRODUCT-001");
  });

  it("records an unreachable preset's homepage as an error, not a thrown exception", async () => {
    fetchPageFactsMock.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));
    const result = await runLiveChecksForPresets([{ label: "Broken", url: "https://broken.example.com" }]);
    expect(result.errors).toEqual([{ label: "Broken", url: "https://broken.example.com", error: "getaddrinfo ENOTFOUND" }]);
    expect(result.findings).toEqual([]);
  });

  it("does not invalidate homepage findings when only the product page fetch fails", async () => {
    fetchPageFactsMock
      .mockResolvedValueOnce(facts({ firstProductLink: "https://example.com/products/a", jsonLdTypes: [] }))
      .mockRejectedValueOnce(new Error("timeout"));
    const result = await runLiveChecksForPresets([{ label: "Main", url: "https://example.com" }]);
    expect(result.errors).toEqual([]);
    expect(result.findings.map((f) => f.ruleId)).toContain("LIVE-JSONLD-ORG-001");
  });

  it("runs comparePresets once 2+ presets succeed", async () => {
    fetchPageFactsMock
      .mockResolvedValueOnce(facts({ sectionIds: ["header", "hero", "footer"] }))
      .mockResolvedValueOnce(facts({ url: "https://alt.example.com", sectionIds: ["header"] }));
    const result = await runLiveChecksForPresets([
      { label: "Main", url: "https://example.com" },
      { label: "Alt", url: "https://alt.example.com" },
    ]);
    expect(result.findings.map((f) => f.ruleId)).toContain("LIVE-PRESET-SYNC-SECTIONS-001");
  });

  it("calls onItemComplete once per preset", async () => {
    fetchPageFactsMock.mockResolvedValue(facts());
    const onItemComplete = vi.fn();
    await runLiveChecksForPresets(
      [
        { label: "Main", url: "https://example.com" },
        { label: "Alt", url: "https://alt.example.com" },
      ],
      onItemComplete
    );
    expect(onItemComplete).toHaveBeenCalledTimes(2);
  });
});
