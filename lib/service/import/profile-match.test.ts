import { describe, expect, it } from 'vitest';
import { matchProfile } from './profile-match';

const profiles = [
  { id: 'a', name: 'Ali Asger Bagichawal', aliases: ['Aliasger', 'Ali Asger', 'Ali Asger B'] },
  { id: 'b', name: 'Farida', aliases: ['Farida Dalal'] },
  { id: 'c', name: 'Sam', aliases: ['Sam Lee'] },
  { id: 'd', name: 'Sam Lee', aliases: [] },
];

describe('matchProfile', () => {
  it('matches the name or any alias, ignoring case and spacing', () => {
    expect(matchProfile('  ALI  asger ', profiles)).toBe('a');
    expect(matchProfile('Aliasger', profiles)).toBe('a');
    expect(matchProfile('farida dalal', profiles)).toBe('b');
  });
  it('does not guess from a partial name, and refuses an ambiguous one', () => {
    expect(matchProfile('Ali', profiles)).toBeNull();
    expect(matchProfile('Sam Lee', profiles)).toBeNull();
    expect(matchProfile(null, profiles)).toBeNull();
    expect(matchProfile('', profiles)).toBeNull();
  });
});
