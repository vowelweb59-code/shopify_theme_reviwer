import { describe, expect, it } from "vitest";
import { parseReleaseDate, parseVersionHistory } from "./versionHistory";

const entry = (v: string, date: string | null, body = "<h3>Added</h3><ul><li>x</li></ul>") =>
  `<details><summary><div><h3 class="t">Version ${v}</h3>${date ? `<p class="d">\n      ${date}\n    </p>` : ""}<p class="s">This update improves things.</p></div></summary><div><div class="tw-release-note-body">${body}</div></div></details>`;

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
  it("reads every version newest first, with dates", () => {
    const html = entry("1.1.3", "October 13, 2026") + entry("1.1.2", "July 27, 2026") + entry("1.0.0", "May 13, 2026");
    expect(parseVersionHistory(html)).toEqual([
      { version: "1.1.3", releasedOn: "2026-10-13" },
      { version: "1.1.2", releasedOn: "2026-07-27" },
      { version: "1.0.0", releasedOn: "2026-05-13" },
    ]);
  });
  it("keeps a version that shows no date, as undated, without taking its summary for a date", () => {
    const html = entry("2.3.2", "November 19, 2025") + entry("2.3.1", null) + entry("2.3.0", "October 30, 2025");
    expect(parseVersionHistory(html)).toEqual([
      { version: "2.3.2", releasedOn: "2025-11-19" },
      { version: "2.3.1", releasedOn: null },
      { version: "2.3.0", releasedOn: "2025-10-30" },
    ]);
  });
  it("ignores the headings inside a release note and returns [] for a page with no versions", () => {
    expect(parseVersionHistory("<h3>Added</h3><p>x</p><h3>Changed</h3>")).toEqual([]);
    expect(parseVersionHistory("")).toEqual([]);
  });
});
