import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AGE_BANDS,
  AgeBandId,
  AppSettings,
  clampFocusMinutes,
  clampReelLimit,
  clampScreenHours,
  cleanName,
  cleanSites,
  ConsentRecord,
  DEFAULT_SETTINGS,
  MAX_TRACKED_APPS,
  EXAMS,
  ExamId,
  ONBOARDING_STEPS,
  OnboardingStep,
  PRIORITIES,
  PriorityId,
  Profile,
  ROLES,
  RoleId,
  STRUGGLES,
  StruggleId,
  TrackedApp,
  IfThenPlan,
  ResetChallenge,
} from '../state/settings';

export const SETTINGS_KEY = 'reclaim.settings.v1';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function oneOf<T extends string>(
  options: readonly { id: T }[],
  v: unknown,
): T | null {
  return options.some(o => o.id === v) ? (v as T) : null;
}

function listOf<T extends string>(
  options: readonly { id: T }[],
  v: unknown,
): T[] {
  if (!Array.isArray(v)) {
    return [];
  }
  const ids = options.map(o => o.id) as readonly unknown[];
  return v.filter(
    (x, i, all) => ids.includes(x) && all.indexOf(x) === i,
  ) as T[];
}

function parseConsents(v: unknown): ConsentRecord[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter(
    (c): c is ConsentRecord =>
      isRecord(c) &&
      typeof c.purpose === 'string' &&
      typeof c.policyVersion === 'string' &&
      typeof c.granted === 'boolean' &&
      typeof c.recordedAt === 'string',
  );
}

function parseProfile(v: unknown): Profile {
  const p = isRecord(v) ? v : {};
  const role = oneOf<RoleId>(ROLES, p.role);
  const studies = role === 'student' || role === 'both';
  return {
    name: typeof p.name === 'string' ? cleanName(p.name).trim() : '',
    role,
    exam: studies ? oneOf<ExamId>(EXAMS, p.exam) : null,
    ageBand: oneOf<AgeBandId>(AGE_BANDS, p.ageBand),
    struggles: listOf<StruggleId>(STRUGGLES, p.struggles),
    dailyScreenHours:
      typeof p.dailyScreenHours === 'number'
        ? clampScreenHours(p.dailyScreenHours)
        : null,
    pledgedAt: typeof p.pledgedAt === 'string' ? p.pledgedAt : null,
  };
}

function parseTrackedApps(v: unknown): TrackedApp[] {
  if (!Array.isArray(v)) {
    return [];
  }
  const seen = new Set<string>();
  const out: TrackedApp[] = [];
  for (const a of v) {
    if (
      isRecord(a) &&
      typeof a.packageName === 'string' &&
      a.packageName.length > 0 &&
      !seen.has(a.packageName)
    ) {
      seen.add(a.packageName);
      out.push({
        packageName: a.packageName,
        label: typeof a.label === 'string' && a.label ? a.label : a.packageName,
      });
    }
  }
  return out.slice(0, MAX_TRACKED_APPS);
}

function parsePlan(v: unknown): IfThenPlan | null {
  if (
    !isRecord(v) ||
    typeof v.when !== 'string' ||
    typeof v.then !== 'string'
  ) {
    return null;
  }
  const when = v.when.trim().slice(0, 80);
  const then = v.then.trim().slice(0, 80);
  return when && then ? { when, then } : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseReset(v: unknown): ResetChallenge | null {
  if (
    !isRecord(v) ||
    typeof v.startDate !== 'string' ||
    !DATE_RE.test(v.startDate)
  ) {
    return null;
  }
  const score = (x: unknown) =>
    typeof x === 'number' && x >= 0 && x <= 1 ? x : null;
  return {
    startDate: v.startDate,
    limitMin:
      typeof v.limitMin === 'number'
        ? Math.min(240, Math.max(5, Math.round(v.limitMin)))
        : 30,
    baselineScore: score(v.baselineScore),
    finalScore: score(v.finalScore),
    keptDays: Array.isArray(v.keptDays)
      ? v.keptDays.filter(
          (d): d is string => typeof d === 'string' && DATE_RE.test(d),
        )
      : [],
    finishedAt: typeof v.finishedAt === 'string' ? v.finishedAt : null,
  };
}

/** Defensive parse: anything malformed falls back to defaults rather than crashing. */
export function sanitizeSettings(raw: unknown): AppSettings {
  if (!isRecord(raw) || raw.schemaVersion !== 1) {
    return DEFAULT_SETTINGS;
  }
  const onboarding = isRecord(raw.onboarding) ? raw.onboarding : {};
  const monitoring = isRecord(raw.monitoring) ? raw.monitoring : {};
  const step = (ONBOARDING_STEPS as readonly unknown[]).includes(
    onboarding.step,
  )
    ? (onboarding.step as OnboardingStep)
    : 'hello';
  const choice =
    monitoring.choice === 'declined' || monitoring.choice === 'requested'
      ? monitoring.choice
      : 'undecided';

  return {
    schemaVersion: 1,
    onboarding: { completed: onboarding.completed === true, step },
    profile: parseProfile(raw.profile),
    priorities: listOf<PriorityId>(PRIORITIES, raw.priorities),
    focusMinutes: clampFocusMinutes(
      typeof raw.focusMinutes === 'number' ? raw.focusMinutes : NaN,
    ),
    monitoring: {
      choice,
      paused: choice === 'requested' && monitoring.paused === true,
    },
    trackedApps: parseTrackedApps(raw.trackedApps),
    gate: {
      enabled: isRecord(raw.gate) && raw.gate.enabled === true,
      packages: parseTrackedApps(isRecord(raw.gate) ? raw.gate.packages : []),
      allowMinutes:
        isRecord(raw.gate) && typeof raw.gate.allowMinutes === 'number'
          ? Math.min(60, Math.max(1, Math.round(raw.gate.allowMinutes)))
          : 5,
    },
    web: {
      enabled: isRecord(raw.web) && raw.web.enabled === true,
      sites: cleanSites(isRecord(raw.web) ? raw.web.sites : []),
    },
    reels: {
      enabled: isRecord(raw.reels) && raw.reels.enabled === true,
      limit: clampReelLimit(isRecord(raw.reels) ? raw.reels.limit : 0),
      showPip: !(isRecord(raw.reels) && raw.reels.showPip === false),
    },
    plan: parsePlan(raw.plan),
    reset: parseReset(raw.reset),
    practice: {
      lastCompletedDate:
        isRecord(raw.practice) &&
        typeof raw.practice.lastCompletedDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(raw.practice.lastCompletedDate)
          ? raw.practice.lastCompletedDate
          : null,
    },
    consents: parseConsents(raw.consents),
  };
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!json) {
      return DEFAULT_SETTINGS;
    }
    return sanitizeSettings(JSON.parse(json));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
