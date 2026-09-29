import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authMode, isValidSessionToken } from "@/lib/auth/session";

export { authMode };

// Excludes /api/health so an uptime monitor / platform health check
// doesn't need a session, and Next's static assets. The `$` anchors keep
// the exclusion exact: without them /api/healthz or /api/health/x would
// also skip the login check.
export const config = {
  matcher: ["/((?!api/health$|_next/static/|favicon\\.ico$).*)"],
};

// Reachable without a session: the login page and the sign-in/out endpoint.
function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/api/session";
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF guard for state-changing API calls, on top of the session cookie's
 * SameSite=Lax: without it, a page a signed-in teammate visits could, say,
 * auto-submit a form that disconnects a Google account (or signs them in
 * to an attacker's session). Blocks a mutating /api request when the
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

/**
 * Login gate (see lib/auth/session.ts). Signed-out page visits go to
 * /login?next=<path>; signed-out API calls get a 401 JSON error, since a
 * redirect to an HTML page is useless to fetch().
 *
 * Named `proxy` (not `middleware`) per Next.js 16's rename — see
 * node_modules/next/dist/docs/.../proxy.md's migration notes. Proxy runs on
 * the Node.js runtime, so node:crypto is available.
 */
export function proxy(request: NextRequest) {
  if (isCrossSiteMutation(request)) return new NextResponse("Cross-site request blocked.", { status: 403 });

  const mode = authMode(process.env);
  const { pathname, search } = request.nextUrl;

  if (mode === "open") {
    return pathname === "/login" ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (mode === "misconfigured") {
    return new NextResponse("The site's login isn't configured (BASIC_AUTH_USER / BASIC_AUTH_PASSWORD), so access is refused.", { status: 503 });
  }

  const signedIn = isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value, process.env);
  if (signedIn) {
    return pathname === "/login" ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (isPublicPath(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}
