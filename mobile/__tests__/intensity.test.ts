import {
  cancelPending,
  DEFAULT_INTENSITY,
  effectiveLevel,
  endStrictEarly,
  FIRM,
  GENTLE,
  Intensity,
  LOOSEN_DELAY_MS,
  requestLevel,
  sanitizeIntensity,
  settle,
  startStrict,
  STRICT,
  strictPresets,
  suggestedLevel,
} from '../src/state/intensity';

const H = 3_600_000;
const T0 = new Date(2026, 10, 8, 15, 0).getTime();

describe('intensity ladder', () => {
  it('starts Gentle', () => {
    expect(effectiveLevel(DEFAULT_INTENSITY, T0)).toBe(GENTLE);
  });

  it('tightens at once', () => {
    const i = requestLevel(DEFAULT_INTENSITY, 3, T0);
    expect(effectiveLevel(i, T0)).toBe(FIRM);
    expect(i.pending).toBeNull();
  });

  it('loosens only after a day, and the wait can be cancelled', () => {
    const firm = requestLevel(DEFAULT_INTENSITY, 3, T0);
    const asked = requestLevel(firm, 1, T0 + H);
    expect(effectiveLevel(asked, T0 + 2 * H)).toBe(FIRM);
    expect(asked.pending).toEqual({ level: 1, at: T0 + H + LOOSEN_DELAY_MS });
    expect(effectiveLevel(asked, T0 + H + LOOSEN_DELAY_MS)).toBe(1);
    expect(settle(asked, T0 + H + LOOSEN_DELAY_MS)).toEqual({
      base: 1,
      pending: null,
      strictUntil: null,
    });
    expect(effectiveLevel(cancelPending(asked), T0 + 30 * H)).toBe(FIRM);
  });

  it('a tighter request wipes a pending loosening', () => {
    const firm = requestLevel(DEFAULT_INTENSITY, 3, T0);
    const asked = requestLevel(firm, 2, T0);
    const again = requestLevel(asked, 3, T0 + H);
    expect(again.pending).toBeNull();
    expect(effectiveLevel(again, T0 + 48 * H)).toBe(FIRM);
  });

  it('Strict starts at once, can be extended but not shortened, and ends on time', () => {
    let i = startStrict(DEFAULT_INTENSITY, T0 + 5 * H, T0);
    expect(effectiveLevel(i, T0 + H)).toBe(STRICT);
    i = startStrict(i, T0 + 2 * H, T0 + H); // shorter: ignored
    expect(i.strictUntil).toBe(T0 + 5 * H);
    i = startStrict(i, T0 + 9 * H, T0 + H);
    expect(i.strictUntil).toBe(T0 + 9 * H);
    expect(effectiveLevel(i, T0 + 9 * H)).toBe(GENTLE);
    expect(startStrict(DEFAULT_INTENSITY, T0 - 1, T0)).toBe(DEFAULT_INTENSITY);
    expect(startStrict(DEFAULT_INTENSITY, T0 + 400 * 24 * H, T0).strictUntil).toBe(
      T0 + 30 * 24 * H,
    );
  });

  it('ending Strict early waits up to a day', () => {
    const week = startStrict(DEFAULT_INTENSITY, T0 + 7 * 24 * H, T0);
    const ending = endStrictEarly(week, T0 + H);
    expect(ending.strictUntil).toBe(T0 + H + LOOSEN_DELAY_MS);
    const soon = startStrict(DEFAULT_INTENSITY, T0 + 2 * H, T0);
    expect(endStrictEarly(soon, T0 + H).strictUntil).toBe(T0 + 2 * H);
  });

  it('sanitises stored values, including tampering', () => {
    expect(sanitizeIntensity(null, T0)).toEqual(DEFAULT_INTENSITY);
    expect(sanitizeIntensity({ base: 'x' }, T0)).toEqual(DEFAULT_INTENSITY);
    const s: Intensity = sanitizeIntensity(
      { base: 9, pending: { level: 1, at: T0 + 99 * 24 * H }, strictUntil: T0 + 999 * 24 * H },
      T0,
    );
    expect(s.base).toBe(3);
    expect(s.pending?.at).toBe(T0 + LOOSEN_DELAY_MS);
    expect(s.strictUntil).toBe(T0 + 30 * 24 * H);
    expect(sanitizeIntensity({ base: 2, strictUntil: T0 - 1 }, T0).strictUntil).toBeNull();
  });

  it('suggests Firm only for heavy phone use with an exam ahead, never Strict', () => {
    expect(suggestedLevel({ exam: 'upsc', dailyScreenHours: 6 })).toBe(FIRM);
    expect(suggestedLevel({ exam: 'upsc', dailyScreenHours: 3 })).toBe(GENTLE);
    expect(suggestedLevel({ exam: null, dailyScreenHours: 10 })).toBe(GENTLE);
  });

  it('offers sensible Strict end times', () => {
    const afternoon = strictPresets(T0).map(p => p.label);
    expect(afternoon[0]).toBe('Until 9 pm today');
    const late = strictPresets(new Date(2026, 10, 8, 20, 50).getTime()).map(p => p.label);
    expect(late).not.toContain('Until 9 pm today');
    expect(late).toContain('For 7 days');
  });
});
