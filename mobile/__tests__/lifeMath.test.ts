import { projectScreenTime } from '../src/features/onboarding/lifeMath';

describe('projectScreenTime', () => {
  it('projects years on the phone until age 80 from the age band midpoint', () => {
    const p = projectScreenTime(6, '18-24'); // midpoint 21 -> 59 years ahead
    expect(p.yearsAhead).toBe(59);
    expect(p.lifetimeYears).toBeCloseTo((6 * 59) / 24, 5); // 14.75
    expect(p.daysPerYear).toBeCloseTo(91.25, 5);
    expect(p.wakingShare).toBeCloseTo(6 / 16, 5);
  });

  it('gives per-year figures only when age is unknown', () => {
    const p = projectScreenTime(4, null);
    expect(p.yearsAhead).toBeNull();
    expect(p.lifetimeYears).toBeNull();
    expect(p.daysPerYear).toBeCloseTo(60.83, 2);
  });

  it('says one hour a day is about 15 days a year', () => {
    expect(projectScreenTime(3, null).oneHourBackDaysPerYear).toBeCloseTo(
      15.21,
      2,
    );
  });

  it('caps impossible inputs', () => {
    const p = projectScreenTime(40, '45plus');
    expect(p.wakingShare).toBe(1);
    expect(p.daysPerYear).toBeCloseTo(365, 5);
  });
});
