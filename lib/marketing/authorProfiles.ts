// Author profiles for theme marketing (owner, 2026-11-23): every marketing action for a theme (an email, a campaign, a reply) has to go out
// as the theme's AUTHOR PROFILE, i.e. from that profile's own mailbox, never from another one. The profiles are the Theme Store accounts
// ("portals" in the Projects page); each has one Zoho mailbox. Nothing here sends mail: it only says which identity a theme must use, and
// any future marketing feature must get its sender from `requireSenderForTheme` so a theme can never be marketed from the wrong mailbox.

export interface AuthorProfile {
  id: string;
  /** The Theme Store account, named as in the Projects page portals. */
  name: string;
  /** The Zoho mailbox every marketing action for the profile's themes is sent from. */
  email: string;
  /** The themes published under this profile. */
  themes: readonly string[];
}

export const AUTHOR_PROFILES: readonly AuthorProfile[] = [
  { id: "themeshopy", name: "Themeshopy", email: "help@themeshopy.com", themes: ["Gravity", "Rare", "Soft"] },
  { id: "fresco-solutions", name: "Fresco Solutions", email: "support@frescosolutions.net", themes: ["Noble", "Zeal"] },
  { id: "sams", name: "SAMS", email: "support@samsitservices.com", themes: ["Nexus"] },
  { id: "vowel-web", name: "Vowel Web", email: "support@vowelweb.com", themes: ["Adorn", "Flaunt", "Dynamic", "Renovate", "Voltix"] },
];

const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const BY_THEME = new Map(AUTHOR_PROFILES.flatMap((p) => p.themes.map((t) => [key(t), p] as const)));

/** The author profile a theme is published under, or null when the theme is not configured. */
export function authorProfileForTheme(themeName: string): AuthorProfile | null {
  return BY_THEME.get(key(themeName)) ?? null;
}

/** The mailbox a theme's marketing goes out from, or null when the theme is not configured. */
export function senderEmailForTheme(themeName: string): string | null {
  return authorProfileForTheme(themeName)?.email ?? null;
}

/** The identity to send as. Throws for a theme with no author profile, so nothing is ever sent from a guessed mailbox. */
export function requireSenderForTheme(themeName: string): { profile: AuthorProfile; email: string } {
  const profile = authorProfileForTheme(themeName);
  if (!profile) throw new Error(`"${themeName}" has no author profile, so it has no mailbox to send marketing from.`);
  return { profile, email: profile.email };
}
