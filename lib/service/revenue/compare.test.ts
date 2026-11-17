import { describe, expect, it } from 'vitest';
import { compare, priceMinutes } from './compare';

const clients = [
  { id: 'eleanor', name: 'Eleanor Jenkins', aliases: [] },
  { id: 'janell', name: 'Janell Saverin', aliases: [] },
  { id: 'other', name: 'Not In Sheet', aliases: [] },
];

describe('priceMinutes', () => {
  it('uses the rate, else $15 for fixed, else nothing', () => {
    expect(priceMinutes(120, 'HOURLY', 1500)).toBe(3000);
    expect(priceMinutes(60, 'FIXED', null)).toBe(1500);
    expect(priceMinutes(60, 'HOURLY', null)).toBeNull();
  });
});

describe('compare', () => {
  const taken = [
    { month: '2026-08', clientName: 'Eleanor Jenkins', amountCents: 66000 },
    { month: '2026-08', clientName: 'Stranger', amountCents: 5000 },
    { month: '2026-01', clientName: 'Eleanor Jenkins', amountCents: 1000 },
  ];
  const hours = [
    { clientId: 'eleanor', month: '2026-08', minutes: 44 * 60, type: 'HOURLY' as const, rateCents: 1500 },
    { clientId: 'eleanor', month: '2026-09', minutes: 60, type: 'HOURLY' as const, rateCents: 1500 },
    { clientId: 'other', month: '2026-08', minutes: 600, type: 'HOURLY' as const, rateCents: 1500 },
    { clientId: 'eleanor', month: '2026-08', minutes: 60, type: 'HOURLY' as const, rateCents: null },
  ];
  const out = compare(taken, clients, hours, '2026-08', '2026-08');

  it('compares taken with hours x rate for a matched client, inside the range only', () => {
    expect(out.months).toHaveLength(1);
    expect(out.months[0]).toMatchObject({ month: '2026-08', takenCents: 66000, shouldCents: 66000, unpricedHours: 1, sheetOnlyCents: 5000 });
  });
  it('lists sheet clients that are not in the app apart, and ignores app clients the sheet does not have', () => {
    expect(out.sheetOnly).toEqual([{ name: 'Stranger', cents: 5000 }]);
    expect(out.clients.map((c) => c.clientId)).toEqual(['eleanor']);
  });
});
