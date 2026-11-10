// The Chat space where contract events are posted ("Accepted the contract of …", "Contract ended of …"). Pure parser.
import { describe, expect, it } from 'vitest';
import { canonicalBd, parseEvent } from './contract-events';
const at = '2026-09-17T08:00:00Z';

describe('contract event messages', () => {
  it('reads the amount when its word sits in another part, or a dash has no space before it', () => {
    expect(parseEvent('Accepted the project of Sunil Kumar Singh - Marketplace - Fixed - $500', at)).toMatchObject({ client: 'Sunil Kumar Singh', fixedDollars: 500, rateDollars: null });
    expect(parseEvent('Accepted the project of Harun Ketenci- Hassan- $10- Hourly - Shadab', at)).toMatchObject({ client: 'Harun Ketenci', profile: 'Hassan', rateDollars: 10 });
    expect(parseEvent('Accepted the project of Patricia Timmons - Zainab- $3000 - Hourly rate $15/hr', at)).toMatchObject({ rateDollars: 15 });
    expect(parseEvent('Accepted the contract of Kayo Wada - Taha - Fixed $100 - Hourly $20/hr - Ashfaque Sir', at)).toMatchObject({ rateDollars: 20 });
    // a bare amount with no Hourly/Fixed word is still not guessed
    expect(parseEvent('Accepted the project of Lorraine Curran - Batul - $1200 - WordPress', at)).toMatchObject({ rateDollars: null, fixedDollars: null });
  });
  it('reads an accepted hourly contract: client, profile and rate', () => {
    expect(parseEvent('Accepted the contract of Adina Las Vegas - Adnan - $10 Hourly - Aliasger Ezzi', at)).toMatchObject({ kind: 'ACCEPTED', client: 'Adina Las Vegas', profile: 'Adnan', rateDollars: 10, fixedDollars: null });
    expect(parseEvent('Accepted the project of Isabel East - Burhan - $20 - Hourly - Mohammad', at)).toMatchObject({ client: 'Isabel East', profile: 'Burhan' });
    expect(parseEvent('Accepted the project Aryk Grosz - Burhan - $10 per hour - Aliasger Ezzi', at)).toMatchObject({ client: 'Aryk Grosz', rateDollars: 10 });
    expect(parseEvent('Accepted the project of HI Beauty - Batul - $10/hr - Recurring', at)).toMatchObject({ client: 'HI Beauty', rateDollars: 10 });
    expect(parseEvent('Accepted the contract of Info OnlyGreens - Husian under Vowelweb - $300 - $15 Hourly - Ashfaq Sir', at)).toMatchObject({ client: 'Info OnlyGreens', rateDollars: 15 });
  });

  it('reads an accepted fixed-price contract, and does not guess a type from a bare amount', () => {
    expect(parseEvent('Accepted the contract of Dan Banks -Batul - $900 Fixed - Aliasger B', at)).toMatchObject({ client: 'Dan Banks', fixedDollars: 900, rateDollars: null });
    expect(parseEvent('Accepted the project of James Thompson - Ashfaque - $400 Fixed - Ashfaque Sir', at)).toMatchObject({ fixedDollars: 400 });
    expect(parseEvent('Accepted the project of Drop STore - Marketplace - $1100 - Aliasger', at)).toMatchObject({ rateDollars: null, fixedDollars: null });
  });

  it('reads an ended contract with its rating in every spelling', () => {
    expect(parseEvent('Contract ended of Yevhenii Sydorenko with 5-star ratings on Ashfaque', at)).toMatchObject({ kind: 'ENDED', client: 'Yevhenii Sydorenko', rating: 5, profile: 'Ashfaque' });
    expect(parseEvent('Contract ended of Luke Ward with 5 Star - Shraddha', at)).toMatchObject({ client: 'Luke Ward', rating: 5 });
    expect(parseEvent('Contract ended of James Gray with 4.7 Star - Shraddha', at)).toMatchObject({ client: 'James Gray', rating: 4.7 });
    expect(parseEvent('Contract ended of Asaf Rr with 1.9 star rating - Hasan | Harsha', at)).toMatchObject({ client: 'Asaf Rr', rating: 1.9 });
    expect(parseEvent('Contract ended of Basit Haider, with 5-star ratings on Ashfaque', at)).toMatchObject({ client: 'Basit Haider', rating: 5 });
  });

  it('uses the IST day of the message and ignores ordinary chat', () => {
    expect(parseEvent('Contract ended of Reza Farsani with 5-star ratings on Husain', '2026-10-26T20:00:00Z')!.date).toBe('2026-10-27'); // 01:30 IST next day
    expect(parseEvent('@Harsha Gongle please message the client about the bonus', at)).toBeNull();
    expect(parseEvent('Tomorrow meeting at 12.00', at)).toBeNull();
    expect(parseEvent('@BA team , I have accepted the offer of John-Paul Anderson --- Sonal Sir as you have told .', at)).toBeNull();
  });
});

describe('the business developer named at the end of an accepted message', () => {
  it('reads the BD, whichever way the name is written', () => {
    expect(parseEvent('Accepted the contract of Asam White - Burhan - $250 Fixed - Aliasger B', at)).toMatchObject({ bd: 'Aliasger B', recurring: false });
    expect(parseEvent('Accepted the contract of Adina Las Vegas - Adnan - $10 Hourly - Aliasger Ezzi', at)).toMatchObject({ bd: 'Aliasger' });
    expect(parseEvent('Accepted the project of James Thompson - Ashfaque - $400 Fixed - Ashfaque Sir', at)).toMatchObject({ bd: 'Ashfaque' });
    expect(parseEvent('Accepted the contract of MJ Lee - Zainab - $15 Hourly - Ashfaque sir (App)', at)).toMatchObject({ bd: 'Ashfaque' });
    expect(parseEvent('Accepted the contract of Tommy Hansen - Shraddha- $10/hour - 10 hours - Pranit', at)).toMatchObject({ bd: 'Pranit' });
    expect(parseEvent('Accepted the project of Yahya Alrayyes - Hasan - Fixed $10- Amreen', at)).toMatchObject({ bd: 'Amreen' });
  });

  it('gives a recurring contract no BD of its own, so it stays with the original BD', () => {
    expect(parseEvent('Accepted the contract of Alli Ramirez - Adnan (Themeshopy) - $15 Hourly - Recurring', at)).toMatchObject({ recurring: true, bd: null });
    expect(parseEvent('Accepted the project of HI Beauty - Batul - $10/hr - Recurring', at)).toMatchObject({ recurring: true, bd: null });
    expect(parseEvent('Accepted the contract of Dan Banks -Batul - $900 Fixed', at)).toMatchObject({ recurring: false, bd: null }); // no BD written
  });

  it('knows the spellings', () => {
    expect(canonicalBd('Aliasger')).toBe('Aliasger');
    expect(canonicalBd('Aliasgar Bagichawala')).toBe('Aliasger B');
    expect(canonicalBd('Mohammad')).toBe('Mohammed Taher');
    expect(canonicalBd('Recurring')).toBeNull();
    expect(canonicalBd('Themeshopy')).toBeNull();
  });
});
