import { describe, expect, it } from 'vitest';
import { matchSenderToUser } from './sender-match';

const users = [
  { id: 'a', displayName: 'Huzefa Kapadia', active: true },
  { id: 'b', displayName: 'Husain Khanbahadur', active: true },
  { id: 'c', displayName: 'Old Person', active: false },
  { id: 'd1', displayName: 'Sam Lee', active: true },
  { id: 'd2', displayName: 'sam  lee', active: true },
];

describe('matchSenderToUser', () => {
  it('matches the full name ignoring case, spacing and punctuation', () => {
    expect(matchSenderToUser('  HUZEFA   kapadia ', users)).toBe('a');
    expect(matchSenderToUser('Husain Khanbahadur.', users)).toBe('b');
  });
  it('does not guess from a first name, a partial name or an inactive user', () => {
    expect(matchSenderToUser('Huzefa', users)).toBeNull();
    expect(matchSenderToUser('Husain K', users)).toBeNull();
    expect(matchSenderToUser('Old Person', users)).toBeNull();
    expect(matchSenderToUser('', users)).toBeNull();
  });
  it('refuses when two users share the name', () => {
    expect(matchSenderToUser('Sam Lee', users)).toBeNull();
  });
});
