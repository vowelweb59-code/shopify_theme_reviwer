// Finds the client (and Upwork profile) inside the free-text client field. The same field arrives as
// "Client | Profile", "Client - Profile", "R | Client | Profile", "App | Client | Profile", "Client (Person)- Profile",
// "Client, Company | Profile", or just "Client". The registry of known clients decides which part is the client.
import { resolveClient, type ClientMatch, type KnownClient } from './client-match';
import { normalizeName } from './text';

export interface ClientField {
  match: ClientMatch;
  /** Upwork profile as written, when one can be told apart from the client. */
  profile: string | null;
}

// Short labels people prefix to the client ("R |" = reseller work, "App |" = app project). Not part of the name.
const TAGS = new Set(['r', 'app']);

// A label some people write before the name: "Client: Name", "Client:- Name", "Client Name:- Name".
const LABEL = /^\s*(?:client(?:\s+name)?|app\s+scope|project)\s*[:\-–—]+\s*/i;

const segments = (raw: string): string[] =>
  raw
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s*\|\s*|\s+[-–—]\s+|\s+l\s+/)
    .map((s) => s.replace(LABEL, '').trim())
    .filter(Boolean);

export function extractClient(raw: string, known: readonly KnownClient[]): ClientField {
  const parts = segments(raw).filter((s) => !TAGS.has(normalizeName(s)));
  const padded = ` ${normalizeName(raw)} `;

  // 1. A registry name written whole inside the field wins; the longest one if several are contained.
  const contained = known
    .map((c) => ({ c, key: normalizeName(c.name) }))
    .filter((x) => x.key && padded.includes(` ${x.key} `))
    .sort((a, b) => b.key.length - a.key.length);
  let match: ClientMatch;
  const top = contained.filter((x) => x.key.length === contained[0]?.key.length);
  // Several spellings of one client (a name and its alias) are not an ambiguity.
  if (contained.length && new Set(top.map((x) => x.c.id)).size === 1) {
    match = { status: 'EXACT', client: top[0].c };
  } else if (contained.length) {
    match = { status: 'AMBIGUOUS', candidates: top.map((x) => x.c) };
  } else {
    // 2. Otherwise each segment is tried as a (possibly mistyped) client name.
    const tried = parts.map((p) => resolveClient(p, known));
    match = tried.find((m) => m.status === 'EXACT' || m.status === 'CORRECTED') ?? tried.find((m) => m.status === 'AMBIGUOUS') ?? { status: 'UNKNOWN' };
  }

  // The profile is the last segment that is not the client itself ("No Timer" is not a profile either).
  const clientKey = match.status === 'EXACT' || match.status === 'CORRECTED' ? normalizeName(match.client.name) : null;
  const others = parts.filter((p) => {
    const k = normalizeName(p);
    return k && k !== 'no timer' && !(clientKey && (k === clientKey || k.includes(clientKey) || clientKey.includes(k)));
  });
  // With an unmatched client the first segment is taken to be the client, so only later segments can be a profile.
  const profile = clientKey ? others[others.length - 1] : parts.length > 1 ? parts[parts.length - 1] : undefined;
  return { match, profile: profile ?? null };
}

/** A guess at the client name inside a field no registered client matches: the first part, without tags or brackets. */
export function suggestClientName(raw: string): string | null {
  const first = segments(raw).filter((s) => !TAGS.has(normalizeName(s)))[0];
  if (!first || first.length < 3 || first.length > 80) return null;
  return ['unknown', 'no timer', 'in house', 'inhouse'].includes(normalizeName(first)) ? null : first;
}

/**
 * Owner rule: when the client field names no known client (a line like "R | Yitzy Lazar | Adnan - TIMER OFF" reads as client "R"),
 * look for a known client's name anywhere in the text of the line. Exactly one client found gives that client; none, or two
 * different ones, gives nothing. Names under 5 letters are not searched for (too many ordinary words).
 */
export function findClientInText(text: string, known: readonly KnownClient[]): KnownClient | null {
  const padded = ` ${normalizeName(text)} `;
  const hits = known.map((c) => ({ c, key: normalizeName(c.name) })).filter((x) => x.key.length >= 5 && padded.includes(` ${x.key} `));
  // a name inside a longer hit is part of it ("Mark Flick" over "Mark"), so only the outermost names count
  const outer = hits.filter((x) => !hits.some((y) => y !== x && y.key.length > x.key.length && ` ${y.key} `.includes(` ${x.key} `)));
  const ids = new Set(outer.map((x) => x.c.id));
  return ids.size === 1 ? outer[0]!.c : null; // two different clients named: no answer
}

/** "Yitzy Lazar | Adnan" written in the profile place: the profile is the last part. */
export const profileTail = (profile: string): string => profile.split(/\s*\|\s*/).filter(Boolean).at(-1) ?? profile;

/**
 * Owner rule: a client written by one name only ("Bodog") is the client whose name starts with that word, when exactly one
 * client does ("Bodog Olah"). Common first names that start several clients ("Adam", "Gary") give nothing.
 */
export function findClientByFirstWord(raw: string, known: readonly KnownClient[]): KnownClient | null {
  const written = normalizeName(suggestClientName(raw) ?? '');
  if (!written || written.includes(' ') || written.length < 4) return null;
  const hits = known.filter((c) => normalizeName(c.name).split(' ')[0] === written);
  return new Set(hits.map((c) => c.id)).size === 1 ? hits[0]! : null;
}
