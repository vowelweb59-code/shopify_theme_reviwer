import { describe, expect, it } from "vitest";
import { parseReleaseDate, parseVersionHistory } from "./versionHistory";

const body = `<div class="tw-release-note-body"><h3><a href="#added" class="anchor"></a>Added</h3><ul><li>Added a quick order list.</li><li>Added dark mode.</li></ul><h3>Fixes and Other Improvements</h3><ul><li>Fixed CSS issues.</li></ul></div>`;
const entry = (v: string, date: string | null, summary = "This update improves things.", noteBody = body) =>
  `<details><summary><div><h3 class="t">Version ${v}</h3>${date ? `<p class="d">\n      ${date}\n    </p>` : ""}<p class="m">\n </p><p>${summary}</p></div></summary><div>${noteBody}</div></details>`;

describe("parseReleaseDate", () => {
  it("turns a store date into YYYY-MM-DD", () => {
    expect(parseReleaseDate("October 13, 2026")).toBe("2026-10-13");
    expect(parseReleaseDate("  May 5, 2026 ")).toBe("2026-05-05");
  });
  it("rejects anything else", () => {
    expect(parseReleaseDate("This update improves things.")).toBeNull();
    expect(parseReleaseDate("Smarch 3, 2026")).toBeNull();
    expect(parseReleaseDate("")).toBeNull();
  });
});

describe("parseVersionHistory", () => {
  it("reads every version newest first, with its date, summary and release-note sections", () => {
    const html = entry("1.1.3", "October 13, 2026", "Adds a quick order list.") + entry("1.1.2", "July 27, 2026") + entry("1.0.0", "May 13, 2026");
    const out = parseVersionHistory(html);
    expect(out.map((v) => [v.version, v.releasedOn])).toEqual([
      ["1.1.3", "2026-10-13"],
      ["1.1.2", "2026-07-27"],
      ["1.0.0", "2026-05-13"],
    ]);
    expect(out[0].summary).toBe("Adds a quick order list.");
    expect(out[0].notes).toEqual([
      { heading: "Added", items: ["Added a quick order list.", "Added dark mode."] },
      { heading: "Fixes and Other Improvements", items: ["Fixed CSS issues."] },
    ]);
  });
  it("keeps a version that shows no date, taking its first paragraph as the summary, not as a date", () => {
    const out = parseVersionHistory(entry("2.3.2", "November 19, 2025") + entry("2.3.1", null, "A small fix release.") + entry("2.3.0", "October 30, 2025"));
    expect(out.map((v) => [v.version, v.releasedOn])).toEqual([
      ["2.3.2", "2025-11-19"],
      ["2.3.1", null],
      ["2.3.0", "2025-10-30"],
    ]);
    expect(out[1].summary).toBe("A small fix release.");
  });
  it("does not mistake headings inside a note's body for versions, and returns [] for a page with none", () => {
    expect(parseVersionHistory("<h3>Added</h3><p>x</p><h3>Changed</h3>")).toEqual([]);
    expect(parseVersionHistory("")).toEqual([]);
    expect(parseVersionHistory(entry("1.0.0", "May 13, 2026", "S", `<div class="tw-release-note-body"><h3>Version history</h3><ul><li>x</li></ul></div>`)).map((v) => v.version)).toEqual(["1.0.0"]);
  });
});
