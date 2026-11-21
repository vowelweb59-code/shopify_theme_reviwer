// Owner rules for the review queue (27 Oct 2026): only what a person can still decide waits for review. Pure planner, no database.
import { describe, expect, it } from 'vitest';
import { AUTO_IGNORED, planImport, type SpaceInput } from './plan';

const at = (wall: string) => new Date(new Date(`${wall}:00Z`).getTime() - 330 * 60_000).toISOString();
const clients = [{ id: 'acme', name: 'Acme Co' }, { id: 'yl', name: 'Yitzy Lazar' }, { id: 'kb', name: 'Kate Bell' }, { id: 'ch', name: 'CrawlHunt' }, { id: 'aj', name: 'Andrew Johnson' }];
let n = 0;
const msg = (wall: string, text: string) => ({ externalId: `m${++n}`, senderExternalId: 'u1', senderName: 'Anna', postedAt: at(wall), text });
const plan = (month: string, now: string, ...messages: ReturnType<typeof msg>[]) => {
  const spaces: SpaceInput[] = [{ externalId: 'spaces/master', name: 'Timer Status', type: 'TIMER_STATUS', messages }];
  return planImport({ month, spaces, clients, now: new Date(`${now}T12:00:00Z`) }).entries;
};
const report = (date: string | null, hours: string | null, client = 'Acme Co | Sam') =>
  `Daily Report${date ? ` – ${date}` : ''}\nClient: ${client}\n${hours ? `OFF Timer: ${hours} hrs\n` : ''}Memo: work`;

describe('review queue rules', () => {
  it('uses the posting day when no date is written, without asking anyone', () => {
    const [e] = plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', report(null, '02:00')));
    expect(e).toMatchObject({ entryDate: '2026-10-21', minutes: 120, state: 'PARSED' });
    expect(e!.notes).toContain('MISSING_DATE');
  });

  it('puts an impossible date (a typo far from the posting day) on the posting day', () => {
    const [e] = plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', report('21/10/2029', '02:00')));
    expect(e).toMatchObject({ entryDate: '2026-10-21', state: 'PARSED' });
    expect(e!.notes).toContain('DATE_CORRECTED_FROM_2029-10-21');
    // a few days off may be a late report: a person checks that
    const [late] = plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', report('15/10/2026', '02:00')));
    expect(late).toMatchObject({ entryDate: '2026-10-15', state: 'NEEDS_REVIEW' });
    expect(late!.flags).toContain('DATE_FAR_FROM_POST');
  });

  it('sets aside a report with no hours written', () => {
    const [e] = plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', report('21/10/2026', null)));
    expect(e).toMatchObject({ minutes: 0, state: 'REJECTED' });
    expect(e!.notes).toEqual(expect.arrayContaining(['NO_HOURS_WRITTEN', AUTO_IGNORED]));
  });

  it('keeps a recent question for a person, and accepts the same question as reported once it is months old', () => {
    const text = report('21/10/2026', '02:00', 'Nobody Known | Sam');
    const [recent] = plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', text));
    expect(recent).toMatchObject({ state: 'NEEDS_REVIEW', clientId: null });
    expect(recent!.flags).toContain('UNKNOWN_CLIENT');
    const [old] = plan('2026-10', '2027-06-01', msg('2026-10-21T19:00', text));
    expect(old).toMatchObject({ state: 'PARSED', clientId: null, minutes: 120 }); // still unmatched, can be matched later
    expect(old!.notes).toEqual(expect.arrayContaining(['UNKNOWN_CLIENT', 'OLD_ACCEPTED_AS_REPORTED']));
  });

  it('TIMER ON / OFF messages make no entry, old or recent, whatever their length (owner 2026-11-21: only the reports count)', () => {
    const timer = (wall: string, dir: string) => msg(wall, `Acme Co | Sam - TIMER ${dir}`);
    expect(plan('2026-03', '2026-10-27', timer('2026-03-02T10:00', 'ON'), timer('2026-03-04T18:00', 'OFF'))).toHaveLength(0);
    expect(plan('2026-10', '2026-10-27', timer('2026-10-26T18:00', 'OFF'))).toHaveLength(0);
    expect(plan('2026-09', '2026-10-27', timer('2026-09-18T10:00', 'ON'), timer('2026-09-23T07:56', 'OFF'))).toHaveLength(0);
  });

  it('finds the client named elsewhere in the line when the client field says none ("R | Yitzy Lazar | Adnan")', () => {
    const onReport = ['Daily Report – 26/10/2026', 'Client: R | Yitzy Lazar | Adnan', 'ON Timer: 02:30 hrs', 'Memo: work'].join('\n');
    const e = plan('2026-10', '2026-10-27', msg('2026-10-26T19:00', onReport))[0]!;
    expect(e).toMatchObject({ clientId: 'yl', minutes: 150, state: 'PARSED', profile: 'Adnan' });
    expect(e.flags).not.toContain('UNKNOWN_CLIENT');
    // a manual report whose client field is a tag, with the client named in the memo
    const memoReport = (memo: string) => `Daily Report – 21/10/2026
Client: R | Sam
OFF Timer: 02:00 hrs
Memo: ${memo}`;
    const [r] = plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', memoReport('Product pages for Kate Bell')));
    expect(r).toMatchObject({ clientId: 'kb', state: 'PARSED' });
    // two different clients in the line, or none: no guess
    const [two] = plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', memoReport('Kate Bell and Yitzy Lazar')));
    expect(two).toMatchObject({ clientId: null, state: 'NEEDS_REVIEW' });
    const [none] = plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', memoReport('nothing to see')));
    expect(none).toMatchObject({ clientId: null, state: 'NEEDS_REVIEW' });
  });

  it('reads a "Project:" line as the client, and a report with no client line takes the client named anywhere in it', () => {
    const [r] = plan('2026-10', '2026-10-27', msg('2026-10-26T19:00', 'Daily Report – 26/10/2026\nProject: CrawlHunt – Website SEO Crawler\nOFF-TIMER: 8:30hrs\nMemo: Implemented the bulk-fix workflow'));
    expect(r).toMatchObject({ clientId: 'ch', minutes: 510, state: 'PARSED' });
    const [m2] = plan('2026-10', '2026-10-27', msg('2026-10-26T19:00', 'Daily Report – 26/10/2026\nOFF Timer: 02:00 hrs\nMemo: Fixed the CrawlHunt crawler queue'));
    expect(m2).toMatchObject({ clientId: 'ch', state: 'PARSED' });
    expect(m2!.flags).not.toContain('MISSING_CLIENT');
  });

  it('reads a report whose client line has no label ("Andrew Johnson | AShfaque")', () => {
    const [r] = plan('2026-10', '2026-10-27', msg('2026-10-19T19:00', 'Date: 19/10/26\n\nAndrew Johnson | AShfaque\nOFF Timer: 2hrs\nMemo: Worked on creating industry pack products, adding details, documents, and metafields.'));
    expect(r).toMatchObject({ clientId: 'aj', minutes: 120, entryDate: '2026-10-19' });
  });

  it('a TIMER OFF posted together with a daily report makes no entry; the report is read', () => {
    const text = ['Pramesh Baskota | Ashfaque - Timer OFF', '=========', 'Daily Report – 17/10/2026', 'Client: Acme Co | Sam', 'OFF Timer: 02:00 hrs', 'Memo: work'].join('\n');
    const entries = plan('2026-10', '2026-10-27', msg('2026-10-17T19:00', text));
    expect(entries.map((x) => [x.source, x.minutes, x.state])).toEqual([['MANUAL_REPORT', 120, 'PARSED']]);
    expect(entries[0]).toMatchObject({ clientId: 'acme' });
  });

  it('a long timer plus a report: only the report counts', () => {
    const t = (wall: string, dir: string) => msg(wall, `Acme Co | Sam - TIMER ${dir}`);
    const report = ['Daily Report – 20/10/2026', 'Client: Acme Co | Sam', 'OFF Timer: 06:00 hrs', 'Memo: work'].join('\n');
    const entries = plan('2026-10', '2026-10-27', t('2026-10-20T09:00', 'ON'), t('2026-10-20T19:00', 'OFF'), msg('2026-10-20T20:00', report));
    expect(entries.map((x) => [x.source, x.minutes, x.state])).toEqual([['MANUAL_REPORT', 360, 'PARSED']]);
  });

  it('a client written by one word is the only client starting with it ("Bodog" is Bodog Olah)', () => {
    const r = ['Daily Report – 21/10/2026', 'Client: Kate | Taha', 'OFF Timer: 01:00 hrs', 'Memo: Worked on reviewing code.'].join('\n');
    expect(plan('2026-10', '2026-10-27', msg('2026-10-21T19:00', r))[0]).toMatchObject({ clientId: 'kb', state: 'PARSED' }); // Kate Bell
  });
});
