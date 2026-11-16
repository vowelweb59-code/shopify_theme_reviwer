import { describe, expect, it } from 'vitest';
import { isAutoHold, workingDaysCutoff } from './activity-rules';

const day = (d: Date) => d.toISOString().slice(0, 10);

describe('workingDaysCutoff (30 working days, Sundays off, IST)', () => {
  it('counts today and skips Sundays', () => {
    // Mon 16 Nov 2026, 10:00 IST. Tue 13 Oct to Mon 16 Nov = 35 days, 5 of them Sundays: 30 working days.
    expect(day(workingDaysCutoff(new Date('2026-11-16T04:30:00Z')))).toBe('2026-10-13');
  });

  it('uses the IST date (00:30 IST on Tuesday is still Tuesday)', () => {
    expect(day(workingDaysCutoff(new Date('2026-11-16T19:00:00Z'), 1))).toBe('2026-11-17');
  });

  it('does not count a Sunday today', () => {
    // Sun 15 Nov: the one most recent working day is Sat 14 Nov.
    expect(day(workingDaysCutoff(new Date('2026-11-15T06:00:00Z'), 1))).toBe('2026-11-14');
  });
});

describe('isAutoHold', () => {
  it('recognises the old and new wording, not a person', () => {
    expect(isAutoHold('Automatic: no hours for 45 days')).toBe(true);
    expect(isAutoHold('Automatic: no hours for 30 working days')).toBe(true);
    expect(isAutoHold('Client paused')).toBe(false);
    expect(isAutoHold(null)).toBe(false);
  });
});
