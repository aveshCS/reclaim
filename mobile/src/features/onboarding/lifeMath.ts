import { AGE_BANDS, AgeBandId } from '../../state/settings';

/** Age used as the end of the projection. A round, conservative figure, not a life-expectancy claim. */
export const PROJECTION_END_AGE = 80;
/** Assumed waking hours per day for the "share of waking time" figure. */
export const WAKING_HOURS = 16;

export type ScreenProjection = {
  /** Full 24-hour days per year spent on the phone at this pace. */
  daysPerYear: number;
  /** Share of waking hours, 0..1. */
  wakingShare: number;
  /** Years remaining until PROJECTION_END_AGE, or null when age is unknown. */
  yearsAhead: number | null;
  /** Total 24-hour years on the phone over yearsAhead, or null when age is unknown. */
  lifetimeYears: number | null;
  /** Full days per year that getting back one hour a day would free up. */
  oneHourBackDaysPerYear: number;
};

/**
 * Turns a self-reported daily phone time into simple, honest projections.
 * Straight-line maths on the user's own estimate; it does not predict anything about them.
 */
export function projectScreenTime(
  hoursPerDay: number,
  ageBand: AgeBandId | null,
): ScreenProjection {
  const h = Math.max(0, Math.min(24, hoursPerDay));
  const band = AGE_BANDS.find(b => b.id === ageBand);
  const yearsAhead = band
    ? Math.max(0, PROJECTION_END_AGE - band.midpoint)
    : null;
  return {
    daysPerYear: (h * 365) / 24,
    wakingShare: Math.min(1, h / WAKING_HOURS),
    yearsAhead,
    lifetimeYears: yearsAhead === null ? null : (h * yearsAhead) / 24,
    oneHourBackDaysPerYear: 365 / 24,
  };
}
