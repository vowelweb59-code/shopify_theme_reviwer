// No semver package exists in this repo — this is a small, hand-rolled
// comparator scoped to what the app actually needs: ordering dotted numeric
// version strings extracted from a theme's README (e.g. "2.4.1"), without
// guessing at anything that doesn't look like one.

export type ParsedVersion = { raw: string; parts: number[] | null };

const NUMERIC_VERSION_RE = /^v?(\d+(?:\.\d+)*)/;

export function parseVersionForSort(raw: string): ParsedVersion {
  const match = NUMERIC_VERSION_RE.exec(raw.trim());
  if (!match) return { raw, parts: null };
  return { raw, parts: match[1].split(".").map(Number) };
}

/**
 * Numeric, segment-by-segment comparison (2.10.0 > 2.9.0, unlike a plain
 * string compare). A version that doesn't parse as dotted-numeric sorts
 * lower than any that does, rather than being guessed at — see
 * pickLatestVersion's fallback for what that means for "latest".
 */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (!a.parts && !b.parts) return 0;
  if (!a.parts) return -1;
  if (!b.parts) return 1;
  const len = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.parts[i] ?? 0) - (b.parts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * The theme's "current/latest" version: the highest dotted-numeric version
 * among those given. If none of them parse as one (every version string is
 * non-numeric/unrecognized), falls back to whichever was created most
 * recently — an explicit, documented rule rather than a silent guess, per
 * the requirement to "handle safely rather than guessing" when a version
 * isn't valid semver.
 */
export function pickLatestVersion<T extends { version: string; createdAt: Date }>(versions: T[]): T | null {
  if (versions.length === 0) return null;

  const withParsed = versions.map((v) => ({ v, parsed: parseVersionForSort(v.version) }));
  const anyParsed = withParsed.some((e) => e.parsed.parts !== null);

  if (!anyParsed) {
    return versions.reduce((latest, v) => (v.createdAt > latest.createdAt ? v : latest));
  }

  return withParsed.reduce((best, entry) => (compareVersions(entry.parsed, best.parsed) > 0 ? entry : best)).v;
}
