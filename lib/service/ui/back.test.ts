import { describe, expect, it } from "vitest";
import { backLabel, projectHref, safeBack } from "./back";

describe("back link", () => {
  it("accepts only addresses inside /service", () => {
    expect(safeBack("/service?by=month&on=2026-10-05")).toBe("/service?by=month&on=2026-10-05");
    expect(safeBack("/service")).toBe("/service");
    expect(safeBack("/service/revenue?range=1m")).toBe("/service/revenue?range=1m");
    expect(safeBack("https://evil.example")).toBeNull();
    expect(safeBack("//evil.example")).toBeNull();
    expect(safeBack("/servicefoo")).toBeNull();
    expect(safeBack("/service\nx")).toBeNull();
    expect(safeBack(undefined)).toBeNull();
  });

  it("keeps the list's filters in the project link and names the page", () => {
    const back = "/service?status=on_hold&by=month&on=2026-10-05";
    expect(decodeURIComponent(projectHref("p1", back).split("back=")[1])).toBe(back);
    expect(backLabel("/service/revenue?range=1m")).toBe("Revenue");
    expect(backLabel(back)).toBe("Projects");
    expect(backLabel(null)).toBe("Projects");
  });
});
