import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { hostOf, removePassword, savePassword, savedPasswordHosts } from "@/lib/themes/demoPasswords";
import { Theme } from "@/models/theme";

/**
 * Passwords of this theme's password-protected demo stores. The browser only ever learns WHICH hosts have one (GET); the password
 * itself goes in (PUT {url, password}: checked against the store's own password page before it is saved, then stored encrypted)
 * and is never returned. DELETE ?host= removes one.
 */
async function theme(params: Promise<{ themeId: string }>) {
  const { themeId } = await params;
  if (!isValidObjectId(themeId)) return { error: invalidIdResponse("themeId") } as const;
  await connectToDatabase();
  if (!(await Theme.exists({ _id: themeId }))) return { error: NextResponse.json({ error: "Theme not found." }, { status: 404 }) } as const;
  return { themeId } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  const t = await theme(params);
  if ("error" in t) return t.error;
  return NextResponse.json({ hosts: await savedPasswordHosts(t.themeId) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  const t = await theme(params);
  if ("error" in t) return t.error;
  const body = (await request.json().catch(() => null)) as { url?: unknown; password?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!hostOf(url)) return NextResponse.json({ error: "A demo store URL is required." }, { status: 400 });
  if (password.length > 200) return NextResponse.json({ error: "That password is too long." }, { status: 400 });
  let error: string | null;
  try {
    error = await savePassword(t.themeId, url, password);
  } catch (err) {
    // Typically ANALYTICS_TOKEN_ENCRYPTION_KEY not set: the passwords are encrypted with it.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save the password." }, { status: 500 });
  }
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true, hosts: await savedPasswordHosts(t.themeId) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  const t = await theme(params);
  if ("error" in t) return t.error;
  const host = new URL(request.url).searchParams.get("host")?.trim() ?? "";
  if (!host) return NextResponse.json({ error: "host is required." }, { status: 400 });
  await removePassword(t.themeId, host);
  return NextResponse.json({ ok: true, hosts: await savedPasswordHosts(t.themeId) });
}
