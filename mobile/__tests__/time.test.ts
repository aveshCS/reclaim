import {
  formatDuration,
  startOfLocalDay,
  startOfLocalDayDaysAgo,
} from '../src/utils/time';

describe('time helpers', () => {
  it('finds local midnight', () => {
    const t = new Date(2026, 10, 7, 15, 42, 10).getTime();
    expect(startOfLocalDay(t)).toBe(new Date(2026, 10, 7).getTime());
  });

  it('steps back whole calendar days, across month boundaries', () => {
    const t = new Date(2026, 11, 2, 9, 0).getTime();
    expect(startOfLocalDayDaysAgo(t, 6)).toBe(new Date(2026, 10, 26).getTime());
  });

  it('formats durations without over-claiming precision', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(20_000)).toBe('<1 min');
    expect(formatDuration(12 * 60_000 + 59_000)).toBe('12 min');
    expect(formatDuration(60 * 60_000)).toBe('1 h');
    expect(formatDuration(65 * 60_000)).toBe('1 h 5 min');
    expect(formatDuration(-5)).toBe('0 min');
  });
});
