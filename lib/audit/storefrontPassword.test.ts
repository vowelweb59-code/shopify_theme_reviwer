import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicText } from "@/lib/net/publicUrl";
import { isPasswordPage, loginToStorefront, parseHiddenInputs } from "./storefrontPassword";

const publicDns = async () => [{ address: "93.184.216.34" }];

const PASSWORD_PAGE = `<html><body><form method="post" action="/password" id="login_form">
<input type="hidden" name="form_type" value="storefront_password"><input type="hidden" name="utf8" value="✓">
<input type="password" name="password"></form></body></html>`;
const HOME = "<html><body><div id='shopify-section-header' class='shopify-section'>Welcome</div></body></html>";

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}
function page(body: string, cookies: string[] = []): Response {
  const headers = new Headers({ "content-type": "text/html" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(body, { status: 200, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("password page detection", () => {
  it("recognises Shopify's password page and not an ordinary page", () => {
    expect(isPasswordPage(PASSWORD_PAGE)).toBe(true);
    expect(isPasswordPage(HOME)).toBe(false);
  });
  it("reads the hidden fields of the password form", () => {
    expect(parseHiddenInputs(PASSWORD_PAGE)).toEqual({ form_type: "storefront_password", utf8: "✓" });
  });
});

describe("loginToStorefront", () => {
  it("logs in and returns the session cookie for the store's host", async () => {
    const calls: { url: string; method: string; cookie: string | null; body?: string }[] = [];
    vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
      const headers = new Headers(init.headers);
      calls.push({ url: String(url), method: init.method ?? "GET", cookie: headers.get("cookie"), body: init.body as string | undefined });
      if (init.method === "POST") return redirect("/", ["storefront_digest=abc123; path=/; HttpOnly", "_shopify_y=zzz; path=/"]);
      if (String(url).endsWith("/password")) return page(PASSWORD_PAGE, ["_cmp_a=1; path=/"]);
      return headers.get("cookie")?.includes("storefront_digest=abc123") ? page(HOME) : redirect("/password");
    });
    const result = await loginToStorefront("https://demo.example.com/some/page", "letmein", publicDns);
    expect(result).toEqual({ ok: true, session: { host: "demo.example.com", cookie: expect.stringContaining("storefront_digest=abc123") } });
    const post = calls.find((c) => c.method === "POST");
    expect(post?.url).toBe("https://demo.example.com/password");
    expect(post?.body).toContain("password=letmein");
    expect(post?.body).toContain("form_type=storefront_password");
  });

  it("says so when the store does not accept the password", async () => {
    vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
      if (init.method === "POST") return page(PASSWORD_PAGE); // wrong password: the form again
      if (String(url).endsWith("/password")) return page(PASSWORD_PAGE);
      return redirect("/password");
    });
    expect(await loginToStorefront("https://demo.example.com", "wrong", publicDns)).toEqual({ ok: false, error: "The store did not accept that password." });
  });

  it("returns no session for a store that is not password-protected", async () => {
    vi.stubGlobal("fetch", async (url: URL) => (String(url).endsWith("/password") ? redirect("/") : page(HOME)));
    expect(await loginToStorefront("https://open.example.com", "x", publicDns)).toEqual({ ok: true, session: null });
  });

  it("never reaches a private address", async () => {
    const result = await loginToStorefront("http://127.0.0.1", "x");
    expect(result.ok).toBe(false);
  });
});

describe("the session cookie", () => {
  it("is sent to the store's host but not to a redirect to another host", async () => {
    const seen: { url: string; cookie: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
      seen.push({ url: String(url), cookie: new Headers(init.headers).get("cookie") });
      return String(url).startsWith("https://demo.example.com") ? redirect("https://other.example.org/x") : page(HOME);
    });
    await fetchPublicText("https://demo.example.com/", { timeoutMs: 1000, resolve: publicDns, session: { host: "demo.example.com", cookie: "storefront_digest=abc" } });
    expect(seen[0]).toEqual({ url: "https://demo.example.com/", cookie: "storefront_digest=abc" });
    expect(seen[1]).toEqual({ url: "https://other.example.org/x", cookie: null });
  });
});
