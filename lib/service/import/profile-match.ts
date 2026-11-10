// Resolves the profile name written in Chat ("Client | Sapana") to a known Upwork profile by its name or an alias.
// Exact after normalisation: a name that fits two profiles resolves to neither.
import { normalizeName } from './text';

export interface MatchableProfile {
  id: string;
  name: string;
  aliases: readonly string[];
}

export function matchProfile(raw: string | null | undefined, profiles: readonly MatchableProfile[]): string | null {
  const key = normalizeName(raw ?? '');
  if (!key) return null;
  const hits = profiles.filter((p) => normalizeName(p.name) === key || p.aliases.some((a) => normalizeName(a) === key));
  return hits.length === 1 ? hits[0]!.id : null;
}
