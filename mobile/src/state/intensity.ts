/**
 * The intensity ladder. Mirrors android .../gate/Intensity.kt (the phone service applies it).
 *
 * Evidence (see IMPLEMENTATION_PLAN.md Phase 6d): self-chosen limits work (Allcott et al.,
 * AER 2022); people drift to weaker settings over time (Kovacs et al., CHI 2021); a gentle
 * pause still cuts opens (Grüning et al., PNAS 2023). So: Gentle by default, stricter by
 * choice, tightening is instant, loosening waits a day, and Strict always has an end.
 */

export type Level = 1 | 2 | 3 | 4;
export const AWARE: Level = 1;
export const GENTLE: Level = 2;
export const FIRM: Level = 3;
export const STRICT: Level = 4;

export const LOOSEN_DELAY_MS = 24 * 60 * 60 * 1000;
export const MAX_STRICT_MS = 30 * 24 * 60 * 60 * 1000;

export type Intensity = {
  /** The everyday level (Aware, Gentle or Firm). */
  base: 1 | 2 | 3;
  /** A gentler level the user asked for; applies at `at` (epoch ms). */
  pending: { level: 1 | 2 | 3; at: number } | null;
  /** Strict mode until this time (epoch ms), or null. */
  strictUntil: number | null;
};

export const DEFAULT_INTENSITY: Intensity = {
  base: GENTLE as 2,
  pending: null,
  strictUntil: null,
};

export const LEVELS: {
  level: Level;
  name: string;
  short: string;
  detail: string;
}[] = [
  {
    level: AWARE,
    name: 'Aware',
    short: 'Just count',
    detail: 'Counts reels with Pip on top. No pauses.',
  },
  {
    level: GENTLE,
    name: 'Gentle',
    short: 'A breath first',
    detail: 'A 5-second breath, then "Not now" or open for a few minutes.',
  },
  {
    level: FIRM,
    name: 'Firm',
    short: 'Slower, shorter',
    detail:
      'A 15-second breath, say why you are opening it, 2 minutes at a time, 5 opens a day per app or site.',
  },
  {
    level: STRICT,
    name: 'Strict',
    short: 'Locked until you said',
    detail:
      'Your apps, sites and Shorts stay paused until the time you choose. An emergency unlock is always there, after a 60-second wait.',
  },
];

function asBase(n: number): 1 | 2 | 3 {
  return (n <= 1 ? 1 : n >= 3 ? 3 : 2) as 1 | 2 | 3;
}

/** The level in force right now. */
export function effectiveLevel(i: Intensity, now: number): Level {
  if (i.strictUntil !== null && now < i.strictUntil) {
    return STRICT;
  }
  if (i.pending && now >= i.pending.at) {
    return i.pending.level;
  }
  return i.base;
}

/** The everyday level right now, ignoring Strict. */
export function baseNow(i: Intensity, now: number): 1 | 2 | 3 {
  return i.pending && now >= i.pending.at ? i.pending.level : i.base;
}

/** Folds a due loosening into the base and drops an ended Strict. */
export function settle(i: Intensity, now: number): Intensity {
  const base = baseNow(i, now);
  const pending = i.pending && now < i.pending.at ? i.pending : null;
  const strictUntil = i.strictUntil !== null && now < i.strictUntil ? i.strictUntil : null;
  if (base === i.base && pending === i.pending && strictUntil === i.strictUntil) {
    return i;
  }
  return { base, pending, strictUntil };
}

/** Tighter: at once. Gentler: in 24 hours (asking again replaces the request). */
export function requestLevel(i: Intensity, level: 1 | 2 | 3, now: number): Intensity {
  const s = settle(i, now);
  if (level >= s.base) {
    return { ...s, base: level, pending: null };
  }
  return { ...s, pending: { level, at: now + LOOSEN_DELAY_MS } };
}

export function cancelPending(i: Intensity): Intensity {
  return i.pending ? { ...i, pending: null } : i;
}

/** Starting or extending Strict is instant. It can't be shortened here. Max 30 days ahead. */
export function startStrict(i: Intensity, until: number, now: number): Intensity {
  const capped = Math.min(until, now + MAX_STRICT_MS);
  if (capped <= now) {
    return i;
  }
  const current = i.strictUntil !== null && now < i.strictUntil ? i.strictUntil : 0;
  return { ...settle(i, now), strictUntil: Math.max(current, capped) };
}

/** Ending Strict early is a loosening, so it waits up to 24 hours. */
export function endStrictEarly(i: Intensity, now: number): Intensity {
  if (i.strictUntil === null || now >= i.strictUntil) {
    return settle(i, now);
  }
  return { ...i, strictUntil: Math.min(i.strictUntil, now + LOOSEN_DELAY_MS) };
}

export function sanitizeIntensity(raw: unknown, now: number): Intensity {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_INTENSITY;
  }
  const r = raw as Record<string, unknown>;
  const base = typeof r.base === 'number' && Number.isFinite(r.base) ? asBase(r.base) : GENTLE;
  let pending: Intensity['pending'] = null;
  if (typeof r.pending === 'object' && r.pending !== null) {
    const p = r.pending as Record<string, unknown>;
    if (typeof p.level === 'number' && typeof p.at === 'number' && Number.isFinite(p.at)) {
      // A pending loosening can never be more than a day away (no tampering it far out).
      pending = { level: asBase(p.level), at: Math.min(p.at, now + LOOSEN_DELAY_MS) };
    }
  }
  const strictUntil =
    typeof r.strictUntil === 'number' && Number.isFinite(r.strictUntil)
      ? Math.min(r.strictUntil, now + MAX_STRICT_MS)
      : null;
  return settle({ base: base as 1 | 2 | 3, pending, strictUntil }, now);
}

/**
 * Pip's suggestion in onboarding. Gentle for most people; Firm for people preparing for an
 * exam who also report 6+ hours of phone time a day. Never Strict by default.
 */
export function suggestedLevel(profile: {
  exam: string | null;
  dailyScreenHours: number | null;
}): 2 | 3 {
  return profile.exam && profile.exam !== 'none' && (profile.dailyScreenHours ?? 0) >= 6
    ? (FIRM as 3)
    : (GENTLE as 2);
}

/** "until 9:00 pm" / "until Sat 15 Nov" style end times for Strict. */
export function strictPresets(now: number): { label: string; until: number }[] {
  const d = new Date(now);
  const tonight = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21, 0, 0, 0).getTime();
  const out: { label: string; until: number }[] = [];
  if (tonight - now > 30 * 60 * 1000) {
    out.push({ label: 'Until 9 pm today', until: tonight });
  }
  out.push({ label: 'For 24 hours', until: now + 24 * 3600 * 1000 });
  out.push({ label: 'For 3 days', until: now + 3 * 24 * 3600 * 1000 });
  out.push({ label: 'For 7 days', until: now + 7 * 24 * 3600 * 1000 });
  return out;
}

export function formatWhen(t: number, now: number): string {
  const a = new Date(t);
  const b = new Date(now);
  const time = a.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay =
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay) {
    return time;
  }
  const day = a.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}
