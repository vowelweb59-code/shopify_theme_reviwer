import { Parser } from "htmlparser2";
import { BROWSER_UA } from "@/lib/net/fetchPublic";

export type StoreVersion = { version: string; /** YYYY-MM-DD, or null when the listing shows no date for that version. */ releasedOn: string | null };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "October 13, 2026" -> "2026-10-13"; null for anything else. */
export function parseReleaseDate(text: string): string | null {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  const day = Number(m[2]);
  if (month < 0 || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The Theme Store's "Release notes" modal (…/presets/<preset>/modal_version_details) lists every version, newest first, each as
 * `<h3>Version X.Y.Z</h3>` followed by a `<p>` holding its release date. Some versions carry no date (the first paragraph after
 * the heading is then the summary), so they come back with `releasedOn: null`. Headings inside a release note's body ("Added",
 * "Changed") never start with "Version", so they are ignored.
 */
export function parseVersionHistory(html: string): StoreVersion[] {
  const versions: StoreVersion[] = [];
  let mode: "idle" | "in-h3" | "awaiting-p" | "in-p" = "idle";
  let version = "";
  let buffer = "";
  const parser = new Parser(
    {
      onopentag(name) {
        if (name === "h3" && mode !== "in-h3") {
          // A version with no <p> at all before the next heading still counts, undated.
          if (mode === "awaiting-p") versions.push({ version, releasedOn: null });
          mode = "in-h3";
          buffer = "";
        } else if (name === "p" && mode === "awaiting-p") {
          mode = "in-p";
          buffer = "";
        }
      },
      ontext(text) {
        if (mode === "in-h3" || mode === "in-p") buffer += text;
      },
      onclosetag(name) {
        if (mode === "in-h3" && name === "h3") {
          const m = /^Version\s+(.+)$/i.exec(buffer.trim());
          if (m) {
            version = m[1].trim();
            mode = "awaiting-p";
          } else mode = "idle";
        } else if (mode === "in-p" && name === "p") {
          versions.push({ version, releasedOn: parseReleaseDate(buffer) });
          mode = "idle";
        }
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  // `mode` is changed inside the parser callbacks, which TypeScript cannot see here.
  if ((mode as string) === "awaiting-p") versions.push({ version, releasedOn: null });
  return versions;
}

/** Fetches one theme's full release history from the Theme Store (null when the page can't be read or lists no version). */
export async function fetchStoreVersionHistory(slug: string, presetSlug: string = slug): Promise<StoreVersion[] | null> {
  const url = `https://themes.shopify.com/themes/${slug}/presets/${presetSlug}/modal_version_details?open_first=true`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
      headers: { "User-Agent": BROWSER_UA, Accept: "text/vnd.turbo-stream.html, text/html" },
    });
    if (!res.ok) return null;
    const versions = parseVersionHistory(await res.text());
    return versions.length > 0 ? versions : null;
  } catch {
    return null;
  }
}
