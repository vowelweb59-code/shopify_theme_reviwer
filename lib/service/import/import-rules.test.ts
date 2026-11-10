// Owner rules from 2026-10-26: client auto-detect, Monday weeks with a Monday 17:30 IST cutoff,
// manual-vs-timer reconciliation, Upwork-style weekly figures. Pure logic, no database.
import { describe, expect, it } from 'vitest';
import { resolveClient } from './client-match';
import { DEFAULT_TOLERANCE_MINUTES, reconcileOnTimer } from './reconcile';
import { isLateReport, reportingDeadline, weekOf, weekStatus } from './week';
import { weeklyHours, type HourEntry } from './weekly-hours';

const clients = [
  { id: '1', name: 'Dan Staggs' },
  { id: '2', name: "Patrick O'Donnell" },
  { id: '3', name: 'Thani Almheiri' },
];

describe('client auto-detect', () => {
  it('matches exactly regardless of case and punctuation', () => {
    expect(resolveClient("patrick  o donnell", clients)).toMatchObject({ status: 'EXACT', client: { id: '2' } });
  });
  it('corrects typos automatically', () => {
    expect(resolveClient('Dan Stags', clients)).toMatchObject({ status: 'CORRECTED', client: { id: '1' }, distance: 1 });
    expect(resolveClient('Thani Almhieri', clients)).toMatchObject({ status: 'CORRECTED', client: { id: '3' } });
  });
  it('does not invent a match for an unknown client', () => {
    expect(resolveClient('Someone Else', clients)).toEqual({ status: 'UNKNOWN' });
    expect(resolveClient('', clients)).toEqual({ status: 'UNKNOWN' });
  });
  it('reports ambiguity instead of picking one, and never autocorrects very short names', () => {
    const twins = [{ id: 'a', name: 'Dan Staggs' }, { id: 'b', name: 'Dan Staggz' }];
    expect(resolveClient('Dan Stagg', twins).status).toBe('AMBIGUOUS');
    expect(resolveClient('Al', [{ id: 'x', name: 'Ali' }])).toEqual({ status: 'UNKNOWN' });
  });
});

describe('reporting weeks (Monday start, report cutoff Monday 17:30 IST)', () => {
  it('finds the Monday-to-Sunday week and treats Saturday and Sunday as part of it', () => {
    expect(weekOf('2026-10-26')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(weekOf('2026-10-24')).toEqual({ start: '2026-10-19', end: '2026-10-25' }); // Saturday
    expect(weekOf('2026-10-25')).toEqual({ start: '2026-10-19', end: '2026-10-25' }); // Sunday
  });
  it('crosses month and year boundaries', () => {
    expect(weekOf('2026-12-31')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
  it('puts the deadline at Monday 17:30 IST after the week ends', () => {
    expect(reportingDeadline(weekOf('2026-10-24')).toISOString()).toBe('2026-10-26T12:00:00.000Z');
  });
  it('moves through CURRENT, GRACE and CLOSED around the cutoff', () => {
    const w = weekOf('2026-10-24');
    const at = (iso: string) => new Date(iso);
    expect(weekStatus(w, at('2026-10-18T12:00:00Z'))).toBe('FUTURE');
    expect(weekStatus(w, at('2026-10-22T05:00:00Z'))).toBe('CURRENT');
    expect(weekStatus(w, at('2026-10-26T11:59:00Z'))).toBe('GRACE'); // Monday 17:29 IST
    expect(weekStatus(w, at('2026-10-26T12:00:00Z'))).toBe('GRACE'); // exactly 17:30 IST is still accepted
    expect(weekStatus(w, at('2026-10-26T12:00:01Z'))).toBe('CLOSED');
  });
  it('flags a report posted after its week closed as late', () => {
    expect(isLateReport('2026-10-24', new Date('2026-10-26T11:00:00Z'))).toBe(false);
    expect(isLateReport('2026-10-24', new Date('2026-10-26T13:00:00Z'))).toBe(true);
  });
});

describe('manual vs timer reconciliation (ON-timer hours)', () => {
  it('confirms when the report agrees with the timer within tolerance', () => {
    expect(reconcileOnTimer(180, 190)).toMatchObject({ status: 'MATCH', finalMinutes: 180, confirmed: true });
    expect(reconcileOnTimer(180, 180 + DEFAULT_TOLERANCE_MINUTES)).toMatchObject({ status: 'MATCH' });
  });
  it('keeps the timer figure but leaves it unconfirmed, with both numbers, when they disagree', () => {
    expect(reconcileOnTimer(180, 300)).toEqual({ status: 'MISMATCH', finalMinutes: 180, confirmed: false, reportedMinutes: 300, diffMinutes: 120 });
  });
  it('treats a timer with no mention in the report as confirmed, and a report with no timer data as unverified', () => {
    expect(reconcileOnTimer(180, null)).toMatchObject({ status: 'NO_REPORTED_ON', confirmed: true });
    expect(reconcileOnTimer(null, 120)).toMatchObject({ status: 'NO_TIMER_DATA', finalMinutes: 120, confirmed: false });
    expect(reconcileOnTimer(null, null)).toBeNull();
  });
});

describe('weekly hours (Upwork-style)', () => {
  const e = (date: string, minutes: number, source: HourEntry['source'], confirmed = true): HourEntry => ({ date, minutes, source, confirmed });
  const entries = [
    e('2026-10-26', 240, 'TIMER_CALCULATED'),
    e('2026-10-27', 120, 'MANUAL_REPORT'),
    e('2026-10-28', 60, 'TIMER_CALCULATED', false), // open timer / flagged
    e('2026-10-24', 600, 'TIMER_CALCULATED'), // previous week: excluded
  ];

  it('reports completed, split, unconfirmed and remaining against the weekly limit', () => {
    expect(weeklyHours(entries, 20 * 60, '2026-10-29')).toMatchObject({
      week: { start: '2026-10-26', end: '2026-11-01' },
      completedMinutes: 360, trackedMinutes: 240, manualMinutes: 120, unconfirmedMinutes: 60,
      remainingMinutes: 840, overLimitMinutes: 0, percentUsed: 30,
    });
  });
  it('shows an overage explicitly instead of hiding it', () => {
    const r = weeklyHours(entries, 5 * 60, '2026-10-26');
    expect(r).toMatchObject({ remainingMinutes: 0, overLimitMinutes: 60 });
  });
  it('has no remaining or percentage without a limit', () => {
    expect(weeklyHours(entries, null, '2026-10-26')).toMatchObject({ limitMinutes: null, remainingMinutes: null, percentUsed: null, overLimitMinutes: 0 });
  });
  it('handles an empty week', () => {
    expect(weeklyHours([], 600, '2026-10-26')).toMatchObject({ completedMinutes: 0, remainingMinutes: 600, percentUsed: 0 });
  });
});
