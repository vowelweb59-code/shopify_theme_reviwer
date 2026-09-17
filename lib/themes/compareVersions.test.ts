import { describe, expect, it } from "vitest";
import { compareVersions, parseVersionForSort, pickLatestVersion } from "./compareVersions";

describe("parseVersionForSort", () => {
  it("parses a plain dotted version", () => {
    expect(parseVersionForSort("2.4.1")).toEqual({ raw: "2.4.1", parts: [2, 4, 1] });
  });

  it("strips a leading v", () => {
    expect(parseVersionForSort("v1.0.0")).toEqual({ raw: "v1.0.0", parts: [1, 0, 0] });
  });

  it("returns null parts for a non-numeric version", () => {
    expect(parseVersionForSort("unstable-build")).toEqual({ raw: "unstable-build", parts: null });
  });
});

describe("compareVersions", () => {
  it("orders numerically, not lexicographically (2.10.0 > 2.9.0)", () => {
    const a = parseVersionForSort("2.10.0");
    const b = parseVersionForSort("2.9.0");
    expect(compareVersions(a, b)).toBeGreaterThan(0);
  });

  it("treats a missing trailing segment as 0", () => {
    expect(compareVersions(parseVersionForSort("2.4"), parseVersionForSort("2.4.0"))).toBe(0);
    expect(compareVersions(parseVersionForSort("2.4.1"), parseVersionForSort("2.4"))).toBeGreaterThan(0);
  });

  it("always ranks an unparseable version below a parseable one", () => {
    const parsed = parseVersionForSort("1.0.0");
    const unparsed = parseVersionForSort("latest");
    expect(compareVersions(unparsed, parsed)).toBeLessThan(0);
    expect(compareVersions(parsed, unparsed)).toBeGreaterThan(0);
  });

  it("treats two unparseable versions as equal", () => {
    expect(compareVersions(parseVersionForSort("abc"), parseVersionForSort("xyz"))).toBe(0);
  });
});

describe("pickLatestVersion", () => {
  it("picks the highest semver version regardless of upload order", () => {
    const versions = [
      { version: "2.3.2", createdAt: new Date("2026-08-25") },
      { version: "2.4.1", createdAt: new Date("2026-09-16") },
      { version: "2.4.0", createdAt: new Date("2026-09-10") },
    ];
    expect(pickLatestVersion(versions)?.version).toBe("2.4.1");
  });

  it("picks the highest version even if it wasn't uploaded last", () => {
    const versions = [
      { version: "2.4.1", createdAt: new Date("2026-09-01") },
      { version: "2.3.0", createdAt: new Date("2026-09-16") },
    ];
    expect(pickLatestVersion(versions)?.version).toBe("2.4.1");
  });

  it("falls back to most-recently-created when no version parses as numeric", () => {
    const versions = [
      { version: "alpha", createdAt: new Date("2026-09-01") },
      { version: "beta", createdAt: new Date("2026-09-16") },
    ];
    expect(pickLatestVersion(versions)?.version).toBe("beta");
  });

  it("returns null for an empty list", () => {
    expect(pickLatestVersion([])).toBeNull();
  });
});
