import { describe, expect, it } from 'vitest';
import { filterPlanToDigitalMarketing } from './dm-filter';
import type { ImportPlan, PlannedEntry, PlannedMessage } from './plan';

const msg = (externalId: string, senderName: string): PlannedMessage => ({ spaceExternalId: 's', externalId, senderExternalId: senderName, senderName, postedAt: new Date(), text: '', kind: 'REPORT' } as unknown as PlannedMessage);
const entry = (messageExternalId: string, senderName: string, clientId: string | null, start: string | null = null): PlannedEntry => ({ spaceExternalId: 's', messageExternalId, startMessageExternalId: start, ordinal: 0, senderName, clientId } as unknown as PlannedEntry);
const plan = (messages: PlannedMessage[], entries: PlannedEntry[]): ImportPlan => ({ month: '2026-11', messages, entries, summary: { messages: messages.length, byKind: {}, entries: entries.length, byState: {}, flags: {} } });

describe('filterPlanToDigitalMarketing', () => {
  it('keeps a team member, and anyone else on a client the team has a project for, and drops the rest', () => {
    const p = plan(
      [msg('1', 'Himanshi Makheja'), msg('2', 'Someone Else'), msg('3', 'Other Person'), msg('4', 'Someone Else')],
      [entry('1', 'Himanshi Makheja', 'c9'), entry('2', 'Someone Else', 'c1'), entry('3', 'Other Person', 'c2'), entry('4', 'Someone Else', null)]
    );
    const out = filterPlanToDigitalMarketing(p, new Set(['c1']));
    expect(out.entries.map((e) => e.messageExternalId)).toEqual(['1', '2']);
    expect(out.messages.map((m) => m.externalId)).toEqual(['1', '2']);
    expect(out.summary.entries).toBe(2);
  });

  it('keeps the start message of a timer pair that is kept', () => {
    const p = plan([msg('on', 'Someone Else'), msg('off', 'Someone Else')], [entry('off', 'Someone Else', 'c1', 'on')]);
    expect(filterPlanToDigitalMarketing(p, new Set(['c1'])).messages.map((m) => m.externalId)).toEqual(['on', 'off']);
  });
});
