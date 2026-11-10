import { describe, it, expect } from 'vitest';
import { validateTransition } from './transitions';
import { computeHash, verifyChain, GENESIS_HASH, type AuditEntry } from '../audit/hash-chain';

describe('project transitions', () => {
  it('allows valid and rejects invalid moves', () => {
    expect(validateTransition('NOT_STARTED', 'ACTIVE').ok).toBe(true);
    expect(validateTransition('NOT_STARTED', 'COMPLETED').ok).toBe(false);
    expect(validateTransition('ARCHIVED', 'ACTIVE').ok).toBe(false);
  });
  it('reopening a completed project needs a reason', () => {
    expect(validateTransition('COMPLETED', 'ACTIVE').ok).toBe(false);
    expect(validateTransition('COMPLETED', 'ACTIVE', 'client asked for changes').ok).toBe(true);
  });
});

function build(entries: AuditEntry[]) {
  let prev = GENESIS_HASH;
  return entries.map((e) => {
    const hash = computeHash(prev, e);
    const row = { ...e, prevHash: prev, hash };
    prev = hash;
    return row;
  });
}
const e = (action: string, detail: Record<string, unknown> = {}): AuditEntry => ({ actorId: 'u1', action, detail, at: '2026-10-24T00:00:00.000Z' });

describe('audit hash chain', () => {
  it('verifies an intact chain', () => expect(verifyChain(build([e('a'), e('b'), e('c')]))).toBe(-1));
  it('detects a modified row', () => {
    const rows = build([e('a'), e('b', { x: 1 }), e('c')]);
    rows[1].detail = { x: 2 };
    expect(verifyChain(rows)).toBe(1);
  });
  it('detects a deleted row', () => {
    const rows = build([e('a'), e('b'), e('c')]);
    rows.splice(1, 1);
    expect(verifyChain(rows)).toBe(1);
  });
  it('is independent of object key order', () => {
    expect(computeHash(GENESIS_HASH, e('a', { a: 1, b: 2 }))).toBe(computeHash(GENESIS_HASH, e('a', { b: 2, a: 1 })));
  });
});
