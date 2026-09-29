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

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF guard for state-changing API calls. Browsers send Basic Auth
 * credentials on cross-site requests too, so without this any page a
 * signed-in teammate visits could, say, auto-submit a form that
 * disconnects a Google account. Blocks a mutating /api request when the
 * browser says it came from another site (Sec-Fetch-Site), or its Origin's
 * host isn't this app's. Requests with neither header (curl, scripts,
 * server-to-server) aren't browser-driven and pass. The scheme is ignored
 * on purpose: behind Render's TLS proxy the app itself may see http.
 */
export function isCrossSiteMutation(request: { method: string; headers: Headers; nextUrl: { pathname: string; host: string } }): boolean {
  if (!MUTATING_METHODS.has(request.method) || !request.nextUrl.pathname.startsWith("/api/")) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true; // "null" or garbage Origin on a mutating request
  }
}

const UNAUTHORIZED = () =>
  new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Shopify Theme Auditor"' },
  });

/**
 * What the login gate does for these settings. Fails closed in production
 * (the user's decision, 2026-09-29): missing credentials there mean a
 * broken deploy, not an open site. Local dev (NODE_ENV=development/test)
 * stays open without credentials; BASIC_AUTH_DISABLED=1 opens a
 * production build on purpose (e.g. running `next start` locally).
 */
export function authMode(env: Record<string, string | undefined>): "check" | "open" | "misconfigured" {
  if (env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD) return "check";
  if (env.NODE_ENV !== "production" || env.BASIC_AUTH_DISABLED === "1") return "open";
  return "misconfigured";
}

/**
 * HTTP Basic Auth gate for this otherwise-unauthenticated internal tool
 * (see authMode for when it applies).
 *
 * Named `proxy` (not `middleware`) per Next.js 16's rename — see
 * node_modules/next/dist/docs/.../proxy.md's migration notes.
 */
export function proxy(request: NextRequest) {
  if (isCrossSiteMutation(request)) return new NextResponse("Cross-site request blocked.", { status: 403 });

  const mode = authMode(process.env);
  if (mode === "open") return NextResponse.next();
  if (mode === "misconfigured") {
    return new NextResponse("The site's login isn't configured (BASIC_AUTH_USER / BASIC_AUTH_PASSWORD), so access is refused.", { status: 503 });
  }
  const expectedUser = process.env.BASIC_AUTH_USER!;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD!;

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
