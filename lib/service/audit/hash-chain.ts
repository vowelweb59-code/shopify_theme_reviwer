import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

export interface AuditEntry {
  actorId: string | null;
  action: string;
  detail: Record<string, unknown>;
  at: string; // ISO timestamp
}

// Deterministic JSON: object keys sorted recursively so the hash is stable.
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export function computeHash(prevHash: string, e: AuditEntry): string {
  return createHash('sha256').update(prevHash).update('|').update(canonical(e)).digest('hex');
}

/** Returns the index of the first broken row, or -1 if the chain is intact. */
export function verifyChain(rows: Array<AuditEntry & { prevHash: string; hash: string }>): number {
  let prev = GENESIS_HASH;
  for (let i = 0; i < rows.length; i++) {
    const { prevHash, hash, ...entry } = rows[i];
    if (prevHash !== prev || computeHash(prev, entry) !== hash) return i;
    prev = hash;
  }
  return -1;
}
