/**
 * App settings, the user's self-described profile, onboarding progress and consent history.
 * Pure data + reducer so every rule is unit-testable and deterministic.
 * Everything here is stored only on the device.
 */

export const PRIORITIES = [
  { id: 'study', label: 'Study' },
  { id: 'work', label: 'Meaningful work' },
  { id: 'reading', label: 'Reading' },
  { id: 'sleep', label: 'Sleep routine' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'creative', label: 'Creative projects' },
  { id: 'other', label: 'Other' },
] as const;
export type PriorityId = (typeof PRIORITIES)[number]['id'];

export const ROLES = [
  { id: 'student', label: 'Student', icon: '📚' },
  { id: 'working', label: 'Working', icon: '💼' },
  { id: 'both', label: 'Studying and working', icon: '⚖️' },
  { id: 'other', label: 'Something else', icon: '🌿' },
] as const;
export type RoleId = (typeof ROLES)[number]['id'];

export const EXAMS = [
  { id: 'jee', label: 'JEE' },
  { id: 'neet', label: 'NEET' },
  { id: 'upsc', label: 'UPSC / State PSC' },
  { id: 'cat', label: 'CAT' },
  { id: 'gate', label: 'GATE' },
  { id: 'ca', label: 'CA / CS / CMA' },
  { id: 'boards', label: 'Board exams' },
  { id: 'college', label: 'College semesters' },
  { id: 'other', label: 'Something else' },
] as const;
export type ExamId = (typeof EXAMS)[number]['id'];

/** Long-haul exams where longer deep-work blocks are commonly used. A suggestion only. */
export const LONG_PREP_EXAMS: readonly ExamId[] = [
  'jee',
  'neet',
  'upsc',
  'gate',
  'ca',
  'cat',
];

export const STRUGGLES = [
  { id: 'autopilot', label: 'I pick up my phone without deciding to' },
  { id: 'reading', label: 'I lose my place when I read' },
  { id: 'forgetting', label: 'I forget things I just heard, even names' },
  { id: 'oneTask', label: "It's hard to stay on one task" },
  { id: 'lateNight', label: 'I scroll late into the night' },
  { id: 'regret', label: 'I feel low after scrolling' },
] as const;
export type StruggleId = (typeof STRUGGLES)[number]['id'];

export const AGE_BANDS = [
  { id: 'under18', label: 'Under 18', midpoint: 16 },
  { id: '18-24', label: '18–24', midpoint: 21 },
  { id: '25-34', label: '25–34', midpoint: 29 },
  { id: '35-44', label: '35–44', midpoint: 39 },
  { id: '45plus', label: '45+', midpoint: 52 },
] as const;
export type AgeBandId = (typeof AGE_BANDS)[number]['id'];

export const MIN_SCREEN_HOURS = 1;
export const MAX_SCREEN_HOURS = 16;

export const ONBOARDING_STEPS = [
  'hello',
  'role',
  'exam',
  'struggles',
  'science',
  'age',
  'screenTime',
  'reality',
  'priorities',
  'duration',
  'monitoring',
  'pledge',
  'ready',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** 'requested' only records the user's wish to set up monitoring. It does NOT mean access was granted. */
export type MonitoringChoice = 'undecided' | 'declined' | 'requested';

export const FOCUS_PRESETS = [15, 25, 45] as const;
export const MIN_FOCUS_MINUTES = 5;
export const MAX_FOCUS_MINUTES = 180;
export const DEFAULT_FOCUS_MINUTES = 25;

/** Identifies the wording the user agreed to. Bump when the wording changes. DRAFT: needs privacy review before release. */
export const CONSENT_POLICY_VERSION = '2026-11-draft-2';
export const CONSENT_PURPOSE_MONITORING = 'usage_monitoring_setup';
/** Recorded whenever RECLAIM observes Android Usage Access being granted or revoked while the user has opted in. */
export const CONSENT_PURPOSE_USAGE_ACCESS = 'usage_access_permission';

/** An app the user chose to see their time for. RECLAIM never pre-selects or labels apps. */
export type TrackedApp = { packageName: string; label: string };
export const MAX_TRACKED_APPS = 30;

/** Recorded when the user agrees to (or withdraws) the separate Accessibility disclosure for the mindful pause. */
export const CONSENT_PURPOSE_PAUSE = 'accessibility_pause';

export type PauseGate = {
  /** User wants pauses (the Android service must also be switched on in Settings). */
  enabled: boolean;
  packages: TrackedApp[];
  /** How long "Open anyway" lets the app through without another pause. */
  allowMinutes: number;
};

/** Separate consents: each feature reads a different kind of on-screen information. */
export const CONSENT_PURPOSE_WEB = 'accessibility_website_pause';
export const CONSENT_PURPOSE_REELS = 'accessibility_reels_counter';

export const MAX_SITES = 50;
/** Website pause: browser address bar compared with the user's sites, on the phone. */
export type WebPause = { enabled: boolean; sites: string[] };

export const REEL_LIMITS = [0, 20, 40, 60, 100] as const;
/** Reels counter. limit 0 = just count, no pause. showPip: Pip floats over Shorts/Reels with the count. */
export type ReelsCounter = { enabled: boolean; limit: number; showPip: boolean };

/** An if-then plan (implementation intention). */
export type IfThenPlan = { when: string; then: string };

export const RESET_DAYS = 14;
export type ResetChallenge = {
  /** Local YYYY-MM-DD of day 1. */
  startDate: string;
  /** Daily limit for the chosen apps, minutes. */
  limitMin: number;
  /** Steady-eye score at the start and end (0..1). */
  baselineScore: number | null;
  finalScore: number | null;
  /** Local dates the user checked in as "stayed within my limit". */
  keptDays: string[];
  finishedAt: string | null;
};

export type ConsentRecord = {
  purpose: string;
  policyVersion: string;
  granted: boolean;
  recordedAt: string; // ISO-8601 UTC
};

export type Profile = {
  name: string;
  role: RoleId | null;
  exam: ExamId | null;
  ageBand: AgeBandId | null;
  struggles: StruggleId[];
  /** Self-reported typical daily phone time. An estimate from the user, not a measurement. */
  dailyScreenHours: number | null;
  pledgedAt: string | null;
};

export type AppSettings = {
  schemaVersion: 1;
  onboarding: { completed: boolean; step: OnboardingStep };
  profile: Profile;
  priorities: PriorityId[];
  focusMinutes: number;
  monitoring: { choice: MonitoringChoice; paused: boolean };
  trackedApps: TrackedApp[];
  gate: PauseGate;
  web: WebPause;
  reels: ReelsCounter;
  plan: IfThenPlan | null;
  reset: ResetChallenge | null;
  /** Local date (YYYY-MM-DD) the daily practice was last finished. Detailed attempts come in Phase 6. */
  practice: { lastCompletedDate: string | null };
  /** Append-only history. Never edited or removed. */
  consents: ConsentRecord[];
};

export const DEFAULT_PROFILE: Profile = {
  name: '',
  role: null,
  exam: null,
  ageBand: null,
  struggles: [],
  dailyScreenHours: null,
  pledgedAt: null,
};

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  onboarding: { completed: false, step: 'hello' },
  profile: DEFAULT_PROFILE,
  priorities: [],
  focusMinutes: DEFAULT_FOCUS_MINUTES,
  monitoring: { choice: 'undecided', paused: false },
  trackedApps: [],
  gate: { enabled: false, packages: [], allowMinutes: 5 },
  web: { enabled: false, sites: [] },
  reels: { enabled: false, limit: 0, showPip: true },
  plan: null,
  reset: null,
  practice: { lastCompletedDate: null },
  consents: [],
};

export type SettingsAction =
  | { type: 'hydrate'; settings: AppSettings }
  | { type: 'nextStep' }
  | { type: 'previousStep' }
  | { type: 'setName'; name: string }
  | { type: 'setRole'; role: RoleId }
  | { type: 'setExam'; exam: ExamId }
  | { type: 'toggleStruggle'; struggle: StruggleId }
  | { type: 'setAgeBand'; ageBand: AgeBandId }
  | { type: 'setScreenHours'; hours: number }
  | { type: 'pledge'; at: string }
  | { type: 'togglePriority'; priority: PriorityId }
  | { type: 'setFocusMinutes'; minutes: number }
  | {
      type: 'setMonitoringChoice';
      choice: 'declined' | 'requested';
      at: string;
    }
  | { type: 'setMonitoringPaused'; paused: boolean }
  | { type: 'setTrackedApps'; apps: TrackedApp[] }
  | { type: 'observeUsageAccess'; granted: boolean; at: string }
  | { type: 'completePractice'; date: string }
  | { type: 'setGate'; enabled: boolean; at: string }
  | { type: 'setGateApps'; apps: TrackedApp[] }
  | { type: 'setGateMinutes'; minutes: number }
  | { type: 'setWeb'; enabled: boolean; at: string }
  | { type: 'setSites'; sites: string[] }
  | { type: 'setReels'; enabled: boolean; at: string }
  | { type: 'setReelLimit'; limit: number }
  | { type: 'setReelPip'; show: boolean }
  | { type: 'setPlan'; plan: IfThenPlan | null }
  | { type: 'startReset'; startDate: string; limitMin: number }
  | { type: 'setResetScore'; which: 'baseline' | 'final'; score: number }
  | { type: 'keepResetDay'; date: string; kept: boolean }
  | { type: 'finishReset'; at: string }
  | { type: 'abandonReset' }
  | { type: 'completeOnboarding' };

export const MAX_NAME_LENGTH = 40;

/**
 * "https://www.Reddit.com/r/x" -> "reddit.com". Returns null for anything that isn't a site.
 * Mirrors WebMatcher.hostOf on the Android side.
 */
export function normalizeSite(input: string): string | null {
  let t = (input ?? '').trim().toLowerCase();
  if (!t || /\s/.test(t)) {
    return null;
  }
  t = t.replace(/^https?:\/\//, '');
  t = t.split(/[/?#]/)[0];
  t = t.split(':')[0];
  t = t.includes('@') ? t.slice(t.lastIndexOf('@') + 1) : t;
  for (const p of ['www.', 'm.', 'mobile.']) {
    if (t.startsWith(p) && t.length > p.length + 3) {
      t = t.slice(p.length);
    }
  }
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(t)
    ? t
    : null;
}

export function cleanSites(sites: unknown): string[] {
  if (!Array.isArray(sites)) {
    return [];
  }
  const out: string[] = [];
  for (const s of sites) {
    const n = typeof s === 'string' ? normalizeSite(s) : null;
    if (n && !out.includes(n)) {
      out.push(n);
    }
  }
  return out.slice(0, MAX_SITES);
}

export function clampReelLimit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1000, Math.max(0, Math.round(value)))
    : 0;
}

export function clampFocusMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_FOCUS_MINUTES;
  }
  return Math.min(
    MAX_FOCUS_MINUTES,
    Math.max(MIN_FOCUS_MINUTES, Math.round(value)),
  );
}

export function clampScreenHours(value: number): number {
  if (!Number.isFinite(value)) {
    return 4;
  }
  return Math.min(
    MAX_SCREEN_HOURS,
    Math.max(MIN_SCREEN_HOURS, Math.round(value * 2) / 2),
  );
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trimStart().slice(0, MAX_NAME_LENGTH);
}

/** Whether a step should be shown for the current answers. */
export function isStepApplicable(
  step: OnboardingStep,
  s: AppSettings,
): boolean {
  switch (step) {
    case 'exam':
      return s.profile.role === 'student' || s.profile.role === 'both';
    case 'reality':
      return s.profile.dailyScreenHours !== null;
    default:
      return true;
  }
}

function moveStep(s: AppSettings, dir: 1 | -1): OnboardingStep {
  let i = ONBOARDING_STEPS.indexOf(s.onboarding.step);
  for (;;) {
    const next = i + dir;
    if (next < 0 || next >= ONBOARDING_STEPS.length) {
      return s.onboarding.step;
    }
    i = next;
    if (isStepApplicable(ONBOARDING_STEPS[i], s)) {
      return ONBOARDING_STEPS[i];
    }
  }
}

/** The steps this user will actually see, in order (used for the progress bar). */
export function visibleSteps(s: AppSettings): OnboardingStep[] {
  return ONBOARDING_STEPS.filter(step => isStepApplicable(step, s));
}

function withProfile(s: AppSettings, patch: Partial<Profile>): AppSettings {
  return { ...s, profile: { ...s.profile, ...patch } };
}

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
}

export function settingsReducer(
  state: AppSettings,
  action: SettingsAction,
): AppSettings {
  switch (action.type) {
    case 'hydrate':
      return action.settings;

    case 'nextStep':
      return {
        ...state,
        onboarding: { ...state.onboarding, step: moveStep(state, 1) },
      };

    case 'previousStep':
      return {
        ...state,
        onboarding: { ...state.onboarding, step: moveStep(state, -1) },
      };

    case 'setName':
      return withProfile(state, { name: cleanName(action.name) });

    case 'setRole': {
      const studies = action.role === 'student' || action.role === 'both';
      return withProfile(state, {
        role: action.role,
        // An exam only makes sense for someone who studies.
        exam: studies ? state.profile.exam : null,
      });
    }

    case 'setExam':
      return withProfile(state, { exam: action.exam });

    case 'toggleStruggle':
      return withProfile(state, {
        struggles: toggle(state.profile.struggles, action.struggle),
      });

    case 'setAgeBand':
      return withProfile(state, { ageBand: action.ageBand });

    case 'setScreenHours':
      return withProfile(state, {
        dailyScreenHours: clampScreenHours(action.hours),
      });

    case 'pledge':
      return withProfile(state, { pledgedAt: action.at });

    case 'togglePriority':
      return {
        ...state,
        priorities: toggle(state.priorities, action.priority),
      };

    case 'setFocusMinutes':
      return { ...state, focusMinutes: clampFocusMinutes(action.minutes) };

    case 'setMonitoringChoice': {
      if (state.monitoring.choice === action.choice) {
        return state;
      }
      // Consent is append-only: every change adds a new record.
      const record: ConsentRecord = {
        purpose: CONSENT_PURPOSE_MONITORING,
        policyVersion: CONSENT_POLICY_VERSION,
        granted: action.choice === 'requested',
        recordedAt: action.at,
      };
      return {
        ...state,
        monitoring: {
          choice: action.choice,
          // Declining clears any pause so state stays coherent.
          paused:
            action.choice === 'declined' ? false : state.monitoring.paused,
        },
        consents: [...state.consents, record],
      };
    }

    case 'setMonitoringPaused':
      // Pausing only makes sense if the user opted in.
      if (state.monitoring.choice !== 'requested') {
        return state;
      }
      return {
        ...state,
        monitoring: { ...state.monitoring, paused: action.paused },
      };

    case 'setTrackedApps': {
      const seen = new Set<string>();
      const apps = action.apps
        .filter(
          a =>
            typeof a.packageName === 'string' &&
            a.packageName.length > 0 &&
            !seen.has(a.packageName) &&
            seen.add(a.packageName),
        )
        .slice(0, MAX_TRACKED_APPS)
        .map(a => ({
          packageName: a.packageName,
          label: a.label || a.packageName,
        }));
      return { ...state, trackedApps: apps };
    }

    case 'observeUsageAccess': {
      // Only meaningful once the user has opted in; record changes, not every check.
      if (state.monitoring.choice !== 'requested') {
        return state;
      }
      const last = [...state.consents]
        .reverse()
        .find(c => c.purpose === CONSENT_PURPOSE_USAGE_ACCESS);
      if (last && last.granted === action.granted) {
        return state;
      }
      if (!last && !action.granted) {
        return state; // never granted yet: nothing to record
      }
      return {
        ...state,
        consents: [
          ...state.consents,
          {
            purpose: CONSENT_PURPOSE_USAGE_ACCESS,
            policyVersion: CONSENT_POLICY_VERSION,
            granted: action.granted,
            recordedAt: action.at,
          },
        ],
      };
    }

    case 'setGate': {
      if (state.gate.enabled === action.enabled) {
        return state;
      }
      return {
        ...state,
        gate: { ...state.gate, enabled: action.enabled },
        consents: [
          ...state.consents,
          {
            purpose: CONSENT_PURPOSE_PAUSE,
            policyVersion: CONSENT_POLICY_VERSION,
            granted: action.enabled,
            recordedAt: action.at,
          },
        ],
      };
    }

    case 'setGateApps': {
      const seen = new Set<string>();
      const apps = action.apps
        .filter(
          a =>
            a.packageName &&
            !seen.has(a.packageName) &&
            seen.add(a.packageName),
        )
        .slice(0, MAX_TRACKED_APPS);
      return { ...state, gate: { ...state.gate, packages: apps } };
    }

    case 'setGateMinutes':
      return {
        ...state,
        gate: {
          ...state.gate,
          allowMinutes: Math.min(60, Math.max(1, Math.round(action.minutes))),
        },
      };

    case 'setWeb': {
      if (state.web.enabled === action.enabled) {
        return state;
      }
      return {
        ...state,
        web: { ...state.web, enabled: action.enabled },
        consents: [
          ...state.consents,
          {
            purpose: CONSENT_PURPOSE_WEB,
            policyVersion: CONSENT_POLICY_VERSION,
            granted: action.enabled,
            recordedAt: action.at,
          },
        ],
      };
    }

    case 'setSites':
      return {
        ...state,
        web: { ...state.web, sites: cleanSites(action.sites) },
      };

    case 'setReels': {
      if (state.reels.enabled === action.enabled) {
        return state;
      }
      return {
        ...state,
        reels: { ...state.reels, enabled: action.enabled },
        consents: [
          ...state.consents,
          {
            purpose: CONSENT_PURPOSE_REELS,
            policyVersion: CONSENT_POLICY_VERSION,
            granted: action.enabled,
            recordedAt: action.at,
          },
        ],
      };
    }

    case 'setReelLimit':
      return {
        ...state,
        reels: { ...state.reels, limit: clampReelLimit(action.limit) },
      };

    case 'setReelPip':
      return { ...state, reels: { ...state.reels, showPip: action.show } };

    case 'setPlan': {
      if (!action.plan) {
        return { ...state, plan: null };
      }
      const when = action.plan.when.trim().slice(0, 80);
      const then = action.plan.then.trim().slice(0, 80);
      return { ...state, plan: when && then ? { when, then } : null };
    }

    case 'startReset':
      if (state.reset && !state.reset.finishedAt) {
        return state; // one challenge at a time
      }
      return {
        ...state,
        reset: {
          startDate: action.startDate,
          limitMin: Math.min(240, Math.max(5, Math.round(action.limitMin))),
          baselineScore: null,
          finalScore: null,
          keptDays: [],
          finishedAt: null,
        },
      };

    case 'setResetScore': {
      if (!state.reset) {
        return state;
      }
      const score = Math.min(1, Math.max(0, action.score));
      return {
        ...state,
        reset:
          action.which === 'baseline'
            ? {
                ...state.reset,
                baselineScore: state.reset.baselineScore ?? score,
              }
            : { ...state.reset, finalScore: score },
      };
    }

    case 'keepResetDay': {
      if (!state.reset) {
        return state;
      }
      const has = state.reset.keptDays.includes(action.date);
      const keptDays = action.kept
        ? has
          ? state.reset.keptDays
          : [...state.reset.keptDays, action.date]
        : state.reset.keptDays.filter(d => d !== action.date);
      return { ...state, reset: { ...state.reset, keptDays } };
    }

    case 'finishReset':
      return state.reset
        ? { ...state, reset: { ...state.reset, finishedAt: action.at } }
        : state;

    case 'abandonReset':
      return { ...state, reset: null };

    case 'completePractice':
      return { ...state, practice: { lastCompletedDate: action.date } };

    case 'completeOnboarding':
      return { ...state, onboarding: { completed: true, step: 'ready' } };
  }
}

/** True when usage data may be collected: the user opted in and has not paused. Permission is checked separately (Phase 3). */
export function isMonitoringActive(settings: AppSettings): boolean {
  return (
    settings.monitoring.choice === 'requested' && !settings.monitoring.paused
  );
}
