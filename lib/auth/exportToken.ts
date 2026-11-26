import { createHash, timingSafeEqual } from "node:crypto";

// A separate, read-only way in for ONE endpoint: the Live Project Chat Summary export (owner, 2026-11-26), so the daily job on the owner's PC
// does not need the team's login password. `SPACE_EXPORT_TOKEN` (a long random string, set on Render and in the owner's local env file) is
// sent as `Authorization: Bearer <token>`. It opens these two read-only GET paths and nothing else; with no token set, or a short one, it is switched off.
export const SPACE_EXPORT_PATH = "/api/service/space-scan/export";
/** The read-only list of spaces matched to active projects (owner, 2026-11-26) opens with the same token. */
export const SPACE_LIST_PATH = "/api/service/space-scan/spaces";
const TOKEN_PATHS = new Set([SPACE_EXPORT_PATH, SPACE_LIST_PATH]);
export const MIN_EXPORT_TOKEN_LENGTH = 32;

const digest = (s: string) => createHash("sha256").update(s).digest();

export function hasValidExportToken(headers: Headers, env: Record<string, string | undefined>): boolean {
  const token = env.SPACE_EXPORT_TOKEN?.trim();
  if (!token || token.length < MIN_EXPORT_TOKEN_LENGTH) return false;
  const match = /^Bearer\s+(.+)$/i.exec(headers.get("authorization") ?? "");
  if (!match) return false;
  return timingSafeEqual(digest(match[1].trim()), digest(token));
}

/** True when the request is the token-holder's GET of the export path (the login gate then lets it through). */
export function isExportTokenRequest(
  request: { method: string; headers: Headers; nextUrl: { pathname: string } },
  env: Record<string, string | undefined>
): boolean {
  return request.method === "GET" && TOKEN_PATHS.has(request.nextUrl.pathname) && hasValidExportToken(request.headers, env);
}
