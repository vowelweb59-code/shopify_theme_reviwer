import { Parser } from "htmlparser2";
import { BROWSER_UA } from "@/lib/net/fetchPublic";

/** One heading of a release note ("Added", "Fixes and Other Improvements") with its bullet points. */
export type ReleaseNoteGroup = { heading: string; items: string[] };
export type StoreVersion = {
  version: string;
  /** YYYY-MM-DD, or null when the listing shows no date for that version. */
  releasedOn: string | null;
  /** The one-paragraph summary the store shows under the version. */
  summary?: string | null;
  /** The release note's own sections and bullets. */
  notes?: ReleaseNoteGroup[];
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "October 13, 2026" -> "2026-10-13"; null for anything else. */
export function parseReleaseDate(text: string): string | null {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  const day = Number(m[2]);
  if (month < 0 || day < 1 || day > 31) return null;
  return m[3] + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * The Theme Store's "Release notes" modal (…/presets/<preset>/modal_version_details) lists every version, newest first. Each is
 * a `<h3>Version X.Y.Z</h3>` followed by a paragraph with its release date (some versions show none), a summary
 * paragraph, and a release-note body whose own headings ("Added", "Changed", ...) hold bullet lists. Headings inside the body
 * never start with "Version", so they are told apart from version headings.
 */
export function parseVersionHistory(html: string): StoreVersion[] {
  const versions: StoreVersion[] = [];
  let current: (StoreVersion & { notes: ReleaseNoteGroup[] }) | null = null;
  let capture: "h3" | "p" | "li" | null = null;
  let buffer = "";
  let bodyDepth = 0; // > 0 while inside a release-note body

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (bodyDepth > 0) {
          bodyDepth++;
          if (name === "h3" || name === "li") {
            capture = name;
            buffer = "";
          }
          return;
        }
        if ((attribs.class ?? "").includes("release-note-body")) {
          bodyDepth = 1;
          return;
        }
        if (name === "h3") {
          capture = "h3";
          buffer = "";
        } else if (name === "p" && current) {
          capture = "p";
          buffer = "";
        }
      },
      ontext(text) {
        if (capture) buffer += text;
      },
      onclosetag(name) {
        if (bodyDepth > 0) {
          bodyDepth--;
          if (capture === name && current) {
            const text = clean(buffer);
            if (name === "h3" && text) current.notes.push({ heading: text, items: [] });
            else if (name === "li" && text) {
              if (current.notes.length === 0) current.notes.push({ heading: "", items: [] });
              current.notes[current.notes.length - 1].items.push(text);
            }
            capture = null;
          }
          return;
        }
        if (capture === "h3" && name === "h3") {
          const m = /^Version\s+(.+)$/i.exec(clean(buffer));
          if (m) {
            current = { version: m[1].trim(), releasedOn: null, summary: null, notes: [] };
            versions.push(current);
          }
          capture = null;
        } else if (capture === "p" && name === "p" && current) {
          const text = clean(buffer);
          if (text) {
            const date = current.releasedOn === null && current.summary === null ? parseReleaseDate(text) : null;
            if (date) current.releasedOn = date;
            else if (current.summary === null) current.summary = text;
          }
          capture = null;
        }
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
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
