// Matches a Chat sender to a platform user by display name. Deliberately strict: only an exact normalised full-name
// match to exactly one active user counts. Anything else stays unmatched until someone links it by hand.
import { normalizeName } from './text';

export interface MatchableUser {
  id: string;
  displayName: string;
  active: boolean;
}

export function matchSenderToUser(senderName: string, users: readonly MatchableUser[]): string | null {
  const key = normalizeName(senderName);
  if (!key) return null;
  const hits = users.filter((u) => u.active && normalizeName(u.displayName) === key);
  return hits.length === 1 ? hits[0]!.id : null;
}
