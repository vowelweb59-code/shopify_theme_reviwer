# Security

How the app is protected, what the 2026-09-29 review found and fixed, and what's still open.

The app is a single-team internal tool. It runs as one Render instance (Docker, Next.js 16, MongoDB Atlas) and has one shared login.

## How access works

- **Login page, not a browser popup.** `/login` posts to `POST /api/session`. A correct username and password set a signed session cookie called `sta_session`.
  - The cookie is HttpOnly, Secure in production and SameSite=Lax, and lasts 7 days.
  - `proxy.ts` checks the cookie on every request. A signed-out page visit is sent to `/login?next=…`. A signed-out API call gets a 401.
- **Credentials:** `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`. The names are left over from Basic Auth, and they are the same Render variables as before.
  - Sessions are signed with `SESSION_SECRET` if it's set, otherwise with a key derived from the credentials. Either way, changing the password signs everyone out.
  - In production the site refuses all access if the credentials are missing (`BASIC_AUTH_DISABLED=1` turns that off on purpose).
- **Brute force:** 5 failed logins per IP per 15 minutes, 100 across all IPs, and a 400 ms delay on each failure (`lib/auth/loginRateLimit.ts`).
- **Open redirects:** `next` only accepts same-site paths (`lib/auth/nextPath.ts`).
- **CSRF:** the proxy blocks cross-site POST/PUT/PATCH/DELETE to `/api/*` (Sec-Fetch-Site / Origin), including sign-in itself.
- **Public without a session:** only `/login`, `/api/session`, `/api/health` and `/_next/static/*`. The exclusions are anchored, so `/api/healthz` is not public.

## Fixed in the 2026-09-29 review

| # | Severity | Issue | Fix |
|---|---|---|---|
| H1 | High | Sheets OAuth callback had no `state`, so a link could connect an attacker's Google account and exports would go to their Drive | Random `state` in a short-lived cookie, checked in the callback (`app/api/auth/google/*`) |
| H2 | High | Next.js 16.3.0 had critical advisories; sharp (via Next) had a high one | Next and eslint-config-next 16.3.6, `images.unoptimized`; `npm audit fix` for qs |
| M1 | Medium | SSRF: preset/demo URLs, and links found in fetched pages, could make the server request localhost, private IPs or cloud metadata, including through redirects | `lib/net/publicUrl.ts`: http(s) only, DNS-checked against private/reserved ranges, every redirect re-checked (max 5), 5 MB body cap |
| M2 | Medium | No security headers; `X-Powered-By` sent | CSP `frame-ancestors 'none'` + base-uri/object-src/form-action, X-Frame-Options, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP; `poweredByHeader: false` |
| M3 | Medium | Repeated clicks started parallel crawls; audits had no concurrency limit; tracked ranking filters had no cap | One crawl at a time per scheduler, at most 2 audits at once (the rest queue), at most 100 tracked filters |
| M4 | Medium | Sheets refresh token stored in plaintext | AES-256-GCM with the GA4 key, `select: false`; old plaintext tokens are re-saved encrypted on first use |
| L1 | Low | Proxy exclusion was a prefix match (`/api/health*` skipped auth) | Anchored matcher |
| L2 | Low | Six theme routes returned 500 on a malformed id | `isValidObjectId` → 400 |
| L3 | Low | CSV export could run formulas (a theme named `=HYPERLINK(…)`) | Leading `= + - @` tab/CR escaped with `'` |
| L4 | Low | Google error text sent back to the browser and put in URLs | Fixed messages; details only in the server log |
| L5 | Low | `PATCH /api/enhancements` accepted any `notes` value | Must be a string of at most 5,000 characters |
| L8 | Low | Login `next` accepted `/\t/evil.com` | Backslashes and control characters rejected |
| L10 | Low | Local Mongo was published on every network interface with no auth | Bound to 127.0.0.1 |

Already in good shape before the review:
- ZIP extraction: path traversal, size, count and zip-bomb limits, temp cleanup.
- GA4 OAuth: state checked, tokens encrypted.
- No `dangerouslySetInnerHTML`, and HTML/PDF export escapes all output.
- No request bodies spread into Mongo updates.
- No secrets in git history.
- The container runs as a non-root user.

## Still to do (in priority order)

1. **Ops, now:** set `SESSION_SECRET` on Render (a long random string) and make sure the login password is long and unique. Deploying signs everyone in again once.
2. **DNS rebinding (residual M1):** the SSRF guard checks the address at lookup time, but `fetch()` resolves the name again when it connects. Closing this needs a connection pinned to the checked IP (an undici `Agent` with a custom `lookup`).
3. **Upload size (L7), left as is (user's decision, 2026-09-29):** because a proxy exists, Next buffers request bodies only up to 10 MB (`experimental.proxyClientMaxBodySize`). Revisit if a theme ZIP over 10 MB fails to audit.
4. **Sheets scope, done 2026-09-29:** new connections ask only for `drive.file` (the app's own sheets) and the account email. An account connected earlier keeps the broader `spreadsheets` access until it is disconnected and connected again; Settings shows a notice until then.
5. **Script CSP:** add `script-src` with nonces (via the proxy) to cut XSS risk further. The report print export's inline `onclick` needs moving into a script first.
6. **List endpoints (L6):** `/api/reports`, `/api/demo-store`, findings and themes have no pagination. Fine at today's size (retention keeps 3 audits per theme); add limits if the data grows.
7. **`uuid` advisory (moderate, via exceljs):** not reachable (exceljs doesn't use the `buf` argument). Upgrade when exceljs ships a fix.
8. **If the team grows:** give each person their own account (or Google sign-in limited to the company domain) instead of one shared password, and keep an audit log of logins and destructive actions.
