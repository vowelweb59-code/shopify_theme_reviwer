import { describe, expect, it } from "vitest";
import { parseDayMonth, parseNewProjectPost } from "./new-project-post";

const posted = new Date("2026-11-06T05:00:00Z");

describe("parseNewProjectPost", () => {
  it("reads an accepted project", () => {
    expect(parseNewProjectPost("Accepted the project of Sumer Kashyap - Ashfaque - $20 hr - Ashfaque | Mohit | 5th November", posted)).toEqual({
      kind: "accepted",
      client: "Sumer Kashyap",
      hourlyRateCents: 2000,
      profile: "Ashfaque",
      businessDeveloper: "Ashfaque",
      businessAnalyst: "Mohit",
      startDate: new Date("2026-11-05T00:00:00Z"),
    });
  });
  it("reads an ended contract with its rating", () => {
    expect(parseNewProjectPost("Contract ended of Danisa with 3-star ratings on Rahul", posted)).toEqual({
      kind: "ended",
      client: "Danisa",
      rating: 3,
      profile: "Rahul",
    });
  });
  it("returns null for anything else", () => {
    expect(parseNewProjectPost("Good morning team", posted)).toBeNull();
  });
});

describe("parseDayMonth", () => {
  it("uses the previous year for a date well after the post", () => {
    expect(parseDayMonth("20th December", posted)).toEqual(new Date("2025-12-20T00:00:00Z"));
  });
  it("rejects nonsense", () => {
    expect(parseDayMonth("31st February", posted)).toBeNull();
  });
});
