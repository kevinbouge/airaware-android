import { addHours, millisecondsBetween, subtractDays, subtractHours } from '../src/utils/time';

describe('time utilities', () => {
  it('calculates millisecond differences for timestamps and Date instances', () => {
    const earlier = Date.parse('2026-08-31T10:00:00Z');
    const later = new Date('2026-08-31T11:30:00Z');

    expect(millisecondsBetween(later, earlier)).toBe(90 * 60 * 1000);
  });

  it('applies hour and day offsets without calendar timezone conversion', () => {
    const base = Date.parse('2026-08-31T10:00:00Z');

    expect(addHours(base, 6)).toBe(Date.parse('2026-08-31T16:00:00Z'));
    expect(subtractHours(base, 12)).toBe(Date.parse('2026-08-30T22:00:00Z'));
    expect(subtractDays(base, 2)).toBe(Date.parse('2026-08-29T10:00:00Z'));
  });
});
