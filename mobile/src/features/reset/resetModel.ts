import { RESET_DAYS, ResetChallenge } from '../../state/settings';

/** Whole local days between two YYYY-MM-DD keys (b - a). DST-safe because it uses noon. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ta = new Date(ay, am - 1, ad, 12).getTime();
  const tb = new Date(by, bm - 1, bd, 12).getTime();
  return Math.round((tb - ta) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(y, m - 1, d + n, 12);
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${mm}-${dd}`;
}

export type ResetStatus =
  | { kind: 'none' }
  | { kind: 'needsBaseline'; day: number }
  | { kind: 'active'; day: number; daysLeft: number }
  | { kind: 'needsFinal'; day: number }
  | { kind: 'finished' };

/** Where the user is in the 14-day Reset. Day 1 is the start date. */
export function resetStatus(
  r: ResetChallenge | null,
  today: string,
): ResetStatus {
  if (!r) {
    return { kind: 'none' };
  }
  if (r.finishedAt) {
    return { kind: 'finished' };
  }
  const day = Math.max(1, daysBetween(r.startDate, today) + 1);
  if (r.baselineScore === null) {
    return { kind: 'needsBaseline', day };
  }
  if (day >= RESET_DAYS) {
    return { kind: 'needsFinal', day: Math.min(day, RESET_DAYS) };
  }
  return { kind: 'active', day, daysLeft: RESET_DAYS - day };
}

/** The 14 dates of the challenge with whether each day was kept. */
export function resetCalendar(r: ResetChallenge, today: string) {
  return Array.from({ length: RESET_DAYS }, (_, i) => {
    const date = addDays(r.startDate, i);
    return {
      date,
      day: i + 1,
      kept: r.keptDays.includes(date),
      isToday: date === today,
      future: date > today,
    };
  });
}

export type ResetResult = {
  keptDays: number;
  before: number | null;
  after: number | null;
  /** after - before in percentage points; null if either is missing. */
  changePts: number | null;
};

export function resetResult(r: ResetChallenge): ResetResult {
  const before = r.baselineScore;
  const after = r.finalScore;
  return {
    keptDays: r.keptDays.length,
    before,
    after,
    changePts:
      before !== null && after !== null
        ? Math.round((after - before) * 100)
        : null,
  };
}

/** Day-by-day tips grounded in the research behind the Reset. Short, practical, no hype. */
export const DAILY_TIPS: string[] = [
  'Move your scroll apps off the home screen. Distance adds a moment to choose.',
  'Turn off notifications for one app that pulls you in most.',
  'Keep your phone out of the room for your first focus session today.',
  'When you feel the urge to check, notice it and take one slow breath.',
  'Read something long for 10 minutes. It may feel slow at first; that is normal.',
  'Charge your phone outside the bedroom tonight.',
  'Halfway there. Look back: when did you scroll without meaning to?',
  'Try a 5-minute walk before studying. Movement sharpens attention for a while.',
  'Replace one scroll break with looking out of a window for two minutes.',
  'Tell a friend what you are doing. Saying it out loud helps it stick.',
  'Do one task with zero switching for 25 minutes.',
  'Notice what you did with the time you got back this week.',
  'Plan what will stay after the Reset: which habits do you keep?',
  'Last day. Take the attention check again and see your change.',
];
