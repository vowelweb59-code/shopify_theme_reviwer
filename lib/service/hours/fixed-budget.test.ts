import { describe, expect, it } from 'vitest';
import { workableMinutes } from './fixed-budget';

describe('workableMinutes', () => {
  it('divides the price by $15 an hour', () => {
    expect(workableMinutes(60000)).toBe(40 * 60);
    expect(workableMinutes(17200)).toBe(Math.round((172 / 15) * 60));
  });
  it('is null without a price', () => {
    expect(workableMinutes(null)).toBeNull();
    expect(workableMinutes(0)).toBeNull();
  });
});
