import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countryFromLocation, countryLabel, parseCards, parseCountrySlugs, parseTotal } from "./parseDirectory";

// A real directory page saved 2026-10-01 (United States, page 1).
const page = readFileSync(join(__dirname, "__fixtures__", "us-page1.html"), "utf8");

describe("parseDirectory", () => {
  it("reads the 16 cards of a listing page", () => {
    const cards = parseCards(page);
    expect(cards).toHaveLength(16);
    expect(new Set(cards.map((c) => c.slug)).size).toBe(16);
    const geeks = cards.find((c) => c.slug === "it-geeks");
    expect(geeks).toMatchObject({ name: "IT-Geeks", rating: 5, reviewCount: 5059, location: "SALT LAKE CITY, United States", startingPrice: 1000, moreServices: 31 });
    expect(geeks?.services).toEqual(["Store build or redesign", "Store migration", "Troubleshooting", "Theme customization", "SEO"]);
  });

  it("reads the total", () => {
    expect(parseTotal(page)).toBe(1294);
    expect(parseTotal("<p>nothing</p>")).toBeNull();
  });

  it("finds country slugs and labels them", () => {
    expect(parseCountrySlugs('<a href="/partners/directory/locations/spain">x</a><a href="/partners/directory/locations/united-kingdom">y</a><a href="/partners/directory/locations/">z</a>')).toEqual(["spain", "united-kingdom"]);
    expect(countryLabel("united-kingdom")).toBe("United Kingdom");
    expect(countryFromLocation("Dover, United States")).toBe("United States");
    expect(countryFromLocation(null)).toBeNull();
  });
});
