// The month plan end to end, without a database: classification, pairing, client matching, reconciliation, duplicates.
import { describe, expect, it } from 'vitest';
import { extractClient } from './client-field';
import { planImport, type RawChatMessage, type SpaceInput } from './plan';

const clients = ['Acme Co', 'Beta Ltd', 'Gamma Inc', 'Stacy King', 'Brian Denton', 'Hi Beauty'].map((name, i) => ({ id: `c${i}`, name }));
const id = (name: string) => clients.find((c) => c.name === name)!.id;

let n = 0;
/** IST wall time "YYYY-MM-DDTHH:mm" to a Chat createTime in UTC. */
const at = (wall: string) => new Date(new Date(`${wall}:00Z`).getTime() - 330 * 60_000).toISOString();
const m = (sender: string, wall: string, text: string): RawChatMessage => ({
  externalId: `msg${++n}`, senderExternalId: sender, senderName: `Person ${sender}`, postedAt: at(wall), text,
});
const master = (...messages: RawChatMessage[]): SpaceInput => ({ externalId: 'spaces/master', name: 'Timer Status', type: 'TIMER_STATUS', messages });
const plan = (...spaces: SpaceInput[]) => planImport({ month: '2026-10', spaces, clients });

describe('client field', () => {
  it.each([
    ['Acme Co | Sam', 'Acme Co', 'Sam'],
    ['R | Acme Co | Sam', 'Acme Co', 'Sam'],
    ['App | Acme Co | Sam', 'Acme Co', 'Sam'],
    ['Stacy King (Matthew Gerson)- Adnan', 'Stacy King', 'Adnan'],
    ['Brian Denton, Bridge Strategies | Rahul', 'Brian Denton', 'Rahul'],
    ['Acme Co - Taha', 'Acme Co', 'Taha'],
    ['Acme Co l Harsha', 'Acme Co', 'Harsha'],
    ['Acme Co | Sam | No Timer', 'Acme Co', 'Sam'],
    ['Acme Co', 'Acme Co', null],
    ['HI BEAUTY | Batul', 'Hi Beauty', 'Batul'],
  ])('%s', (raw, client, profile) => {
    const f = extractClient(raw, clients);
    expect(f.match.status === 'EXACT' && f.match.client.name).toBe(client);
    expect(f.profile).toBe(profile);
  });

  it('corrects a typo and leaves an unknown client unmatched', () => {
    expect(extractClient('Gama Inc | Sam', clients).match.status).toBe('CORRECTED');
    expect(extractClient('Nobody Special | Sam', clients)).toMatchObject({ match: { status: 'UNKNOWN' }, profile: 'Sam' });
  });
});

describe('month plan', () => {
  it('pairs ON/OFF into timer hours and compares the ON figure in the report', () => {
    const p = plan(master(
      m('s1', '2026-10-23T10:00', 'Acme Co | Sam - TIMER ON'),
      m('s1', '2026-10-23T13:00', 'Acme Co | Sam - TIMER OFF'),
      m('s1', '2026-10-23T19:00', 'Daily Report – 23/10/2026\nClient: Acme Co | Sam\nON Timer: 03:00 hrs\nOFF Timer: 01:00 hrs\nMemo: Work.'),
    ));
    const timer = p.entries.find((e) => e.source === 'TIMER_CALCULATED')!;
    const manual = p.entries.find((e) => e.source === 'MANUAL_REPORT')!;
    expect(timer).toMatchObject({ minutes: 180, clientId: id('Acme Co'), state: 'PARSED', entryDate: '2026-10-23', senderExternalId: 's1' });
    // owner rule: one day, both a timer and a report for the client: only the larger counts (timer 3h over the report's 1h)
    expect(manual).toMatchObject({ minutes: 60, reportedOnTimerMinutes: 180, reconciliation: 'MATCH', state: 'REJECTED' });
    expect(manual.notes).toContain('REPORT_SUPERSEDED_BY_TIMER');
  });

  it('counts the report instead of the timer when the report has more hours that day', () => {
    const p = plan(master(
      m('s9', '2026-10-23T10:00', 'Acme Co | Sam - TIMER ON'),
      m('s9', '2026-10-23T11:00', 'Acme Co | Sam - TIMER OFF'),
      m('s9', '2026-10-23T19:00', ['Daily Report – 23/10/2026', 'Client: Acme Co | Sam', 'OFF Timer: 04:00 hrs', 'Memo: Work.'].join('\n')),
    ));
    const timer = p.entries.find((e) => e.source === 'TIMER_CALCULATED' && e.senderExternalId === 's9')!;
    const manual = p.entries.find((e) => e.source === 'MANUAL_REPORT' && e.senderExternalId === 's9')!;
    expect(timer).toMatchObject({ minutes: 60, state: 'REJECTED' });
    expect(timer.notes).toContain('TIMER_SUPERSEDED_BY_REPORT');
    expect(manual).toMatchObject({ minutes: 240, state: 'PARSED' });
  });

  it('a mismatch keeps the timer value and notes it on both entries without sending them to review', () => {
    const p = plan(master(
      m('s2', '2026-10-23T11:00', 'Beta Ltd | Rahul - TIMER ON'),
      m('s2', '2026-10-23T12:00', 'Beta Ltd | Rahul - TIMER OFF'),
      m('s2', '2026-10-23T19:00', 'Daily Report – 23/10/2026\nClient: Beta Ltd | Rahul\nON Timer: 04:00 hrs\nMemo: x'),
    ));
    for (const e of p.entries) expect(e).toMatchObject({ flags: [], notes: expect.arrayContaining(['ON_TIMER_MISMATCH']) });
    expect(p.entries.find((e) => e.source === 'TIMER_CALCULATED')).toMatchObject({ minutes: 60, state: 'PARSED' });
    // the report gives only an ON figure, so it has no hours of its own to count (owner: stranded ON figure, set aside)
    expect(p.entries.find((e) => e.source === 'MANUAL_REPORT')).toMatchObject({ minutes: 0, state: 'REJECTED', notes: expect.arrayContaining(['NOTHING_TO_COUNT']) });
  });

  it('sets aside an ON with no OFF, and counts an ON figure that has no timer messages behind it as reported', () => {
    const p = plan(master(
      m('s3', '2026-10-23T09:00', 'Gamma Inc | Ali - TIMER ON'),
      m('s4', '2026-10-23T19:00', 'Daily Report – 23/10/2026\nClient: Beta Ltd | Rahul\nON Timer: 02:00 hrs\nMemo: x'),
    ));
    expect(p.entries.find((e) => e.senderExternalId === 's3')).toMatchObject({ minutes: 0, state: 'REJECTED', flags: expect.arrayContaining(['OPEN_INTERVAL']), notes: expect.arrayContaining(['AUTO_IGNORED']) });
    expect(p.entries.find((e) => e.senderExternalId === 's4')).toMatchObject({ reconciliation: 'NO_TIMER_DATA', minutes: 120, state: 'PARSED', notes: expect.arrayContaining(['ON_TIMER_NOT_FOUND', 'ON_TIMER_FROM_REPORT']) });
  });

  it('counts a report posted in both the master and the client space once', () => {
    const text = 'Daily Report – 23/10/2026\nClient: Acme Co | Sam\nOFF Timer: 02:00 hrs\nMemo: x';
    const p = plan(
      master(m('s1', '2026-10-23T19:00', text)),
      { externalId: 'spaces/acme', name: 'Acme', type: 'CLIENT_PROJECT', clientId: id('Acme Co'), messages: [m('s1', '2026-10-23T19:01', text)] },
    );
    const manual = p.entries.filter((e) => e.source === 'MANUAL_REPORT');
    expect(manual.map((e) => e.state).sort()).toEqual(['PARSED', 'REJECTED']);
    expect(manual.find((e) => e.state === 'REJECTED')!.notes).toContain('DUPLICATE_POST');
  });

  it('auto-corrects a client typo without sending it to review; unknown clients go to review', () => {
    const p = plan(master(
      m('s4', '2026-10-23T19:00', 'Daily Report – 23/10/2026\nClient: Gama Inc | Ali\nOFF Timer: 07.00 hrs\nMemo: x'),
      m('s4', '2026-10-23T19:01', 'Daily Report – 23/10/2026\nClient: Someone New | Ali\nOFF Timer: 01:00 hrs\nMemo: y'),
    ));
    const [typo, unknown] = p.entries;
    expect(typo).toMatchObject({ clientId: id('Gamma Inc'), minutes: 420, state: 'PARSED', notes: ['CLIENT_NAME_CORRECTED'] });
    expect(unknown).toMatchObject({ clientId: null, state: 'NEEDS_REVIEW', flags: ['UNKNOWN_CLIENT'] });
  });

  it('marks a report posted after Monday 17:30 IST as late, and ignores other months', () => {
    const p = plan(master(
      m('s1', '2026-10-27T10:00', 'Daily Report – 23/10/2026\nClient: Acme Co | Sam\nOFF Timer: 01:00 hrs\nMemo: x'),
      m('s1', '2026-10-26T17:00', 'Daily Report – 22/10/2026\nClient: Acme Co | Sam\nOFF Timer: 01:00 hrs\nMemo: x'),
      m('s1', '2026-11-02T10:00', 'Daily Report – 02/11/2026\nClient: Acme Co | Sam\nOFF Timer: 01:00 hrs\nMemo: x'),
    ));
    expect(p.entries.map((e) => [e.entryDate, e.isLate])).toEqual([['2026-10-22', false], ['2026-10-23', true]]);
    expect(p.summary.messages).toBe(2);
  });

  it('flags a date a few days from the posting day; several different reports for one client and day all count', () => {
    const p = plan(master(
      m('s1', '2026-10-23T19:00', 'Daily Report – 23/09/2026\nClient: Acme Co | Sam\nOFF Timer: 01:00 hrs\nMemo: x'),
      m('s2', '2026-10-23T19:00', 'Daily Report – 23/10/2026\nClient: Beta Ltd | Sam\nOFF Timer: 01:30 hr\nMemo: a\n\nClient: Beta Ltd | Sam\nOFF Timer: 01:00 hr\nMemo: b'),
    ));
    expect(p.entries.find((e) => e.senderExternalId === 's1')!.flags).toContain('DATE_FAR_FROM_POST');
    const s2 = p.entries.filter((e) => e.senderExternalId === 's2');
    expect(s2).toHaveLength(2);
    expect(s2.every((e) => e.state === 'PARSED' && !e.flags.includes('MULTIPLE_REPORTS_SAME_DAY') && e.notes.includes('MULTIPLE_REPORTS_SAME_DAY'))).toBe(true); // a note, not a question
  });

  it('a resent report with the same memo and other hours replaces the earlier one', () => {
    const body = (hours: string) => `Daily Report – 23/10/2026\nClient: Acme Co | Sam\nOFF Timer: ${hours} hrs\nMemo: Updated the product pages and fixed the cart bug`;
    const p = plan(master(m('s3', '2026-10-23T18:00', body('01:00')), m('s3', '2026-10-23T19:00', body('02:00'))));
    const [first, second] = p.entries.filter((e) => e.senderExternalId === 's3');
    expect(first).toMatchObject({ minutes: 60, state: 'REJECTED' });
    expect(first!.notes).toContain('SUPERSEDED_BY_RESEND');
    expect(second).toMatchObject({ minutes: 120, state: 'PARSED' });
  });

  it('a timer line and its report in one message give a timer entry and a manual entry from the same message', () => {
    const p = plan(master(
      m('s1', '2026-10-23T09:00', 'Acme Co | Sam - TIMER ON'),
      m('s1', '2026-10-23T17:00', 'Acme Co | Sam - TIMER OFF\n\nDate:- 23-10-2026\nClient Name:- App | Acme Co | Sam\nOn timer:- 08:00 hrs\nMemo: x'),
    ));
    expect(p.summary.byKind).toMatchObject({ TIMER: 1, TIMER_AND_REPORT: 1 });
    expect(p.entries.map((e) => [e.source, e.minutes, e.reconciliation])).toEqual([['TIMER_CALCULATED', 480, null], ['MANUAL_REPORT', 0, 'MATCH']]);
  });

  it('is deterministic: planning the same messages twice gives the same plan', () => {
    const msgs = [m('s1', '2026-10-23T10:00', 'Acme Co | Sam - TIMER ON'), m('s1', '2026-10-23T11:00', 'Acme Co | Sam - TIMER OFF')];
    expect(plan(master(...msgs))).toEqual(plan(master(...msgs)));
  });
});
