// Auto-detects the client a (possibly mistyped) name refers to, against the registry of known clients.
// Owner decision: typos are corrected automatically; only ambiguous or unknown names need a human.
import { editDistance, normalizeName } from './text';

export interface KnownClient {
  id: string;
  name: string;
}

export type ClientMatch =
  | { status: 'EXACT'; client: KnownClient }
  | { status: 'CORRECTED'; client: KnownClient; distance: number }
  | { status: 'AMBIGUOUS'; candidates: KnownClient[] }
  | { status: 'UNKNOWN' };

/** Typos allowed grow with name length; very short names must match exactly so "Al" never becomes "Ali". */
const maxTypos = (len: number) => (len < 5 ? 0 : len < 9 ? 1 : 2);

export function resolveClient(raw: string, known: readonly KnownClient[]): ClientMatch {
  const key = normalizeName(raw);
  if (!key) return { status: 'UNKNOWN' };

  const scored = known.map((c) => ({ c, key: normalizeName(c.name), d: 0 }));
  for (const s of scored) s.d = editDistance(key, s.key);

  const exact = scored.filter((s) => s.d === 0);
  if (exact.length === 1) return { status: 'EXACT', client: exact[0].c };
  if (exact.length > 1) return { status: 'AMBIGUOUS', candidates: exact.map((s) => s.c) };

  const limit = maxTypos(key.length);
  const near = scored.filter((s) => s.d <= limit).sort((a, b) => a.d - b.d);
  if (near.length === 0) return { status: 'UNKNOWN' };
  // Two registry clients equally close means we cannot tell which was meant.
  if (near.length > 1 && near[1].d === near[0].d) return { status: 'AMBIGUOUS', candidates: near.filter((s) => s.d === near[0].d).map((s) => s.c) };
  return { status: 'CORRECTED', client: near[0].c, distance: near[0].d };
}
