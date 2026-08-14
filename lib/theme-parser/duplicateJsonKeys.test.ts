import { describe, expect, it } from "vitest";
import { findDuplicateJsonKeys } from "./duplicateJsonKeys";

describe("findDuplicateJsonKeys", () => {
  it("finds no duplicates in a well-formed object", () => {
    expect(findDuplicateJsonKeys('{"a": 1, "b": 2}')).toEqual([]);
  });

  it("finds a duplicate key nested under a parent path", () => {
    const json = '{"a": {"one": 1, "other": 2}, "cart": {"a": {"one": 3, "other": 4}, "a": {"x": 5}}}';
    const dupes = findDuplicateJsonKeys(json);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].path).toBe("cart.a");
  });

  it("does not flag the same key name reused across sibling array elements", () => {
    expect(findDuplicateJsonKeys('{"settings": [{"id": "x"}, {"id": "x"}]}')).toEqual([]);
  });

  it("does not flag the same key name at different nesting levels", () => {
    expect(findDuplicateJsonKeys('{"a": "one", "b": {"a": 1}}')).toEqual([]);
  });

  it("reports every repeated occurrence of a top-level duplicate key", () => {
    const dupes = findDuplicateJsonKeys('{"x": 1, "x": 2, "x": 3}');
    expect(dupes).toHaveLength(2);
    expect(dupes.every((d) => d.path === "x")).toBe(true);
  });

  it("reports the line of each duplicate occurrence", () => {
    const json = '{\n  "heading": "a",\n  "heading": "b"\n}';
    const dupes = findDuplicateJsonKeys(json);
    expect(dupes).toEqual([{ path: "heading", line: 3 }]);
  });
});
