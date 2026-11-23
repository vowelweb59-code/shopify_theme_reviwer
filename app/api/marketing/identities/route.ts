import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AUTHOR_PROFILES, authorProfileForTheme } from "@/lib/marketing/authorProfiles";
import { Theme } from "@/models/theme";

// GET /api/marketing/identities: every theme with the author profile and mailbox its marketing must use, and the live themes that have none.
export async function GET() {
  await connectToDatabase();
  const themes = await Theme.find().select("name themeStoreLive").sort({ name: 1 }).lean<Array<{ name: string; themeStoreLive?: boolean | null }>>();
  const rows = themes.map((t) => {
    const p = authorProfileForTheme(t.name);
    return { theme: t.name, live: t.themeStoreLive !== false, profile: p?.name ?? null, email: p?.email ?? null };
  });
  const known = new Set(themes.map((t) => t.name.toLowerCase()));
  return NextResponse.json({
    profiles: AUTHOR_PROFILES.map((p) => ({ id: p.id, name: p.name, email: p.email, themes: p.themes })),
    rows: rows.filter((r) => r.live),
    // Live themes nobody configured: they cannot be marketed until they are given a profile.
    unconfigured: rows.filter((r) => r.live && !r.profile).map((r) => r.theme),
    // Configured themes the app does not have (a typo, or a theme not added yet).
    missing: AUTHOR_PROFILES.flatMap((p) => p.themes).filter((t) => !known.has(t.toLowerCase())),
  });
}
