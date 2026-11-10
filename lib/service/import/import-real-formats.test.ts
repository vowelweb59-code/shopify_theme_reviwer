// Formats seen in the real October 2026 export, with names replaced. Each case is one thing people actually type.
import { describe, expect, it } from 'vitest';
import { classifyMessage } from './classify';
import { parseManualReport } from './manual-report';
import { parseDuration } from './text';

const msg = (text: string) => ({ id: 'm1', senderId: 's1', createTime: '2026-10-23T12:00:00Z', text });
const one = (text: string) => {
  const r = parseManualReport(text);
  expect(r).toHaveLength(1);
  return r[0];
};

describe('duration styles', () => {
  it.each([
    ['08:30 hrs', 510], ['2:10:hr', 130], ['00:40 min', 40], ['40:min', 40], ['40 min', 40], ['0:45 min', 45],
    ['8 hours 30 minutes', 510], ['5 hrs 10 mins', 310], ['4 hrs 28 mins', 268], ['7 hours', 420],
    ['03:10 Hs', 190], ['9:00 Hours', 540], ['0:00 Hour', 0], ['07.00 hrs', 420], ['1:00 Hrs', 60],
  ])('%s = %i minutes', (raw, minutes) => {
    expect(parseDuration(raw)).toEqual({ minutes });
  });

  it('reads 2.30 as 2h30m (HH.MM, owner-confirmed); one-digit or 60+ fractions are decimal hours', () => {
    expect(parseDuration('2.30 hrs')).toEqual({ minutes: 150 });
    expect(parseDuration('8.30 hrs')).toEqual({ minutes: 510 });
    expect(parseDuration('7.5 hrs')).toEqual({ minutes: 450 });
    expect(parseDuration('2.75 hrs')).toEqual({ minutes: 165 });
  });
});

describe('report headers and labels', () => {
  it('Timer Report with a bracketed date and "Client:" blocks', () => {
    const r = parseManualReport(`==========
Timer Report (23-10-2026)

Client: R | Shop One | Ana
Memo: Updated metafields.
OFF-Timer: 2:10:hr
------------------------
Client: R | Shop Two |  Ben
Memo: Worked on swatches.
OFF-Timer: 2:10:hr
==========`);
    expect(r.map((e) => [e.date, e.minutes, e.state])).toEqual([['2026-10-23', 130, 'PARSED'], ['2026-10-23', 130, 'PARSED']]);
    expect(r[0].memo).toBe('Updated metafields.'); // decoration lines are not memo text
  });

  it('"Date:-" and "Client Name:-" with two-digit year', () => {
    const e = one('Date:- 23-10-26\nClient Name:- App | Acme | Sam\nOn timer:- 07:50 hrs\nMemo: Dashboard work.');
    expect(e).toMatchObject({ date: '2026-10-23', client: 'App | Acme | Sam', minutes: null, reportedOnTimerMinutes: 470, state: 'PARSED' });
  });

  it('"Project Name" is a client label; hyphen inside the timer label; no separator before the time', () => {
    const e = one('Date :- 23/10/2026\nProject Name :- Crawl Tool\nOff Timer :- 8 hours 30 minutes\nMemo :- Fixes.');
    expect(e).toMatchObject({ client: 'Crawl Tool', minutes: 510 });
    expect(one('Date: 23/10/2026\nClient: A | B\nOff Timer 1:00 hr\nMemo: x').minutes).toBe(60);
    expect(one('Date: 23/10/2026\nClient: A | B\nON -TIMER: 03:00 hr\nMemo: x').reportedOnTimerMinutes).toBe(180);
    expect(one('Daily Report – 23/10/2026\nClient: A | B\nOFF-Timer – 01:00 hrs\nMemo: x').minutes).toBe(60);
  });

  it('a Date line before each client starts a new block', () => {
    const r = parseManualReport(`Date: 23/10/2026
Client: Alpha | Sam
Off Timer 1:00 hr
Memo: one
--------------------
Date: 23-10-2026
Client:  Beta | Ali
Memo: two
ON Timer: 4:10 Hr`);
    expect(r).toHaveLength(2);
    expect(r[1]).toMatchObject({ client: 'Beta | Ali', minutes: null, reportedOnTimerMinutes: 250, state: 'PARSED' });
  });

  it('"No Timer" is stripped from the client; ON and OFF can both appear', () => {
    expect(one('Daily Report – 23/10/2026\nClient: Tim Fitz | Adnan | No Timer\nMemo: x\nOFF-Timer: 1:00 Hrs').client).toBe('Tim Fitz | Adnan');
    const e = one('Date: 24/10/2026\nClient: A | B\nON Timer: 02:20 Hs\nOFF Timer: 00:00 Hrs\nMemo: x');
    expect(e).toMatchObject({ minutes: 0, reportedOnTimerMinutes: 140, state: 'PARSED' }); // zero OFF beside ON hours is fine
  });

  it('a wrapped memo keeps its lines; a missing date is flagged, not guessed', () => {
    const e = one('Timer Report\nClient: A | B\nMemo: Working on template and page\ndevelopment\nON Timer: 03:10 Hs\nOFF Timer: 04:30 Hrs');
    expect(e.memo).toBe('Working on template and page\ndevelopment');
    expect(e.flags).toContain('MISSING_DATE');
  });

  it('a bare zero OFF timer with no ON hours is still flagged', () => {
    expect(one('Date: 23/10/2026\nClient: A | B\nOFF Timer: 0:00\nMemo: x').flags).toContain('SUSPICIOUS_DURATION');
  });
});

describe('message classification', () => {
  it('a plain timer line', () => {
    const c = classifyMessage(msg('Dan Roe | Moe - TIMER ON'));
    expect(c.kind).toBe('TIMER');
    expect(c.timer).toMatchObject({ kind: 'EVENT', event: { direction: 'ON', client: 'Dan Roe', profile: 'Moe' } });
  });

  it('timer lines without a pipe', () => {
    const a = classifyMessage(msg('Pat Lee - Ash - TIMER ON'));
    expect(a.timer).toMatchObject({ kind: 'EVENT', event: { client: 'Pat Lee', profile: 'Ash' } });
    const b = classifyMessage(msg('Stacy King (Matthew Gerson)- Adnan - Timer OFF'));
    expect(b.timer).toMatchObject({ kind: 'EVENT', event: { direction: 'OFF', client: 'Stacy King (Matthew Gerson)', profile: 'Adnan' } });
  });

  it('a timer line followed by the same person\'s report in one message', () => {
    const c = classifyMessage(msg('Thani A | Sam - TIMER OFF\n\nDate:- 23-10-2026\nClient Name:- App | Thani A | Sam\nOn timer:- 07:50 hrs\nMemo: Export work.'));
    expect(c.kind).toBe('TIMER_AND_REPORT');
    expect(c.reports[0]).toMatchObject({ date: '2026-10-23', reportedOnTimerMinutes: 470 });
  });

  it('a timer line, a rule line, then a Timer Report', () => {
    const c = classifyMessage(msg('Dan S | Moe - TIMER OFF\n\n==========\n\nTimer Report:- (24-10-2026)\n\nClient Name:- Dan S - Moe\nON Timer:- 07:20 hrs\nOFF Timer:- 00:30 hrs\nMemo:- Page design.'));
    expect(c.kind).toBe('TIMER_AND_REPORT');
    expect(c.reports[0]).toMatchObject({ minutes: 30, reportedOnTimerMinutes: 440, state: 'PARSED' });
  });

  it('chatter and stray punctuation are ignored; a report is not mistaken for a timer line', () => {
    expect(classifyMessage(msg('.')).kind).toBe('IGNORED');
    expect(classifyMessage(msg('thanks, will check')).kind).toBe('IGNORED');
    expect(classifyMessage(msg('Daily Report – 24/10/2026\nClient –Pat O\'Neil\nOFF Timer – 08:30 hrs\nMemo – Deployed.')).kind).toBe('MANUAL_REPORT');
  });

  it('a malformed timer line is flagged for a human', () => {
    expect(classifyMessage(msg('Dan Roe | Moe - TIMER maybe')).kind).toBe('UNRECOGNIZED');
  });
});

describe('client lines without a label, and a date written after the client', () => {
  it('reads two blocks whose client lines have no "Client:" ("Andrew Johnson | AShfaque")', () => {
    const r = parseManualReport(['================================', 'Date: 16/10/26', 'Gary Mcnelley (Revitol) - Farida', 'OFF Timer: 5hrs', 'Memo:Worked on the Revitol homepage ', 'design and development.', '', 'Andrew Johnson | AShfaque', 'OFF Timer: 3hrs', 'Memo:Working on new docoments update', '================================'].join('\n'));
    expect(r.map((e) => [e.client, e.minutes, e.date])).toEqual([['Gary Mcnelley (Revitol) - Farida', 300, '2026-10-16'], ['Andrew Johnson | AShfaque', 180, '2026-10-16']]);
    expect(r[0]!.memo).toContain('design and development');
  });

  it('keeps the client when the date comes after it ("Client: Tim Fitz | Adnan | No Timer" then "Date:")', () => {
    const e = one(['Client: Tim Fitz | Adnan | No Timer', 'Date: 16/10/2026', 'Memo: Worked on Product Sibling Setup, Product Linking & Variant Synchronization.', 'OFF-Timer: 1.30 Hrs'].join('\n'));
    expect(e).toMatchObject({ client: 'Tim Fitz | Adnan', date: '2026-10-16' });
    expect(e.minutes).toBeGreaterThan(0);
    expect(e.flags).not.toContain('MISSING_CLIENT');
  });

  it('a memo line that wraps before its OFF line stays memo text', () => {
    const e = one(['Date: 16/10/2026', 'Client: Acme Co | Sam', 'Memo: Fixed the header', 'layout - spacing | colours', 'OFF Timer: 2 hrs'].join('\n'));
    expect(e).toMatchObject({ client: 'Acme Co | Sam', minutes: 120 });
    expect(e.memo).toContain('layout - spacing');
  });
});
