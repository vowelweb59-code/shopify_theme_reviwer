import { normalizeName } from '../import/text';

/** A written name finds its Chat sender by full name, or by first name when only one sender has it. */
export function matchSender(name: string, senders: ReadonlyArray<{ id: string; displayName: string }>): string | null {
  const key = normalizeName(name);
  const full = senders.filter((s) => normalizeName(s.displayName) === key);
  if (full.length === 1) return full[0]!.id;
  if (key.includes(' ')) return null;
  const first = senders.filter((s) => normalizeName(s.displayName).split(' ')[0] === key);
  return first.length === 1 ? first[0]!.id : null;
}
