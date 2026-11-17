import { describe, expect, it } from 'vitest';
import { matchClient, normName } from './match';

const clients = [
  { id: 'william', names: ['William Poon'] },
  { id: 'julica', names: ['Julica Ortlinghaus'] },
  { id: 'david-blair', names: ['David Blair'] },
  { id: 'david-blum', names: ['David Blum'] },
  { id: 'ateeq', names: ['Ateeq Chowdhrie', 'Ateeq Chaowdhary'] },
];

describe('matchClient', () => {
  it('ignores brackets, accents and case', () => {
    expect(normName('Julica O (Dressed To Inspire SL)')).toBe('julica o');
    expect(matchClient('ATEEQ CHOWDHRIE (CurvyFashionPlaza)', clients)).toEqual({ clientId: 'ateeq', how: 'exact' });
  });
  it('matches an alias', () => expect(matchClient('Ateeq Chaowdhary', clients).clientId).toBe('ateeq'));
  it('reads a last-name initial', () => {
    expect(matchClient('William P', clients)).toEqual({ clientId: 'william', how: 'fuzzy' });
    expect(matchClient('Julica O (Dressed To Inspire SL)', clients)).toEqual({ clientId: 'julica', how: 'fuzzy' });
  });
  it('reads a short first name', () => {
    expect(matchClient('Saleem Joya', [{ id: 'sal', names: ['Sal Joya'] }, { id: 'x', names: ['Sam Poon'] }])).toEqual({ clientId: 'sal', how: 'fuzzy' });
  });
  it('does not guess between two people', () => expect(matchClient('David B', clients)).toEqual({ clientId: null, how: 'ambiguous' }));
  it('finds nothing for an unknown name', () => expect(matchClient('Nobody Known', clients)).toEqual({ clientId: null, how: 'none' }));
});
