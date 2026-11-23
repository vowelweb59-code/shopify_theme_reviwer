import { describe, expect, it } from "vitest";
import { AUTHOR_PROFILES, authorProfileForTheme, requireSenderForTheme, senderEmailForTheme } from "./authorProfiles";

describe("author profiles", () => {
  it("sends each theme from the mailbox of its author profile", () => {
    const expected: Record<string, string> = {
      Gravity: "help@themeshopy.com",
      Rare: "help@themeshopy.com",
      Soft: "help@themeshopy.com",
      Noble: "support@frescosolutions.net",
      Zeal: "support@frescosolutions.net",
      Nexus: "support@samsitservices.com",
      Adorn: "support@vowelweb.com",
      Flaunt: "support@vowelweb.com",
      Dynamic: "support@vowelweb.com",
      Renovate: "support@vowelweb.com",
      Voltix: "support@vowelweb.com",
    };
    for (const [theme, email] of Object.entries(expected)) expect(senderEmailForTheme(theme)).toBe(email);
  });

  it("matches a theme name whatever its case, spacing or accents", () => {
    expect(authorProfileForTheme("  noble ")?.name).toBe("Fresco Solutions");
    expect(authorProfileForTheme("RENOVATE")?.id).toBe("vowel-web");
  });

  it("puts every theme under exactly one profile and gives every profile its own mailbox", () => {
    const themes = AUTHOR_PROFILES.flatMap((p) => p.themes.map((t) => t.toLowerCase()));
    expect(new Set(themes).size).toBe(themes.length);
    const emails = AUTHOR_PROFILES.map((p) => p.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const p of AUTHOR_PROFILES) expect(p.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
  });

  it("refuses a theme with no author profile instead of guessing a mailbox", () => {
    expect(senderEmailForTheme("Pretty")).toBeNull();
    expect(() => requireSenderForTheme("Pretty")).toThrow(/no author profile/);
    expect(requireSenderForTheme("Nexus").email).toBe("support@samsitservices.com");
  });
});
