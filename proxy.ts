import { NextRequest, NextResponse } from "next/server";

// Excludes /api/health so an uptime monitor / platform health check
// doesn't need credentials, and static assets so a 401 doesn't break page
// rendering before the browser even gets to send credentials.
export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};

// Plain-JS constant-time comparison — avoids node:crypto's timingSafeEqual
// (not guaranteed available in the Edge runtime middleware runs under by
// default) and Buffer (also not an Edge global); atob() below is a Web
// Platform API and works the same in both runtimes.
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

const UNAUTHORIZED = () =>
  new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Shopify Theme Auditor"' },
  });

/**
 * HTTP Basic Auth gate for this otherwise-unauthenticated internal tool.
 * Deliberately opt-in: unset BASIC_AUTH_USER/BASIC_AUTH_PASSWORD in local
 * dev (the default) and this is a no-op; set both once deployed to
 * actually password-protect it.
 *
 * Named `proxy` (not `middleware`) per Next.js 16's rename — see
 * node_modules/next/dist/docs/.../proxy.md's migration notes.
 */
export function proxy(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) return NextResponse.next();

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return UNAUTHORIZED();

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return UNAUTHORIZED();
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return UNAUTHORIZED();
  const suppliedUser = decoded.slice(0, separatorIndex);
  const suppliedPassword = decoded.slice(separatorIndex + 1);

  if (timingSafeStringEqual(suppliedUser, expectedUser) && timingSafeStringEqual(suppliedPassword, expectedPassword)) {
    return NextResponse.next();
  }
  return UNAUTHORIZED();
}
