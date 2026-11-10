import { describe, expect, it } from 'vitest';
import { clientRegistry } from './client-registry';
import { extractClient, suggestClientName } from './client-field';

const known = clientRegistry([{ id: 'k', name: 'Keziah Gutierrez', aliases: ['Keziah', 'Keziah Gutierezz'] }, { id: 'e', name: 'Eleanor Jenkins', aliases: ['EleanorJenkins', 'Eleanor Jenkin'] }]);

describe('aliases', () => {
  it('resolve to the same client, and two spellings in one field are not ambiguous', () => {
    for (const raw of ['Keziah | Sam', 'Keziah Gutierezz - Sam', 'APP | Keziah Gutierrez | Aliasger Ezzi', 'EleanorJenkins | Adnan', 'R | Eleanor Jenkin | Adnan']) {
      expect(extractClient(raw, known).match.status, raw).toBe('EXACT');
    }
    expect(extractClient('Keziah Gutierrez (Keziah) | Sam', known).match).toMatchObject({ status: 'EXACT', client: { id: 'k' } });
  });
});

describe('suggestClientName', () => {
  it('drops a Client label written before the name', () => {
    expect(suggestClientName('Client:- Cass Cooper')).toBe('Cass Cooper');
    expect(suggestClientName('Client: Pablo Mora | Taha')).toBe('Pablo Mora');
    expect(suggestClientName('Client Name:- Joanna Filipowska')).toBe('Joanna Filipowska');
    expect(suggestClientName('Client : Nick Dooley')).toBe('Nick Dooley');
    expect(suggestClientName('Client Services Ltd | Adnan')).toBe('Client Services Ltd'); // a name that merely starts with the word
  });
  it('takes the first real part of the field', () => {
    expect(suggestClientName('Chris Crouch | Burhan')).toBe('Chris Crouch');
    expect(suggestClientName('Eason James - (Mohammed)')).toBe('Eason James');
    expect(suggestClientName('App | Morten App | Vowelweb (Direct)')).toBe('Morten App');
    expect(suggestClientName('HeadsetGallery x Shopify')).toBe('HeadsetGallery x Shopify');
  });
  it('offers nothing for filler', () => {
    for (const raw of ['', 'R', 'Unknown', 'In-house', 'no timer']) expect(suggestClientName(raw), raw).toBeNull();
  });
});
