import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authMode,
  createSessionToken,
  credentialsMatch,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { clientIp, recordFailure, recordSuccess, retryAfterSeconds } from "@/lib/auth/loginRateLimit";

// POST /api/session — sign in with { username, password }; sets the
// session cookie. DELETE /api/session — sign out. Reachable without a
// session (see proxy.ts); cross-site POSTs are still blocked by the
// proxy's CSRF guard, so another site can't log a browser in or out.

const MAX_FIELD_LENGTH = 256;

export async function POST(request: NextRequest) {
  const mode = authMode(process.env);
  if (mode === "open") return NextResponse.json({ ok: true });
  if (mode === "misconfigured") {
    return NextResponse.json({ error: "Sign-in isn't configured on this server." }, { status: 503 });
  }

  const ip = clientIp(request.headers);
  const wait = retryAfterSeconds(ip);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? "s" : ""}.` },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { username, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof username !== "string" || typeof password !== "string" || username.length > MAX_FIELD_LENGTH || password.length > MAX_FIELD_LENGTH) {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }

  if (!credentialsMatch(username, password, process.env)) {
    recordFailure(ip);
    // A short fixed delay makes scripted guessing slower still.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  recordSuccess(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(process.env), sessionCookieOptions(process.env));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(process.env), maxAge: 0 });
  return response;
}
