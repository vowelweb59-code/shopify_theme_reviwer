import { describe, expect, it } from 'vitest';
import { limitForWeek, withCorrection, withScopeChange } from './limit-history';

describe('weekly limit history', () => {
  it('uses the current value when there is no history', () => expect(limitForWeek([], 600, '2026-11-22')).toBe(600));

  it('a scope change applies from the week that contains its date', () => {
    const h = withScopeChange([], 600, 1200, '2026-11-18');
    expect(h).toEqual([{ from: null, minutes: 600 }, { from: '2026-11-18', minutes: 1200 }]);
    expect(limitForWeek(h, 1200, '2026-11-15')).toBe(600); // week 9-15 Nov, before
    expect(limitForWeek(h, 1200, '2026-11-22')).toBe(1200); // week 16-22 Nov contains 18 Nov
    expect(limitForWeek(h, 1200, '2026-12-06')).toBe(1200);
  });

  it('keeps several steps in date order and replaces a step with the same date', () => {
    let h = withScopeChange([], 600, 1200, '2026-11-18');
    h = withScopeChange(h, 1200, 900, '2026-12-10');
    h = withScopeChange(h, 900, 1000, '2026-12-10');
    expect(h.map((s) => s.minutes)).toEqual([600, 1200, 1000]);
    expect(limitForWeek(h, 1000, '2026-12-13')).toBe(1000);
    expect(limitForWeek(h, 1000, '2026-11-29')).toBe(1200);
  });

  it('a correction edits the step in force today', () => {
    const h = withScopeChange([], 600, 1200, '2026-11-18');
    expect(withCorrection(h, '2026-11-20', 1500).map((s) => s.minutes)).toEqual([600, 1500]);
    expect(withCorrection(h, '2026-11-10', 700).map((s) => s.minutes)).toEqual([700, 1200]);
    expect(withCorrection([], '2026-11-20', 700)).toEqual([]);
  });
});
