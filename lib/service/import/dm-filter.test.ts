import { describe, expect, it } from 'vitest';
import { filterPlanToDigitalMarketing, type DmProject } from './dm-filter';
import type { ImportPlan, PlannedEntry, PlannedMessage } from './plan';

const msg = (externalId: string, senderName: string): PlannedMessage => ({ spaceExternalId: 's', externalId, senderExternalId: senderName, senderName, postedAt: new Date(), text: '', kind: 'REPORT' } as unknown as PlannedMessage);
const entry = (messageExternalId: string, senderName: string, clientId: string | null, clientRaw = '', start: string | null = null): PlannedEntry =>
  ({ spaceExternalId: 's', messageExternalId, startMessageExternalId: start, ordinal: 0, senderName, clientId, clientRaw } as unknown as PlannedEntry);
const plan = (messages: PlannedMessage[], entries: PlannedEntry[]): ImportPlan => ({ month: '2026-11', messages, entries, summary: { messages: messages.length, byKind: {}, entries: entries.length, byState: {}, flags: {} } });

// Andrew Johnson has two projects; only the marketing one is the team's, so only it exists here.
const marketing: DmProject = { id: 'p-marketing', clientId: 'andrew', clientNames: ['Andrew Johnson'], keywords: ['Andrew Johnson', 'Marketing'], teamNames: ['Himanshi Makheja', 'Ravi Kumar'] };

describe('filterPlanToDigitalMarketing', () => {
  it('keeps every entry of a team member, unchanged', () => {
    const out = filterPlanToDigitalMarketing(plan([msg('1', 'Himanshi Makheja')], [entry('1', 'Himanshi Makheja', null)]), [marketing]);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0]!.projectId).toBeUndefined();
  });

  it('keeps an outsider on the team project and writes the project on the entry', () => {
    const out = filterPlanToDigitalMarketing(plan([msg('1', 'Ravi Kumar')], [entry('1', 'Ravi Kumar', 'andrew', 'Andrew Johnson')]), [marketing]);
    expect(out.entries.map((e) => e.projectId)).toEqual(['p-marketing']);
  });

  it('keeps an outsider who names the team project, even if not on its team', () => {
    const out = filterPlanToDigitalMarketing(plan([msg('1', 'Neil Shah')], [entry('1', 'Neil Shah', 'andrew', 'Andrew Johnson | Marketing')]), [marketing]);
    expect(out.entries.map((e) => e.projectId)).toEqual(['p-marketing']);
  });

  it("drops an outsider's hours on the client's other project (only the client's name written, not on the team)", () => {
    const out = filterPlanToDigitalMarketing(plan([msg('1', 'Neil Shah')], [entry('1', 'Neil Shah', 'andrew', 'Andrew Johnson HR website')]), [marketing]);
    expect(out.entries).toHaveLength(0);
    expect(out.messages).toHaveLength(0);
  });

  it('drops an outsider on a client the team has no project with, or with no client', () => {
    const out = filterPlanToDigitalMarketing(plan([msg('1', 'Ravi Kumar'), msg('2', 'Ravi Kumar')], [entry('1', 'Ravi Kumar', 'other'), entry('2', 'Ravi Kumar', null)]), [marketing]);
    expect(out.entries).toHaveLength(0);
  });

  it("identifies an outsider's unmatched client among the clients they are on, and keeps the entry", () => {
    const tim: DmProject = { id: 'p-tim', clientId: 'tim', clientNames: ['Tim Fitz'], keywords: ['Tim Fitz'], teamNames: ['Shefali Shrivastava', 'Hamza Jawadwala'] };
    const flagged = (e: PlannedEntry): PlannedEntry => ({ ...e, flags: ['UNKNOWN_CLIENT'], state: 'NEEDS_REVIEW' } as PlannedEntry);
    const out = filterPlanToDigitalMarketing(plan([msg('1', 'Shefali Shrivastava')], [flagged(entry('1', 'Shefali Shrivastava', null, 'Tim Fitzz | Adnan'))]), [tim, marketing]);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0]).toMatchObject({ clientId: 'tim', projectId: 'p-tim', state: 'PARSED', flags: [] });
  });

  it('still drops an outsider whose unmatched client is not one of the clients they are on', () => {
    const tim: DmProject = { id: 'p-tim', clientId: 'tim', clientNames: ['Tim Fitz'], keywords: ['Tim Fitz'], teamNames: ['Shefali Shrivastava'] };
    const out = filterPlanToDigitalMarketing(plan([msg('1', 'Shefali Shrivastava'), msg('2', 'Neil Shah')], [entry('1', 'Shefali Shrivastava', null, 'Jessica Gatt | Shraddha'), entry('2', 'Neil Shah', null, 'Tim Fitz | Adnan')]), [tim]);
    expect(out.entries).toHaveLength(0);
  });

  it('keeps an outsider on several team projects of the client, with no project written', () => {
    const second: DmProject = { ...marketing, id: 'p-second', keywords: ['Andrew Johnson', 'Ads'] };
    const out = filterPlanToDigitalMarketing(plan([msg('1', 'Ravi Kumar')], [entry('1', 'Ravi Kumar', 'andrew', 'Andrew Johnson')]), [marketing, second]);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0]!.projectId).toBeUndefined();
  });

  it('keeps the start message of a timer pair that is kept', () => {
    const p = plan([msg('on', 'Ravi Kumar'), msg('off', 'Ravi Kumar')], [entry('off', 'Ravi Kumar', 'andrew', 'Andrew Johnson', 'on')]);
    expect(filterPlanToDigitalMarketing(p, [marketing]).messages.map((m) => m.externalId)).toEqual(['on', 'off']);
  });
});
