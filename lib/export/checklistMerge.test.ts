import { describe, expect, it } from "vitest";
import { mergeChecklistRows } from "./checklistMerge";
import { buildChecklistSheetTabs } from "./sheetRows";
import type { DiffFinding } from "@/lib/audit/diffFindings";
import type { SheetChecklistFinding } from "./sheetRows";

const findingA: SheetChecklistFinding = {
  ruleId: "A11Y-IMG-ALT-001",
  category: "Accessibility",
  filePath: "sections/hero.liquid",
  severity: "high",
  finding: "Image is missing an alt attribute.",
};

const findingB: SheetChecklistFinding = {
  ruleId: "A11Y-CONTRAST-001",
  category: "Accessibility",
  filePath: "assets/base.css",
  severity: "low",
  finding: "Low contrast text.",
};

function rowsFor(diffFindings: DiffFinding<SheetChecklistFinding>[]): string[][] {
  const tabs = buildChecklistSheetTabs("run", "Dawn", diffFindings);
  const tab = tabs.find((t) => t.title === "Accessibility");
  return tab ? tab.rows.slice(1) : [];
}

describe("mergeChecklistRows", () => {
  it("carries forward a previously-resolved row untouched by this round's fresh diff", () => {
    const existingRows = rowsFor([{ status: "resolved", previous: findingA }]);
    const freshRows = rowsFor([{ status: "new", current: findingB }]);

    const merged = mergeChecklistRows(existingRows, freshRows, "Accessibility");

    expect(merged).toHaveLength(2);
    expect(merged).toEqual([...freshRows, ...existingRows]);
  });

  it("does not duplicate a carried-forward row that reappears in the fresh diff (reintroduced)", () => {
    const existingRows = rowsFor([{ status: "resolved", previous: findingA }]);
    // Reintroduced: the diff engine reports a reappearing finding as "new"
    // since it has no memory of the earlier resolution by itself.
    const freshRows = rowsFor([{ status: "new", current: findingA }]);

    const merged = mergeChecklistRows(existingRows, freshRows, "Accessibility");

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(freshRows[0]);
  });

  it("passes the fresh rows through unchanged when there are no existing rows (first-ever export)", () => {
    const freshRows = rowsFor([{ status: "new", current: findingA }]);
    expect(mergeChecklistRows([], freshRows, "Accessibility")).toEqual(freshRows);
  });

  it("drops a previously still-open row if it is genuinely absent from the fresh diff", () => {
    // Defensive case: only ever-resolved rows are carried forward. A
    // still-open row has no legitimate reason to be missing from a real
    // one-hop diff, so it is not specially preserved here.
    const existingRows = rowsFor([{ status: "still_present", previous: findingA, current: findingA }]);
    expect(mergeChecklistRows(existingRows, [], "Accessibility")).toEqual([]);
  });
});
