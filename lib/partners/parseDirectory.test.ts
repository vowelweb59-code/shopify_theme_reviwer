import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countryFromLocation, countryLabel, parseCards, parseCountrySlugs, parseProfile, parseTotal } from "./parseDirectory";

// A real directory page saved 2026-10-01 (United States, page 1).
const page = readFileSync(join(__dirname, "__fixtures__", "us-page1.html"), "utf8");

describe("parseDirectory", () => {
  it("reads the 16 cards of a listing page", () => {
    const cards = parseCards(page);
    expect(cards).toHaveLength(16);
    expect(new Set(cards.map((c) => c.slug)).size).toBe(16);
    const geeks = cards.find((c) => c.slug === "it-geeks");
    expect(geeks).toMatchObject({
      name: "IT-Geeks",
      rating: 5,
      reviewCount: 5059,
      location: "SALT LAKE CITY, United States",
      startingPrice: 1000,
      moreServices: 31,
    });
    expect(geeks?.services).toEqual(["Store build or redesign", "Store migration", "Troubleshooting", "Theme customization", "SEO"]);
  });

  it("reads the total", () => {
    expect(parseTotal(page)).toBe(1294);
    expect(parseTotal("<p>nothing</p>")).toBeNull();
  });

  it("finds country slugs and labels them", () => {
    expect(
      parseCountrySlugs(
        '<a href="/partners/directory/locations/spain">x</a><a href="/partners/directory/locations/united-kingdom">y</a><a href="/partners/directory/locations/">z</a>'
      )
    ).toEqual(["spain", "united-kingdom"]);
    expect(countryLabel("united-kingdom")).toBe("United Kingdom");
    expect(countryFromLocation("Dover, United States")).toBe("United States");
    expect(countryFromLocation(null)).toBeNull();
  });

  it("reads a profile's contact block and ignores links after it", () => {
    const html =
      '<p>Partner since September 2015</p><p>Contact information</p><a href="https://itgeeks.com/?utm_source=sref" rel="nofollow">x</a>' +
      '<a href="tel:3852402913">3852402913</a><a href="mailto:Sales@ItGeeks.com">m</a><p>Primary location</p><a href="https://crownbees.com/">store</a>';
    expect(parseProfile(html)).toEqual({ website: "https://itgeeks.com", email: "sales@itgeeks.com", phone: "3852402913", partnerSince: "September 2015" });
  });

  it("leaves missing contact fields null", () => {
    const html = '<p>Contact information</p><a href="https://adamshrum.com/">x</a><a href="mailto:hello@adamshrum.com">m</a><p>Primary location</p>';
    expect(parseProfile(html)).toMatchObject({ website: "https://adamshrum.com", email: "hello@adamshrum.com", phone: null });
    expect(parseProfile("<html></html>")).toEqual({ website: null, email: null, phone: null, partnerSince: null });
  });
  it("reads contact details from the 2026-11 profile layout", () => {
    const html =
      '<div><dt><span class="block">Partner since</span></dt><dd class="x"><span class="block reveal-pending">March 2019</span></dd></div>' +
      '<a data-click-disabled="" data-component-name="partner-directory-contact-email" href="mailto:Support@Clovecode.com?subject=Hi" aria-label="Contact X by email">Contact</a>' +
      '<a data-click-disabled="" href="https://www.clovecode.com/?utm_source=sref" target="_blank" aria-label="Visit website (opens in a new tab)">g</a>' +
      '<a href="https://some-merchant.com/">merchant</a><a href="tel:+1 555 0100">call</a>';
    expect(parseProfile(html)).toEqual({
      website: "https://www.clovecode.com",
      email: "support@clovecode.com",
      phone: "+1 555 0100",
      partnerSince: "March 2019",
    });
  });
});
